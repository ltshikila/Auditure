import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BookFeedItem } from '@/services/feed.service';
import { resolveCoverUrl } from '@/services/api';

interface FeaturedBookCardProps {
    book: BookFeedItem;
    onPress: () => void;
}

export const FeaturedBookCard: React.FC<FeaturedBookCardProps> = ({
    book,
    onPress,
}) => {
    return (
        <View className="mr-4" style={{ width: 220 }}>
            <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
                {/* Card Container */}
                <View className="w-[220px] h-[300px] rounded-2xl overflow-hidden bg-brand-input shadow-md">
                    {/* Book Cover */}
                    {resolveCoverUrl(book.coverImageUrl) ? (
                        <Image
                            source={{ uri: resolveCoverUrl(book.coverImageUrl)! }}
                            style={{ width: 220, height: 300 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View className="w-full h-full bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 items-center justify-center">
                            <Text className="font-jakarta-bold text-brand-gold text-xl text-center px-4" numberOfLines={3}>
                                {book.title || 'Book'}
                            </Text>
                        </View>
                    )}

                    {/* Bottom Overlay */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
                        className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-16"
                    >
                        {/* Book Name */}
                        <Text className="font-inter-bold text-white text-base" numberOfLines={1}>
                            {book.title}
                        </Text>

                        {/* Author Name */}
                        <Text className="font-inter text-white/80 text-sm mt-1" numberOfLines={1}>
                            {book.author || 'Unknown Author'}
                        </Text>
                    </LinearGradient>
                </View>
            </TouchableOpacity>

        </View>
    );
};
