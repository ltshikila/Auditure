import React, { useEffect, useCallback, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Modal,
    ScrollView,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useAlert } from '@/contexts/AlertContext';
import { NotificationsSkeleton } from '@/components/skeleton';
import { Notification, NotificationType } from '@/services/notification.service';

const getNotificationIcon = (type: NotificationType): keyof typeof Ionicons.glyphMap => {
    switch (type) {
        case 'EPISODE_READY':
            return 'checkmark-circle';
        case 'EPISODE_FAILED':
            return 'alert-circle';
        case 'NEW_COMMENT':
            return 'chatbubble';
        case 'NEW_RATING':
            return 'star';
        case 'SUBSCRIPTION_WARNING':
            return 'warning';
        case 'SYSTEM':
        default:
            return 'notifications';
    }
};

const getNotificationColor = (type: NotificationType): string => {
    switch (type) {
        case 'EPISODE_READY':
            return '#22C55E';
        case 'EPISODE_FAILED':
            return '#EF4444';
        case 'NEW_COMMENT':
            return '#BF9A54';
        case 'NEW_RATING':
            return '#BF9A54';
        case 'SUBSCRIPTION_WARNING':
            return '#F59E0B';
        case 'SYSTEM':
        default:
            return '#6B7280';
    }
};

const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
        return 'Just now';
    }
    if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    }
    if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    }
    if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    }

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
};

interface NotificationItemProps {
    notification: Notification;
    onPress: () => void;
    onDelete: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
    notification,
    onPress,
    onDelete,
}) => {
    const iconColor = getNotificationColor(notification.type);
    const icon = getNotificationIcon(notification.type);

    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onDelete}
            className={`flex-row p-4 mx-4 mb-3 rounded-2xl ${
                !notification.read ? 'bg-white dark:bg-brand-dark-surface' : 'bg-[#F5F5F0] dark:bg-brand-dark-surface'
            }`}
            style={{
                shadowColor: !notification.read ? '#000' : 'transparent',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: !notification.read ? 0.08 : 0,
                shadowRadius: 8,
                elevation: !notification.read ? 4 : 0,
            }}
        >
            {/* Unread indicator */}
            {!notification.read && (
                <View className="absolute left-0 top-4 bottom-4 w-1 bg-brand-gold rounded-r-full" />
            )}

            {/* Icon */}
            <View
                className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                style={{ backgroundColor: `${iconColor}15` }}
            >
                <Ionicons name={icon} size={24} color={iconColor} />
            </View>

            {/* Content */}
            <View className="flex-1">
                <View className="flex-row items-start justify-between mb-1">
                    <Text
                        className={`font-inter-bold text-base flex-1 mr-2 ${
                            !notification.read ? 'text-brand-black dark:text-brand-dark-text' : 'text-gray-600 dark:text-brand-dark-text-secondary'
                        }`}
                        numberOfLines={1}
                    >
                        {notification.title}
                    </Text>
                    <Text className="font-inter text-xs text-brand-gold">
                        {formatTimeAgo(notification.createdAt)}
                    </Text>
                </View>
                <Text
                    className={`font-inter text-sm ${!notification.read ? 'text-gray-600 dark:text-brand-dark-text-secondary' : 'text-gray-400 dark:text-brand-dark-text-muted'}`}
                    numberOfLines={2}
                >
                    {notification.body}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

export default function NotificationsScreen() {
    const {
        notifications,
        unreadCount,
        loading,
        refreshing,
        hasMore,
        fetchNotifications,
        loadMoreNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        deleteAllNotifications,
    } = useNotifications();
    const { showAlert } = useAlert();
    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications(true);
        }, [fetchNotifications])
    );

    const handleNotificationPress = async (notification: Notification) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }
        setSelectedNotification(notification);
    };

    const handleMarkAllAsRead = () => {
        if (unreadCount === 0) return;
        showAlert({
            title: 'Mark All as Read',
            message: 'Mark all notifications as read?',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark All', onPress: markAllAsRead },
            ],
        });
    };

    const handleClearAll = () => {
        if (notifications.length === 0) return;
        showAlert({
            title: 'Clear All Notifications',
            message: 'Are you sure you want to delete all notifications?',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear All', style: 'destructive', onPress: deleteAllNotifications },
            ],
        });
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onDelete={() => {
                showAlert({
                    title: 'Delete Notification',
                    message: 'Are you sure you want to delete this notification?',
                    buttons: [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(item.id) },
                    ],
                });
            }}
        />
    );

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View className="flex-1 items-center justify-center px-8">
                <View className="w-28 h-28 bg-brand-gold/10 rounded-full items-center justify-center mb-6">
                    <View className="w-20 h-20 bg-brand-gold/20 rounded-full items-center justify-center">
                        <Ionicons name="notifications-outline" size={40} color="#BF9A54" />
                    </View>
                </View>
                <Text className="font-inter-bold text-2xl text-brand-black dark:text-brand-dark-text mb-3">
                    All caught up!
                </Text>
                <Text className="font-jakarta text-gray-500 dark:text-brand-dark-text-muted text-center text-base leading-6">
                    You have no new notifications.{'\n'}We&apos;ll let you know when something arrives.
                </Text>
            </View>
        );
    };

    const renderFooter = () => {
        if (!hasMore || !loading) return null;
        return (
            <View className="py-4 items-center">
                <ActivityIndicator size="small" color="#BF9A54" />
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10">
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center -ml-2"
                    >
                        <Image source={require('../../assets/icons/back.png')} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
                    </TouchableOpacity>
                    <Text className="font-jakarta-bold text-xl text-gray-900 dark:text-brand-dark-text ml-2">
                        Notifications
                    </Text>
                    {unreadCount > 0 && (
                        <View className="bg-brand-red px-2 py-0.5 rounded-full ml-2">
                            <Text className="font-inter-bold text-xs text-white">
                                {unreadCount}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Actions */}
                <View className="flex-row items-center">
                    {unreadCount > 0 && (
                        <TouchableOpacity
                            onPress={handleMarkAllAsRead}
                            className="px-3 py-1.5 mr-2"
                        >
                            <Text className="font-inter-medium text-sm text-brand-gold">
                                Mark all read
                            </Text>
                        </TouchableOpacity>
                    )}
                    {notifications.length > 0 && (
                        <TouchableOpacity
                            onPress={handleClearAll}
                            className="w-10 h-10 items-center justify-center"
                        >
                            <Ionicons name="trash-outline" size={20} color="#6B7280" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Loading state */}
            {loading && notifications.length === 0 ? (
                <NotificationsSkeleton />
            ) : (
                <FlatList
                    data={notifications}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    ListEmptyComponent={renderEmpty}
                    ListFooterComponent={renderFooter}
                    onEndReached={loadMoreNotifications}
                    onEndReachedThreshold={0.3}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchNotifications(true)}
                            tintColor="#BF9A54"
                        />
                    }
                    contentContainerStyle={
                        notifications.length === 0 ? { flex: 1 } : { paddingTop: 12 }
                    }
                />
            )}

            {/* Notification Detail Modal */}
            <Modal
                visible={!!selectedNotification}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedNotification(null)}
            >
                <Pressable
                    className="flex-1 bg-black/50 justify-end"
                    onPress={() => setSelectedNotification(null)}
                >
                    <Pressable
                        className="bg-brand-beige dark:bg-brand-dark-bg rounded-t-3xl max-h-[70%]"
                        onPress={() => {}}
                    >
                        {selectedNotification && (
                            <>
                                {/* Handle bar */}
                                <View className="items-center pt-3 pb-2">
                                    <View className="w-10 h-1 bg-gray-300 rounded-full" />
                                </View>

                                <ScrollView className="px-6 pb-8" bounces={false}>
                                    {/* Icon + Type */}
                                    <View className="flex-row items-center mb-4 mt-2">
                                        <View
                                            className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                                            style={{ backgroundColor: `${getNotificationColor(selectedNotification.type)}15` }}
                                        >
                                            <Ionicons
                                                name={getNotificationIcon(selectedNotification.type)}
                                                size={24}
                                                color={getNotificationColor(selectedNotification.type)}
                                            />
                                        </View>
                                        <Text className="font-inter text-xs text-gray-400 dark:text-brand-dark-text-muted">
                                            {formatTimeAgo(selectedNotification.createdAt)}
                                        </Text>
                                    </View>

                                    {/* Title */}
                                    <Text className="font-inter-bold text-xl text-brand-black dark:text-brand-dark-text mb-3">
                                        {selectedNotification.title}
                                    </Text>

                                    {/* Body */}
                                    <Text className="font-inter text-base text-gray-600 dark:text-brand-dark-text-secondary leading-6 mb-6">
                                        {selectedNotification.body}
                                    </Text>
                                </ScrollView>

                                {/* Dismiss button */}
                                <View className="px-6 pb-8">
                                    <TouchableOpacity
                                        onPress={() => setSelectedNotification(null)}
                                        className="bg-[#F5F5F0] dark:bg-brand-dark-surface py-3.5 rounded-xl items-center"
                                    >
                                        <Text className="font-inter-medium text-gray-600 dark:text-brand-dark-text-secondary">Dismiss</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}
