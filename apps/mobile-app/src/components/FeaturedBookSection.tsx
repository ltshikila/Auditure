import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { BookFeedItem } from '@/services/feed.service';
import { FeaturedBookCard } from './FeaturedBookCard';

interface FeaturedBookSectionProps {
    title: string;
    books: BookFeedItem[];
    onBookPress: (book: BookFeedItem) => void;
    onSeeAll?: () => void;
    showSeeAll?: boolean;
}

export const FeaturedBookSection: React.FC<FeaturedBookSectionProps> = ({
    title,
    books,
    onBookPress,
    onSeeAll,
    showSeeAll = false,
}) => {
    if (books.length === 0) {
        return null;
    }

    return (
        <View className="mb-6">
            {/* Section Header */}
            <View className="flex-row items-center justify-between mb-3 px-6">
                <Text className="font-inter-medium text-lg text-brand-black dark:text-brand-dark-text">{title}</Text>
                {showSeeAll && onSeeAll && (
                    <TouchableOpacity onPress={onSeeAll}>
                        <Text className="font-inter text-sm text-brand-red">View all</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Horizontal Scroll */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 24 }}
            >
                {books.map((book) => (
                    <FeaturedBookCard
                        key={book.id}
                        book={book}
                        onPress={() => onBookPress(book)}
                    />
                ))}
            </ScrollView>
        </View>
    );
};
