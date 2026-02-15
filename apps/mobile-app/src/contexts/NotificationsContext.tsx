import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
    useRef,
} from 'react';
import * as ExpoNotifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, AppState, AppStateStatus } from 'react-native';
import {
    notificationService,
    Notification,
    NotificationsListResponse,
    NotificationQueryParams,
} from '../services/notification.service';
import { storageService } from '../services/storage.service';
import { useAuth } from './AuthContext';

// Configure how notifications are handled when the app is in the foreground
ExpoNotifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

interface NotificationsContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    refreshing: boolean;
    hasMore: boolean;
    currentPage: number;
    totalPages: number;
    fetchNotifications: (refresh?: boolean) => Promise<void>;
    loadMoreNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    deleteAllNotifications: () => Promise<void>;
    refreshUnreadCount: () => Promise<void>;
    registerForPushNotifications: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const useNotifications = () => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationsProvider');
    }
    return context;
};

interface NotificationsProviderProps {
    children: ReactNode;
}

export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    const notificationListener = useRef<ExpoNotifications.EventSubscription | null>(null);
    const responseListener = useRef<ExpoNotifications.EventSubscription | null>(null);
    const appState = useRef(AppState.currentState);
    const fetchNotificationsRef = useRef<(refresh?: boolean) => Promise<void>>();

    // Register for push notifications (with retry)
    const registerForPushNotifications = useCallback(async (attempt: number = 1) => {
        const MAX_RETRIES = 3;

        if (!Device.isDevice) {
            console.log('[Notifications] Push notifications require a physical device');
            return;
        }

        try {
            const { status: existingStatus } =
                await ExpoNotifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await ExpoNotifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('[Notifications] Permission not granted');
                return;
            }

            // Get the Expo push token
            const projectId =
                process.env.EXPO_PUBLIC_PROJECT_ID ||
                Constants.expoConfig?.extra?.eas?.projectId;
            const tokenResponse = await ExpoNotifications.getExpoPushTokenAsync({
                projectId,
            });
            const expoPushToken = tokenResponse.data;
            console.log('[Notifications] Expo push token:', expoPushToken);

            // Register the token with our backend
            const accessToken = await storageService.getAccessToken();
            if (accessToken) {
                await notificationService.registerPushToken(expoPushToken, accessToken);
                console.log('[Notifications] Push token registered with backend');
            } else {
                console.log('[Notifications] No access token, skipping backend registration');
            }

            // Configure Android channel
            if (Platform.OS === 'android') {
                await ExpoNotifications.setNotificationChannelAsync('default', {
                    name: 'Default',
                    importance: ExpoNotifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    lightColor: '#BF9A54',
                });
            }
        } catch (error) {
            console.error(`[Notifications] Error registering for push (attempt ${attempt}):`, error);
            if (attempt < MAX_RETRIES) {
                const delay = attempt * 3000; // 3s, 6s
                console.log(`[Notifications] Retrying in ${delay / 1000}s...`);
                setTimeout(() => registerForPushNotifications(attempt + 1), delay);
            }
        }
    }, []);

    // Fetch notifications from the API
    const fetchNotifications = useCallback(
        async (refresh: boolean = false) => {
            try {
                if (refresh) {
                    setRefreshing(true);
                } else {
                    setLoading(true);
                }

                const token = await storageService.getAccessToken();
                if (!token) return;

                const params: NotificationQueryParams = {
                    page: 1,
                    limit: 20,
                };

                const response: NotificationsListResponse =
                    await notificationService.getNotifications(token, params);

                setNotifications(response.notifications);
                setUnreadCount(response.unreadCount);
                setCurrentPage(response.page);
                setTotalPages(response.totalPages);
                setHasMore(response.page < response.totalPages);
            } catch (error) {
                console.error('[Notifications] Error fetching notifications:', error);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        []
    );

    // Keep ref in sync so event listeners always have the latest function
    useEffect(() => {
        fetchNotificationsRef.current = fetchNotifications;
    }, [fetchNotifications]);

    // Load more notifications (pagination)
    const loadMoreNotifications = useCallback(async () => {
        if (!hasMore || loading) return;

        try {
            setLoading(true);
            const token = await storageService.getAccessToken();
            if (!token) return;

            const nextPage = currentPage + 1;
            const params: NotificationQueryParams = {
                page: nextPage,
                limit: 20,
            };

            const response: NotificationsListResponse =
                await notificationService.getNotifications(token, params);

            setNotifications((prev) => [...prev, ...response.notifications]);
            setUnreadCount(response.unreadCount);
            setCurrentPage(response.page);
            setTotalPages(response.totalPages);
            setHasMore(response.page < response.totalPages);
        } catch (error) {
            console.error('[Notifications] Error loading more notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [hasMore, loading, currentPage]);

    // Refresh just the unread count
    const refreshUnreadCount = useCallback(async () => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            const response = await notificationService.getUnreadCount(token);
            setUnreadCount(response.unreadCount);
        } catch (error) {
            console.error('[Notifications] Error refreshing unread count:', error);
        }
    }, []);

    // Mark single notification as read
    const markAsRead = useCallback(async (id: string) => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            await notificationService.markAsRead(id, token);

            // Update local state
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
        } catch (error) {
            console.error('[Notifications] Error marking as read:', error);
        }
    }, []);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async () => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            await notificationService.markAllAsRead(token);

            // Update local state
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('[Notifications] Error marking all as read:', error);
        }
    }, []);

    // Delete single notification
    const deleteNotification = useCallback(async (id: string) => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            await notificationService.deleteNotification(id, token);

            // Update local state
            setNotifications((prev) => {
                const notification = prev.find((n) => n.id === id);
                if (notification && !notification.read) {
                    setUnreadCount((count) => Math.max(0, count - 1));
                }
                return prev.filter((n) => n.id !== id);
            });
        } catch (error) {
            console.error('[Notifications] Error deleting notification:', error);
        }
    }, []);

    // Delete all notifications
    const deleteAllNotifications = useCallback(async () => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            await notificationService.deleteAllNotifications(token);

            // Update local state
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('[Notifications] Error deleting all notifications:', error);
        }
    }, []);

    // Set up push notification listeners (once — use refs to avoid stale closures)
    useEffect(() => {
        // Listener for notifications received while app is foregrounded
        notificationListener.current =
            ExpoNotifications.addNotificationReceivedListener((notification) => {
                console.log('[Notifications] Received:', notification);
                fetchNotificationsRef.current?.(true);
            });

        // Listener for when user taps on a notification
        responseListener.current =
            ExpoNotifications.addNotificationResponseReceivedListener((_response) => {
                fetchNotificationsRef.current?.(true);
            });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, []);

    // Refresh unread count when app comes to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener(
            'change',
            (nextAppState: AppStateStatus) => {
                if (
                    appState.current.match(/inactive|background/) &&
                    nextAppState === 'active'
                ) {
                    refreshUnreadCount();
                }
                appState.current = nextAppState;
            }
        );

        return () => {
            subscription.remove();
        };
    }, [refreshUnreadCount]);

    // Register push token and fetch unread count when auth state changes
    useEffect(() => {
        if (isAuthenticated) {
            registerForPushNotifications();
            refreshUnreadCount();
        } else {
            // User logged out — clear local notification state
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [isAuthenticated, registerForPushNotifications, refreshUnreadCount]);

    return (
        <NotificationsContext.Provider
            value={{
                notifications,
                unreadCount,
                loading,
                refreshing,
                hasMore,
                currentPage,
                totalPages,
                fetchNotifications,
                loadMoreNotifications,
                markAsRead,
                markAllAsRead,
                deleteNotification,
                deleteAllNotifications,
                refreshUnreadCount,
                registerForPushNotifications,
            }}
        >
            {children}
        </NotificationsContext.Provider>
    );
};
