import React, { useEffect, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/contexts/NotificationsContext';
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
            return '#3B82F6';
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
            onLongPress={() => {
                Alert.alert(
                    'Delete Notification',
                    'Are you sure you want to delete this notification?',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: onDelete },
                    ]
                );
            }}
            className={`flex-row p-4 border-b border-gray-100 ${
                !notification.read ? 'bg-[#FBF8F2]' : 'bg-white'
            }`}
        >
            {/* Icon */}
            <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: `${iconColor}20` }}
            >
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>

            {/* Content */}
            <View className="flex-1">
                <View className="flex-row items-center justify-between mb-1">
                    <Text
                        className={`font-jakarta-medium text-base ${
                            !notification.read ? 'text-gray-900' : 'text-gray-700'
                        }`}
                        numberOfLines={1}
                    >
                        {notification.title}
                    </Text>
                    <Text className="font-inter text-xs text-gray-400">
                        {formatTimeAgo(notification.createdAt)}
                    </Text>
                </View>
                <Text
                    className="font-inter text-sm text-gray-500"
                    numberOfLines={2}
                >
                    {notification.body}
                </Text>
            </View>

            {/* Unread indicator */}
            {!notification.read && (
                <View className="w-2 h-2 bg-brand-red rounded-full ml-2 mt-2" />
            )}
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

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications(true);
        }, [fetchNotifications])
    );

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            await markAsRead(notification.id);
        }

        // Navigate based on notification data
        if (notification.data?.route) {
            router.push(notification.data.route as any);
        } else if (notification.data?.episodeId) {
            router.push(`/episodes/${notification.data.episodeId}` as any);
        }
    };

    const handleMarkAllAsRead = () => {
        if (unreadCount === 0) return;
        Alert.alert(
            'Mark All as Read',
            'Mark all notifications as read?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark All', onPress: markAllAsRead },
            ]
        );
    };

    const handleClearAll = () => {
        if (notifications.length === 0) return;
        Alert.alert(
            'Clear All Notifications',
            'Are you sure you want to delete all notifications?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear All', style: 'destructive', onPress: deleteAllNotifications },
            ]
        );
    };

    const renderItem = ({ item }: { item: Notification }) => (
        <NotificationItem
            notification={item}
            onPress={() => handleNotificationPress(item)}
            onDelete={() => deleteNotification(item.id)}
        />
    );

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View className="flex-1 items-center justify-center py-20">
                <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-4">
                    <Ionicons name="notifications-off-outline" size={48} color="#9CA3AF" />
                </View>
                <Text className="font-jakarta-bold text-xl text-gray-900 mb-2">
                    No notifications
                </Text>
                <Text className="font-inter text-gray-500 text-center px-8">
                    You're all caught up! New notifications will appear here.
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
        <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="w-10 h-10 items-center justify-center -ml-2"
                    >
                        <Ionicons name="chevron-back" size={24} color="#1A1C1E" />
                    </TouchableOpacity>
                    <Text className="font-jakarta-bold text-xl text-gray-900 ml-2">
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
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#BF9A54" />
                    <Text className="font-inter text-gray-500 mt-4">
                        Loading notifications...
                    </Text>
                </View>
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
                        notifications.length === 0 ? { flex: 1 } : undefined
                    }
                />
            )}
        </SafeAreaView>
    );
}
