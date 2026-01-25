import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '@/contexts/NotificationsContext';

const logoIcon = require('@/assets/icons/logo.png');
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
        <View style={styles.container}>
            {/* Left side - Logo/Back button */}
            <View style={styles.leftSection}>
                {showBackButton ? (
                    <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#1A1C1E" />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.logoContainer}>
                        <Image source={logoIcon} style={styles.logo} resizeMode="contain" />
                        <Text style={styles.brandText}>Auditure</Text>
                    </View>
                )}
                {title && showBackButton && (
                    <Text style={styles.titleText}>{title}</Text>
                )}
            </View>

            {/* Right side - Notifications and Search */}
            <View style={styles.rightSection}>
                <TouchableOpacity
                    onPress={handleNotificationsPress}
                    style={styles.iconButton}
                >
                    <Image source={notificationIcon} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
                    {unreadCount > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSearchPress} style={styles.iconButton}>
                    <Image source={searchIcon} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: '#FBF8F2',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        width: 32,
        height: 32,
        marginRight: 8,
    },
    brandText: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 22,
        color: '#1A1C1E',
        letterSpacing: -0.5,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: -8,
    },
    titleText: {
        fontFamily: 'PlusJakartaSans_700Bold',
        fontSize: 18,
        color: '#1A1C1E',
        marginLeft: 4,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    iconButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: '#8B0000',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontFamily: 'Inter_700Bold',
        fontSize: 10,
        color: '#FFFFFF',
    },
});

export default TopBar;
