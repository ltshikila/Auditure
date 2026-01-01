import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface ProfilePictureInputProps {
    imageUri: string | null;
    onImageSelected: (uri: string) => void;
}

export const ProfilePictureInput: React.FC<ProfilePictureInputProps> = ({
    imageUri,
    onImageSelected,
}) => {
    const pickImage = async () => {
        // Request permissions
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            alert('Sorry, we need camera roll permissions to select a profile picture.');
            return;
        }

        // Launch image picker
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            onImageSelected(result.assets[0].uri);
        }
    };

    return (
        <View className="mb-6">
            <Text className="font-inter-medium text-base text-[#1A1C1E] mb-3">
                Profile Picture
            </Text>
            <TouchableOpacity
                onPress={pickImage}
                className="items-center justify-center"
                activeOpacity={0.7}>
                <View
                    className="w-32 h-32 rounded-full bg-[#F5F5F0] items-center justify-center border-2 border-dashed border-[#E8E3D6]"
                    style={{
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 4,
                        elevation: 2,
                    }}>
                    {imageUri ? (
                        <Image
                            source={{ uri: imageUri }}
                            className="w-full h-full rounded-full"
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="items-center">
                            <Ionicons name="camera" size={32} color="#C9C3B0" />
                            <Text className="font-inter text-xs text-[#8C8577] mt-2">
                                Add Photo
                            </Text>
                        </View>
                    )}
                </View>
                {imageUri && (
                    <View className="absolute bottom-0 right-[calc(50%-64px)] w-10 h-10 rounded-full bg-brand-gold items-center justify-center"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 4,
                            elevation: 4,
                        }}>
                        <Ionicons name="pencil" size={18} color="#FFFFFF" />
                    </View>
                )}
            </TouchableOpacity>
            <Text className="font-inter text-xs text-[#8C8577] text-center mt-2">
                Optional - Upload a profile picture for your podcaster
            </Text>
        </View>
    );
};
