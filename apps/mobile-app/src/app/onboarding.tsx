import React, { useState, useRef, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Image,
    Dimensions,
    ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { storageService } from '@/services/storage.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
    id: string;
    image: any;
    headline: string;
    description: string;
}

const slides: OnboardingSlide[] = [
    {
        id: '1',
        image: require('../assets/icons/onboarding_1.png'),
        headline: 'Create Your Own\nAI Podcaster',
        description:
            'Design an AI podcaster with its own voice and personality. No mic, no editing, no experience needed — just your ideas.',
    },
    {
        id: '2',
        image: require('../assets/icons/onboarding_2.png'),
        headline: 'Turn Books Into\nPodcasts',
        description:
            "Upload any book and your AI podcaster turns it into engaging audio episodes. Listen on your commute, at the gym, or wherever you go.",
    },
    {
        id: '3',
        image: require('../assets/icons/onboarding_3.png'),
        headline: 'Join the\nCommunity',
        description:
            "Explore what other AI podcasters are creating. Like, comment, rate, and share episodes with a growing community of listeners and creators.",
    },
];

export default function OnboardingScreen() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const onViewableItemsChanged = useRef(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (viewableItems.length > 0 && viewableItems[0].index !== null) {
                setCurrentIndex(viewableItems[0].index);
            }
        }
    ).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const handleComplete = useCallback(async () => {
        await storageService.setHasSeenOnboarding();
        router.replace('/(auth)/Auth');
    }, []);

    const handleNext = useCallback(() => {
        if (currentIndex < slides.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        }
    }, [currentIndex]);

    const renderSlide = ({ item }: { item: OnboardingSlide }) => (
        <View style={{ width: SCREEN_WIDTH }} className="flex-1 items-center justify-center px-8">
            {/* Illustration */}
            <Image
                source={item.image}
                style={{ width: 200, height: 200 }}
                resizeMode="contain"
                className="mb-10"
            />

            {/* Headline */}
            <Text className="font-jakarta-bold text-3xl text-brand-black text-center mb-4">
                {item.headline}
            </Text>

            {/* Description */}
            <Text className="font-inter text-base text-[#6C7278] text-center leading-6 px-4">
                {item.description}
            </Text>
        </View>
    );

    const isLastSlide = currentIndex === slides.length - 1;

    return (
        <SafeAreaView className="flex-1 bg-brand-beige">
            {/* Top area: Logo + Skip button */}
            <View className="flex-row items-center justify-between px-6 pt-2">
                <Image
                    source={require('../assets/icons/logo_1_hd.png')}
                    style={{ width: 48, height: 48 }}
                    resizeMode="contain"
                />
                {!isLastSlide ? (
                    <TouchableOpacity onPress={handleComplete} className="py-2 px-4">
                        <Text className="font-jakarta-medium text-base text-brand-gold">
                            Skip
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <View className="py-2 px-4">
                        <Text className="text-transparent text-base">Skip</Text>
                    </View>
                )}
            </View>

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={slides}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
            />

            {/* Bottom area: Dots + Button */}
            <View className="items-center pb-8 px-6">
                {/* Dot indicators */}
                <View className="flex-row items-center justify-center mb-8">
                    {slides.map((_, index) => (
                        <View
                            key={index}
                            className={`mx-1 rounded-full ${index === currentIndex
                                ? 'bg-brand-red'
                                : 'bg-[#D9D5CC]'
                                }`}
                            style={{
                                width: index === currentIndex ? 24 : 8,
                                height: 8,
                            }}
                        />
                    ))}
                </View>

                {/* Action button */}
                <TouchableOpacity
                    onPress={isLastSlide ? handleComplete : handleNext}
                    className="bg-brand-red w-full py-4 rounded-xl items-center"
                >
                    <Text className="text-white font-inter-medium text-base">
                        {isLastSlide ? 'Get Started' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
