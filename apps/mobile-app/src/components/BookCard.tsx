import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { BookFeedItem } from '@/services/feed.service';
import { resolveCoverUrl } from '@/services/api';

interface BookCardProps {
    book: BookFeedItem;
    onPress: () => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onPress }) => {
    return (
        <TouchableOpacity
            onPress={onPress}
            className="mr-4"
            style={{ width: 110 }}
        >
            {/* Book Cover */}
            <View className="w-[110px] h-[160px] rounded-lg overflow-hidden bg-brand-input mb-2 shadow-sm items-center justify-center">
                {resolveCoverUrl(book.coverImageUrl) ? (
                    <Image
                        source={{ uri: resolveCoverUrl(book.coverImageUrl)! }}
                        style={{ width: 110, height: 160 }}
                        resizeMode="contain"
                    />
                ) : (
                    <View className="w-full h-full bg-gradient-to-b from-brand-gold/30 to-brand-gold/10 items-center justify-center">
                        <Text className="font-jakarta-bold text-brand-gold text-lg text-center px-2" numberOfLines={3}>
                            {book.title || 'Book'}
                        </Text>
                    </View>
                )}
            </View>

            {/* Book Title */}
            <Text className="font-inter-medium text-[#1A1C1E] text-sm" numberOfLines={1}>
                {book.title}
            </Text>

            {/* Author */}
            <Text className="font-inter text-[#858585] text-xs" numberOfLines={1}>
                {book.author || 'Unknown Author'}
            </Text>

            {/* Episode count */}
            {book.episodeCount !== undefined && book.episodeCount > 0 && (
                <Text className="font-inter text-brand-gold text-xs mt-0.5">
                    {book.episodeCount} episode{book.episodeCount !== 1 ? 's' : ''}
                </Text>
            )}
        </TouchableOpacity>
    );
};
