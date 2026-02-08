import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAlert } from '@/contexts/AlertContext';
import { resolveCoverUrl } from '@/services/api';

interface ProfilePictureInputProps {
    imageUri: string | null;
    onImageSelected: (uri: string) => void;
    onImageRemoved?: () => void;
}

export const ProfilePictureInput: React.FC<ProfilePictureInputProps> = ({
    imageUri,
    onImageSelected,
    onImageRemoved,
}) => {
    const { showAlert } = useAlert();

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            showAlert({ title: 'Permission Required', message: 'Sorry, we need camera roll permissions to select a profile picture.' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            onImageSelected(result.assets[0].uri);
        }
    };

    // imageUri can be a local file:// URI (from picker) or a server path (/api/storage/...)
    const resolvedUri = imageUri?.startsWith('file://') || imageUri?.startsWith('content://')
        ? imageUri
        : resolveCoverUrl(imageUri);

    const handlePress = () => {
        if (resolvedUri) {
            showAlert({
                title: 'Profile Picture',
                message: 'What would you like to do?',
                buttons: [
                    { text: 'Choose New Photo', onPress: pickImage },
                    ...(onImageRemoved
                        ? [{ text: 'Remove Photo', onPress: onImageRemoved, style: 'destructive' as const }]
                        : []),
                    { text: 'Cancel', style: 'cancel' as const },
                ],
            });
        } else {
            pickImage();
        }
    };

    return (
        <View className="mb-6">
            {/* <Text className="font-inter-medium text-lg text-[#1A1C1E] mb-4">
                Profile Picture
            </Text> */}
            <View className="items-center">
                <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
                    <View className="w-24 h-24 rounded-full items-center justify-center overflow-hidden bg-[#E8E3D6] mb-2">
                        {resolvedUri ? (
                            <Image
                                key={resolvedUri}
                                source={{ uri: resolvedUri, cache: 'reload' }}
                                style={{ width: 96, height: 96 }}
                                resizeMode="cover"
                            />
                        ) : (
                            <Image
                                source={require('../assets/icons/podcast.png')}
                                style={{ width: 40, height: 40, tintColor: '#BF9A54' }}
                                resizeMode="contain"
                            />
                        )}
                    </View>
                    {/* Camera badge */}
                    <View className="absolute bottom-1 right-0 w-8 h-8 rounded-full bg-[#920002] items-center justify-center border-2 border-brand-beige">
                        <Ionicons name="camera" size={14} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>
            </View>
        </View>
    );
};
