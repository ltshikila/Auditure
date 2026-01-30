import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/contexts/NotificationsContext';

const logoIcon = require('@/assets/icons/logo_1.png');
const notificationIcon = require('@/assets/icons/notification.png');
const searchIcon = require('@/assets/icons/search-normal.png');

interface TopBarProps {
    showBackButton?: boolean;
    title?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ showBackButton = false, title }) => {
    const { unreadCount } = useNotifications();

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
        <View className="flex-row items-center justify-between px-4 mt-2 bg-brand-beige">
            {/* Left side - Logo/Back button */}
            <View className="flex-row items-center flex-1">
                {showBackButton ? (
                    <TouchableOpacity onPress={handleBackPress} className="w-10 h-10 justify-center items-center -ml-2">
                        <Ionicons name="chevron-back" size={24} color="#1A1C1E" />
                    </TouchableOpacity>
                ) : (
                    <View className="flex-row items-center">
                        <Image source={logoIcon} className="w-12 h-12" resizeMode="contain" />
                        <Text className="font-dm-serif text-3xl text-gray-800 tracking-tight">Auditure</Text>
                    </View>
                )}
                {title && showBackButton && (
                    <Text className="font-jakarta-bold text-lg text-gray-800 ml-1">{title}</Text>
                )}
            </View>

            {/* Right side - Notifications and Search */}
            <View className="flex-row items-center gap-1">
                <TouchableOpacity
                    onPress={handleNotificationsPress}
                    className="w-11 h-11 justify-center items-center relative"
                >
                    <Image source={notificationIcon} className="w-8 h-8" style={{ tintColor: '#1A1C1E' }} />
                    {unreadCount > 0 && (
                        <View className="absolute top-1.5 right-1.5 bg-brand-red rounded-full min-w-[18px] h-[18px] justify-center items-center px-1">
                            <Text className="font-inter-bold text-[10px] text-white">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSearchPress} className="w-11 h-11 justify-center items-center">
                    <Image source={searchIcon} className="w-8 h-8" style={{ tintColor: '#1A1C1E' }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default TopBar;
