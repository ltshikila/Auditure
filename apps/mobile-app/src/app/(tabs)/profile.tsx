import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Switch,
    TextInput,
    Alert,
    Modal,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { storageService } from '@/services/storage.service';
import {
    userService,
    UserProfile,
    UserSettings,
    Subscription,
    UpdateProfileData,
    UpdateSettingsData,
} from '@/services/user.service';
import { TopBar } from '@/components';
import { notificationService } from '@/services/notification.service';

type SettingItemProps = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
};

function SettingItem({ icon, label, value, onValueChange, disabled }: SettingItemProps) {
    return (
        <View className="flex-row items-center justify-between py-4 border-b border-gray-100">
            <View className="flex-row items-center flex-1">
                <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                    <Ionicons name={icon} size={16} color="#BF9A54" />
                </View>
                <Text className="font-inter text-gray-900 flex-1">{label}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: '#E5E7EB', true: '#BF9A54' }}
                thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                disabled={disabled}
            />
        </View>
    );
}

export default function Profile() {
    const { logout } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Edit profile state
    const [isEditing, setIsEditing] = useState(false);
    const [editFirstName, setEditFirstName] = useState('');
    const [editLastName, setEditLastName] = useState('');
    const [editDateOfBirth, setEditDateOfBirth] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchData = async (isRefreshing: boolean = false) => {
        try {
            if (isRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            const [profileData, settingsData, subscriptionData] = await Promise.all([
                userService.getProfile(token),
                userService.getSettings(token),
                userService.getSubscription(token),
            ]);

            setProfile(profileData);
            setSettings(settingsData);
            setSubscription(subscriptionData);

            // Initialize edit form with profile data
            setEditFirstName(profileData.firstName);
            setEditLastName(profileData.lastName);
            setEditDateOfBirth(profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : null);
        } catch (err: any) {
            console.error('Error fetching profile data:', err);
            setError(err.message || 'Failed to load profile');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, []),
    );

    const onRefresh = () => {
        fetchData(true);
    };

    const handleUpdateProfile = async () => {
        try {
            setSaving(true);
            const token = await storageService.getAccessToken();
            if (!token) return;

            const updateData: UpdateProfileData = {};
            if (editFirstName !== profile?.firstName) updateData.firstName = editFirstName;
            if (editLastName !== profile?.lastName) updateData.lastName = editLastName;
            if (editDateOfBirth) {
                const formattedDate = editDateOfBirth.toISOString().split('T')[0];
                if (formattedDate !== profile?.dateOfBirth?.split('T')[0]) {
                    updateData.dateOfBirth = formattedDate;
                }
            }

            if (Object.keys(updateData).length > 0) {
                const updatedProfile = await userService.updateProfile(token, updateData);
                setProfile(updatedProfile);
            }

            setIsEditing(false);
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateSetting = async (key: keyof UpdateSettingsData, value: boolean | number) => {
        try {
            const token = await storageService.getAccessToken();
            if (!token) return;

            // Optimistic update
            setSettings(prev => (prev ? { ...prev, [key]: value } : null));

            const updatedSettings = await userService.updateSettings(token, { [key]: value });
            setSettings(updatedSettings);
        } catch (err: any) {
            // Revert on error
            fetchData();
            Alert.alert('Error', err.message || 'Failed to update setting');
        }
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const token = await storageService.getAccessToken();
                        if (token) {
                            // Clear push token before logout
                            try {
                                await notificationService.clearPushToken(token);
                            } catch (e) {
                                console.log('Failed to clear push token:', e);
                            }
                            await userService.logout(token);
                        }
                        await logout();
                        router.replace('/(auth)/Auth');
                    } catch (err: any) {
                        console.error('Logout error:', err);
                        // Still logout locally even if server fails
                        await logout();
                        router.replace('/(auth)/Auth');
                    }
                },
            },
        ]);
    };

    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            Alert.alert('Error', 'Please enter your password to confirm');
            return;
        }

        try {
            setDeleteLoading(true);
            const token = await storageService.getAccessToken();
            if (!token) return;

            await userService.deleteAccount(token, { password: deletePassword });
            await logout();
            setShowDeleteModal(false);
            router.replace('/(auth)/Auth');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete account');
        } finally {
            setDeleteLoading(false);
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not set';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    };

    if (loading) {
        return (
            <SafeAreaView
                className="flex-1 bg-brand-beige items-center justify-center"
                edges={['top', 'left', 'right']}>
                <ActivityIndicator size="large" color="#BF9A54" />
                <Text className="font-inter text-gray-500 mt-4">Loading your profile...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-brand-beige" edges={['top', 'left', 'right']}>
            <TopBar />
            <KeyboardAwareScrollView
                contentContainerStyle={{ padding: 20, paddingBottom: 25 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#BF9A54"
                    />
                }
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                extraScrollHeight={20}>
                {/* Header */}
                <View className='pb-6'>
                    <Text className="font-inter-bold text-2xl text-brand-black">Profile</Text>
                    <Text className="font-jakarta text-brand-black text-sm">
                        Manage your account and preferences
                    </Text>
                </View>

                {/* Error Message */}
                {error && (
                    <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                        <Text className="font-inter text-red-800">{error}</Text>
                        <TouchableOpacity onPress={() => fetchData()} className="mt-2">
                            <Text className="font-inter-medium text-red-600">Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Profile Section */}
                <View
                    className="bg-[#F5F5F0] rounded-2xl p-5 mb-6"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        elevation: 8,
                    }}>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="font-inter-bold text-lg text-gray-900">
                            Personal Information
                        </Text>
                        {!isEditing ? (
                            <TouchableOpacity
                                onPress={() => setIsEditing(true)}
                                className="flex-row items-center">
                                <Ionicons name="pencil" size={16} color="#BF9A54" />
                                <Text className="font-inter-medium text-brand-gold ml-1">Edit</Text>
                            </TouchableOpacity>
                        ) : (
                            <View className="flex-row">
                                <TouchableOpacity
                                    onPress={() => {
                                        setIsEditing(false);
                                        setEditFirstName(profile?.firstName || '');
                                        setEditLastName(profile?.lastName || '');
                                        setEditDateOfBirth(
                                            profile?.dateOfBirth
                                                ? new Date(profile.dateOfBirth)
                                                : null,
                                        );
                                    }}
                                    className="mr-4">
                                    <Text className="font-inter-medium text-gray-500">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleUpdateProfile} disabled={saving}>
                                    <Text className="font-inter-medium text-brand-gold">
                                        {saving ? 'Saving...' : 'Save'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Avatar */}
                    <View className="items-center mb-6">
                        <View className="w-20 h-20 bg-brand-gold rounded-full items-center justify-center mb-2">
                            <Text className="font-jakarta-bold text-white text-2xl">
                                {profile?.firstName?.charAt(0).toUpperCase() || '?'}
                                {profile?.lastName?.charAt(0).toUpperCase() || ''}
                            </Text>
                        </View>
                        <Text className="font-inter text-gray-500">{profile?.email}</Text>
                        {profile?.isEmailVerified && (
                            <View className="flex-row items-center mt-1">
                                <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                                <Text className="font-inter text-xs text-green-600 ml-1">
                                    Verified
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Profile Fields */}
                    {isEditing ? (
                        <View>
                            <View className="mb-4">
                                <Text className="font-jakarta text-gray-700 mb-1 ml-1">
                                    First Name
                                </Text>
                                <TextInput
                                    value={editFirstName}
                                    onChangeText={setEditFirstName}
                                    className="bg-[#F1EEE3] rounded-xl py-4 px-4 font-inter text-gray-900"
                                    placeholder="First name"
                                    placeholderTextColor="#858585"
                                />
                            </View>
                            <View className="mb-4">
                                <Text className="font-jakarta text-gray-700 mb-1 ml-1">
                                    Last Name
                                </Text>
                                <TextInput
                                    value={editLastName}
                                    onChangeText={setEditLastName}
                                    className="bg-[#F1EEE3] rounded-xl py-4 px-4 font-inter text-gray-900"
                                    placeholder="Last name"
                                    placeholderTextColor="#858585"
                                />
                            </View>
                            <View className="mb-2">
                                <Text className="font-jakarta text-gray-700 mb-1 ml-1">
                                    Date of Birth
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    className="bg-[#F1EEE3] rounded-xl py-4 px-4 flex-row items-center justify-between">
                                    <Text
                                        className={`font-inter ${editDateOfBirth ? 'text-gray-900' : 'text-gray-400'}`}>
                                        {editDateOfBirth
                                            ? formatDate(editDateOfBirth.toISOString())
                                            : 'Select date'}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color="#858585" />
                                </TouchableOpacity>
                            </View>
                            {showDatePicker && (
                                <DateTimePicker
                                    value={editDateOfBirth || new Date(2000, 0, 1)}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(Platform.OS === 'ios');
                                        if (selectedDate) setEditDateOfBirth(selectedDate);
                                    }}
                                    maximumDate={new Date()}
                                    minimumDate={new Date(1900, 0, 1)}
                                />
                            )}
                        </View>
                    ) : (
                        <View>
                            <View className="flex-row justify-between py-3 border-b border-gray-100">
                                <Text className="font-inter text-gray-500">Name</Text>
                                <Text className="font-inter-medium text-gray-900">
                                    {profile?.firstName} {profile?.lastName}
                                </Text>
                            </View>
                            <View className="flex-row justify-between py-3 border-b border-gray-100">
                                <Text className="font-inter text-gray-500">Email</Text>
                                <Text className="font-inter-medium text-gray-900">
                                    {profile?.email}
                                </Text>
                            </View>
                            <View className="flex-row justify-between py-3">
                                <Text className="font-inter text-gray-500">Date of Birth</Text>
                                <Text className="font-inter-medium text-gray-900">
                                    {formatDate(profile?.dateOfBirth || null)}
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Subscription Section */}
                {subscription && (
                    <View
                        className="bg-[#F5F5F0] rounded-2xl p-5 mb-6"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                        <Text className="font-inter-bold text-lg text-gray-900 mb-4">
                            Subscription
                        </Text>

                        <View className="flex-row items-center mb-4">
                            <View
                                className={`px-3 py-1 rounded-full ${
                                    subscription.isPremium ? 'bg-brand-gold' : 'bg-gray-200'
                                }`}>
                                <Text
                                    className={`font-inter-bold text-sm ${
                                        subscription.isPremium ? 'text-white' : 'text-gray-700'
                                    }`}>
                                    {subscription.tier}
                                </Text>
                            </View>
                        </View>

                        <View className="bg-[#F5F5F0] rounded-xl p-4">
                            <Text className="font-inter-medium text-gray-700 mb-3">
                                Monthly Usage
                            </Text>

                            {/* Gemini Episodes */}
                            <View className="mb-3">
                                <View className="flex-row justify-between mb-1">
                                    <Text className="font-inter text-gray-600 text-sm">
                                        Gemini Episodes
                                    </Text>
                                    <Text className="font-inter text-gray-900 text-sm">
                                        {subscription.usage.geminiEpisodes.used}
                                        {subscription.usage.geminiEpisodes.limit !== null
                                            ? ` / ${subscription.usage.geminiEpisodes.limit}`
                                            : ' (Unlimited)'}
                                    </Text>
                                </View>
                                {subscription.usage.geminiEpisodes.limit !== null && (
                                    <View className="bg-gray-200 rounded-full h-2">
                                        <View
                                            className="bg-brand-gold rounded-full h-2"
                                            style={{
                                                width: `${Math.min(
                                                    (subscription.usage.geminiEpisodes.used /
                                                        subscription.usage.geminiEpisodes.limit) *
                                                        100,
                                                    100,
                                                )}%`,
                                            }}
                                        />
                                    </View>
                                )}
                            </View>

                            {/* Standard Episodes */}
                            <View>
                                <View className="flex-row justify-between mb-1">
                                    <Text className="font-inter text-gray-600 text-sm">
                                        Standard Episodes
                                    </Text>
                                    <Text className="font-inter text-gray-900 text-sm">
                                        {subscription.usage.standardEpisodes.used}
                                        {subscription.usage.standardEpisodes.limit !== null
                                            ? ` / ${subscription.usage.standardEpisodes.limit}`
                                            : ' (Unlimited)'}
                                    </Text>
                                </View>
                                {subscription.usage.standardEpisodes.limit !== null && (
                                    <View className="bg-gray-200 rounded-full h-2">
                                        <View
                                            className="bg-brand-gold rounded-full h-2"
                                            style={{
                                                width: `${Math.min(
                                                    (subscription.usage.standardEpisodes.used /
                                                        subscription.usage.standardEpisodes.limit) *
                                                        100,
                                                    100,
                                                )}%`,
                                            }}
                                        />
                                    </View>
                                )}
                            </View>

                            {/* Reset info - calculate days until next month */}
                            {!subscription.isPremium && (
                                <Text className="font-inter text-gray-500 text-xs mt-3">
                                    Resets{' '}
                                    {(() => {
                                        const periodStart = new Date(subscription.periodStart);
                                        const nextReset = new Date(
                                            periodStart.getFullYear(),
                                            periodStart.getMonth() + 1,
                                            periodStart.getDate(),
                                        );
                                        const daysUntilReset = Math.ceil(
                                            (nextReset.getTime() - Date.now()) /
                                                (1000 * 60 * 60 * 24),
                                        );
                                        return `in ${daysUntilReset} days`;
                                    })()}
                                </Text>
                            )}
                        </View>

                        {/* Manage Subscription Button */}
                        <TouchableOpacity
                            onPress={() => router.push('/subscription')}
                            className="mt-4 bg-brand-gold py-3 rounded-xl items-center">
                            <Text className="font-inter-medium text-white">
                                {subscription.isPremium ? 'Manage Subscription' : 'View Plans'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Notification Settings */}
                {settings && (
                    <View
                        className="bg-[#F5F5F0] rounded-2xl p-5 mb-6"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                        <Text className="font-inter-bold text-lg text-gray-900 mb-2">
                            Notifications
                        </Text>

                        <SettingItem
                            icon="notifications"
                            label="Push Notifications"
                            value={settings.pushNotificationsEnabled}
                            onValueChange={value =>
                                handleUpdateSetting('pushNotificationsEnabled', value)
                            }
                        />
                        <SettingItem
                            icon="mail"
                            label="Email Notifications"
                            value={settings.emailNotificationsEnabled}
                            onValueChange={value =>
                                handleUpdateSetting('emailNotificationsEnabled', value)
                            }
                        />
                        <SettingItem
                            icon="megaphone"
                            label="Marketing Emails"
                            value={settings.marketingEmailsEnabled}
                            onValueChange={value =>
                                handleUpdateSetting('marketingEmailsEnabled', value)
                            }
                        />
                    </View>
                )}

                {/* Privacy Settings */}
                {settings && (
                    <View
                        className="bg-[#F5F5F0] rounded-2xl p-5 mb-6"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                        <Text className="font-inter-bold text-lg text-gray-900 mb-2">Privacy</Text>

                        <SettingItem
                            icon="globe"
                            label="Public Profile"
                            value={settings.profilePublic}
                            onValueChange={value => handleUpdateSetting('profilePublic', value)}
                        />
                        <SettingItem
                            icon="eye"
                            label="Show Listening Activity"
                            value={settings.showListeningActivity}
                            onValueChange={value =>
                                handleUpdateSetting('showListeningActivity', value)
                            }
                        />
                    </View>
                )}

                {/* Playback Settings */}
                {settings && (
                    <View
                        className="bg-[#F5F5F0] rounded-2xl p-5 mb-6"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 10,
                            elevation: 8,
                        }}>
                        <Text className="font-inter-bold text-lg text-gray-900 mb-2">Playback</Text>

                        <SettingItem
                            icon="play-circle"
                            label="Auto-play Next Episode"
                            value={settings.autoPlayEnabled}
                            onValueChange={value => handleUpdateSetting('autoPlayEnabled', value)}
                        />
                        <SettingItem
                            icon="wifi"
                            label="Download Over Wi-Fi Only"
                            value={settings.downloadOverWifiOnly}
                            onValueChange={value =>
                                handleUpdateSetting('downloadOverWifiOnly', value)
                            }
                        />

                        {/* Playback Speed */}
                        <View className="py-4 border-b border-gray-100">
                            <View className="flex-row items-center mb-3">
                                <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                                    <Ionicons name="speedometer" size={16} color="#BF9A54" />
                                </View>
                                <Text className="font-inter text-gray-900">
                                    Default Playback Speed
                                </Text>
                            </View>
                            <View className="flex-row justify-around">
                                {[0.75, 1.0, 1.25, 1.5, 2.0].map(speed => (
                                    <TouchableOpacity
                                        key={speed}
                                        onPress={() => handleUpdateSetting('playbackSpeed', speed)}
                                        className={`px-4 py-2 rounded-full ${
                                            settings.playbackSpeed === speed
                                                ? 'bg-brand-gold'
                                                : 'bg-gray-100'
                                        }`}>
                                        <Text
                                            className={`font-inter-medium text-sm ${
                                                settings.playbackSpeed === speed
                                                    ? 'text-white'
                                                    : 'text-gray-700'
                                            }`}>
                                            {speed}x
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Account Actions */}
                <View
                    className="bg-[#F5F5F0] rounded-2xl p-5 mb-6"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 10,
                        elevation: 8,
                    }}>
                    <Text className="font-inter-bold text-lg text-gray-900 mb-4">Account</Text>

                    <TouchableOpacity
                        onPress={handleLogout}
                        className="flex-row items-center py-4 border-b border-gray-100">
                        <View className="w-8 h-8 bg-brand-gold/20 rounded-full items-center justify-center mr-3">
                            <Ionicons name="log-out" size={16} color="#BF9A54" />
                        </View>
                        <Text className="font-inter text-gray-900">Logout</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setShowDeleteModal(true)}
                        className="flex-row items-center py-4">
                        <View className="w-8 h-8 bg-red-100 rounded-full items-center justify-center mr-3">
                            <Ionicons name="trash" size={16} color="#EF4444" />
                        </View>
                        <Text className="font-inter text-red-600">Delete Account</Text>
                    </TouchableOpacity>
                </View>

                {/* App Info */}
                <View className="items-center py-4">
                    <Text className="font-inter text-gray-400 text-sm">Auditure v1.0.0</Text>
                    <Text className="font-inter text-gray-400 text-xs mt-1">
                        Member since{' '}
                        {profile?.createdAt
                            ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                                  month: 'long',
                                  year: 'numeric',
                              })
                            : 'N/A'}
                    </Text>
                </View>
            </KeyboardAwareScrollView>

            {/* Delete Account Modal */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}>
                <KeyboardAwareScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    enableOnAndroid={true}
                    extraScrollHeight={20}>
                    <View className="flex-1 bg-black/50 items-center justify-center px-6">
                        <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
                            <View className="items-center mb-4">
                                <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-4">
                                    <Ionicons name="warning" size={32} color="#EF4444" />
                                </View>
                                <Text className="font-inter-bold text-xl text-gray-900 text-center">
                                    Delete Account
                                </Text>
                                <Text className="font-inter text-gray-500 text-center mt-2">
                                    This action is permanent and cannot be undone. All your data
                                    will be deleted.
                                </Text>
                            </View>

                            <View className="mb-4">
                                <Text className="font-jakarta text-gray-700 mb-1 ml-1">
                                    Enter your password to confirm
                                </Text>
                                <TextInput
                                    value={deletePassword}
                                    onChangeText={setDeletePassword}
                                    secureTextEntry
                                    className="bg-[#F1EEE3] rounded-xl py-4 px-4 font-inter text-gray-900"
                                    placeholder="Password"
                                    placeholderTextColor="#858585"
                                />
                            </View>

                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowDeleteModal(false);
                                        setDeletePassword('');
                                    }}
                                    className="flex-1 py-4 rounded-xl bg-gray-100">
                                    <Text className="font-inter-medium text-gray-700 text-center">
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleDeleteAccount}
                                    disabled={deleteLoading}
                                    className="flex-1 py-4 rounded-xl bg-red-500">
                                    <Text className="font-inter-medium text-white text-center">
                                        {deleteLoading ? 'Deleting...' : 'Delete'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAwareScrollView>
            </Modal>
        </SafeAreaView>
    );
}
