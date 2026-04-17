import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useColors } from '@/hooks/use-colors';

const logoIcon = require('@/assets/icons/logo_1_hd.png');
const notificationIcon = require('@/assets/icons/notification.png');
const searchIcon = require('@/assets/icons/search-normal.png');
const backIcon = require('@/assets/icons/back.png');

interface TopBarProps {
    showBackButton?: boolean;
    title?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ showBackButton = false, title }) => {
    const { unreadCount } = useNotifications();
    const colors = useColors();
    const iconTint = colors.text;

    const handleNotificationsPress = () => {
        router.push('/notifications');
    };

    const handleSearchPress = () => {
        router.push('/search');
    };

    const handleBackPress = () => {
        router.back();
    };

    return (
        <View className="flex-row items-center justify-between px-4 mt-2 bg-brand-beige dark:bg-brand-dark-bg">
            {/* Left side - Logo/Back button */}
            <View className="flex-row items-center flex-1">
                {showBackButton ? (
                    <TouchableOpacity onPress={handleBackPress} className="w-10 h-10 justify-center items-center -ml-2">
                        <Image source={backIcon} style={{ width: 24, height: 24, tintColor: iconTint }} />
                    </TouchableOpacity>
                ) : (
                    <View className="flex-row items-center">
                        <Image source={logoIcon} className="w-12 h-12" resizeMode="contain" />
                        <Text className="font-dm-serif text-3xl text-gray-800 dark:text-brand-dark-text tracking-tight">Auditure</Text>
                    </View>
                )}
                {title && showBackButton && (
                    <Text className="font-jakarta-bold text-lg text-gray-800 dark:text-brand-dark-text ml-1">{title}</Text>
                )}
            </View>

            {/* Right side - Notifications and Search */}
            <View className="flex-row items-center gap-1">
                <TouchableOpacity
                    onPress={handleNotificationsPress}
                    className="w-11 h-11 justify-center items-center relative"
                >
                    <Image source={notificationIcon} className="w-8 h-8" style={{ tintColor: iconTint }} />
                    {unreadCount > 0 && (
                        <View className="absolute top-1.5 right-1.5 bg-brand-red rounded-full min-w-[18px] h-[18px] justify-center items-center px-1">
                            <Text className="font-inter-bold text-[10px] text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSearchPress} className="w-11 h-11 justify-center items-center">
                    <Image source={searchIcon} className="w-8 h-8" style={{ tintColor: iconTint }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default TopBar;
