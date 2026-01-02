import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PodcasterSelector } from '@/components/PodcasterSelector';
import { InfoTooltip } from '@/components/InfoTooltip';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { episodeService, EpisodeType, EpisodeTheme, ContentCoverage } from '@/services/episode.service';
import { storageService } from '@/services/storage.service';
import Slider from '@react-native-community/slider';

type TabOption<T> = {
    value: T;
    label: string;
};

const Create = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Podcasters
    const [podcasters, setPodcasters] = useState<Podcaster[]>([]);

    // Form state
    const [bookSearch, setBookSearch] = useState('');
    const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
    const [selectedPodcasterId, setSelectedPodcasterId] = useState<string | null>(null);
    const [episodeTitle, setEpisodeTitle] = useState('');
    const [contentCoverage, setContentCoverage] = useState<ContentCoverage>('ENTIRE_BOOK');
    const [chapters, setChapters] = useState('');
    const [episodeType, setEpisodeType] = useState<EpisodeType>('MONOLOGUE');
    const [episodeTheme, setEpisodeTheme] = useState<EpisodeTheme>('LECTURE');
    const [targetLengthMin, setTargetLengthMin] = useState(10);
    const [targetLengthMax, setTargetLengthMax] = useState(66);

    // Content coverage options
    const contentCoverageOptions: TabOption<ContentCoverage>[] = [
        { value: 'ENTIRE_BOOK', label: 'Entire Book' },
        { value: 'MULTIPLE_CHAPTERS', label: 'Multiple Chapters' },
        { value: 'SINGLE_CHAPTER', label: 'Single Chapter' },
    ];

    // Episode type options with descriptions
    const episodeTypeOptions: TabOption<EpisodeType>[] = [
        { value: 'MONOLOGUE', label: 'Monologue' },
        { value: 'DUO', label: 'Duo' },
        { value: 'GROUP', label: 'Group' },
    ];

    const episodeTypeDescriptions: Record<EpisodeType, string> = {
        MONOLOGUE: 'A podcast episode with just your virtual podcaster speaking. Catered to more of a lecture format podcast.',
        DUO: 'A conversation between two speakers - your podcaster and a generated guest. Great for discussions and interviews.',
        GROUP: 'A multi-person discussion with your podcaster and multiple guests. Perfect for debates and panel discussions.',
    };

    // Episode theme options with descriptions
    const episodeThemeOptions: TabOption<EpisodeTheme>[] = [
        { value: 'LECTURE', label: 'Lecture' },
        { value: 'DISCUSSION', label: 'Discussion' },
        { value: 'DEBATE', label: 'Debate' },
    ];

    const episodeThemeDescriptions: Record<EpisodeTheme, string> = {
        LECTURE: 'A podcast episode meant to approach content in a more educational approach, best for studying purposes.',
        DISCUSSION: 'An exploratory conversation about the book\'s themes, ideas, and insights with collaborative analysis.',
        DEBATE: 'A structured argument format exploring different perspectives and viewpoints on the book\'s content.',
    };

    // Load user's podcasters
    useEffect(() => {
        const loadPodcasters = async () => {
            try {
                const token = await storageService.getAccessToken();
                if (!token) {
                    router.replace('/(auth)/Auth');
                    return;
                }
                const myPodcasters = await podcasterService.getMyPodcasters(token);
                setPodcasters(myPodcasters);
                if (myPodcasters.length > 0) {
                    setSelectedPodcasterId(myPodcasters[0].id);
                }
            } catch (error) {
                console.error('Failed to load podcasters:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadPodcasters();
    }, []);

    // Parse chapters input
    const parseChapters = (input: string): number[] => {
        if (!input.trim()) return [];
        return input
            .split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n) && n > 0);
    };

    // Render tab selector
    const renderTabSelector = <T extends string>(
        options: TabOption<T>[],
        selected: T,
        onSelect: (value: T) => void
    ) => (
        <View className="flex-row border-b border-[#E8E3D6]">
            {options.map((option) => (
                <TouchableOpacity
                    key={option.value}
                    onPress={() => onSelect(option.value)}
                    className={`flex-1 pb-3 items-center ${
                        selected === option.value ? 'border-b-2 border-brand-gold' : ''
                    }`}
                >
                    <Text
                        className={`font-inter text-sm ${
                            selected === option.value ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E]'
                        }`}
                    >
                        {option.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    const handleCreate = async () => {
        // Validation
        if (!selectedBookId) {
            Alert.alert('Validation Error', 'Please select a book');
            return;
        }

        if (!selectedPodcasterId) {
            Alert.alert('Validation Error', 'Please select a virtual podcaster');
            return;
        }

        if (!episodeTitle.trim()) {
            Alert.alert('Validation Error', 'Please enter an episode title');
            return;
        }

        if (contentCoverage !== 'ENTIRE_BOOK' && parseChapters(chapters).length === 0) {
            Alert.alert('Validation Error', 'Please enter chapter numbers');
            return;
        }

        if (targetLengthMin >= targetLengthMax) {
            Alert.alert('Validation Error', 'Minimum length must be less than maximum length');
            return;
        }

        try {
            setIsSubmitting(true);

            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            await episodeService.create(
                {
                    bookId: selectedBookId,
                    podcasterId: selectedPodcasterId,
                    title: episodeTitle.trim(),
                    contentCoverage,
                    chapters: parseChapters(chapters),
                    episodeType,
                    episodeTheme,
                    targetLengthMin,
                    targetLengthMax,
                },
                token
            );

            Alert.alert('Success', 'Episode creation started! You\'ll be notified when it\'s ready.');
            router.back();
        } catch (err: any) {
            console.error('Error creating episode:', err);
            Alert.alert('Error', err.message || 'Failed to create episode');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige items-center justify-center">
                <ActivityIndicator size="large" color="#BF9A54" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-brand-beige">
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                {/* Title */}
                <View className="mb-6">
                    <Text className="font-jakarta-bold text-2xl text-[#1A1C1E] mb-1">
                        Create
                    </Text>
                    <Text className="font-jakarta text-[#1A1C1E] text-sm">
                        Create a podcast episode or your own virtual podcaster
                    </Text>
                </View>

                {/* Book Selection */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">Book</Text>
                    <View className="flex-row items-center bg-brand-input rounded-xl px-4 py-3">
                        <TextInput
                            className="flex-1 font-inter text-[#1A1C1E]"
                            value={bookSearch}
                            onChangeText={setBookSearch}
                            placeholder="Type or search book title"
                            placeholderTextColor="#858585"
                        />
                        <TouchableOpacity>
                            <Ionicons name="heart-outline" size={22} color="#858585" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Virtual Podcaster Selection */}
                <PodcasterSelector
                    podcasters={podcasters}
                    selectedId={selectedPodcasterId}
                    onSelect={setSelectedPodcasterId}
                    onAddNew={() => router.push('/podcasts/create')}
                />

                {/* Episode Title */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">Episode Title</Text>
                    <View className="bg-brand-input rounded-xl px-4 py-3">
                        <TextInput
                            className="font-inter text-[#1A1C1E]"
                            value={episodeTitle}
                            onChangeText={setEpisodeTitle}
                            placeholder="Enter title of this episode"
                            placeholderTextColor="#858585"
                        />
                    </View>
                </View>

                {/* Content Coverage */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-3">Content Coverage</Text>
                    {renderTabSelector(contentCoverageOptions, contentCoverage, setContentCoverage)}

                    {/* Chapter input (shown when not ENTIRE_BOOK) */}
                    {contentCoverage !== 'ENTIRE_BOOK' && (
                        <View className="mt-3">
                            <View className="bg-brand-input rounded-xl px-4 py-3">
                                <TextInput
                                    className="font-inter text-[#1A1C1E]"
                                    value={chapters}
                                    onChangeText={setChapters}
                                    placeholder="Enter chapter number(s)"
                                    placeholderTextColor="#858585"
                                    keyboardType="default"
                                />
                            </View>
                        </View>
                    )}
                </View>

                {/* Episode Type */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-3">Episode Type</Text>
                    <InfoTooltip text={episodeTypeDescriptions[episodeType]} />
                    {renderTabSelector(episodeTypeOptions, episodeType, setEpisodeType)}
                </View>

                {/* Episode Theme */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-3">Episode Theme</Text>
                    <InfoTooltip text={episodeThemeDescriptions[episodeTheme]} />
                    {renderTabSelector(episodeThemeOptions, episodeTheme, setEpisodeTheme)}
                </View>

                {/* Episode Length Range */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-3">Episode Length</Text>

                    {/* Value badges */}
                    <View className="flex-row justify-between mb-2">
                        <View className="bg-brand-gold rounded-md px-3 py-1">
                            <Text className="text-white font-inter-medium text-sm">{targetLengthMin}</Text>
                        </View>
                        <View className="bg-brand-gold rounded-md px-3 py-1">
                            <Text className="text-white font-inter-medium text-sm">{targetLengthMax}</Text>
                        </View>
                    </View>

                    {/* Min slider */}
                    <View className="mb-4">
                        <Slider
                            value={targetLengthMin}
                            onValueChange={(value) => {
                                const newValue = Math.round(value);
                                if (newValue < targetLengthMax) {
                                    setTargetLengthMin(newValue);
                                }
                            }}
                            minimumValue={5}
                            maximumValue={75}
                            step={1}
                            minimumTrackTintColor="#BF9A54"
                            maximumTrackTintColor="#E8E3D6"
                            thumbTintColor="#BF9A54"
                            style={{ width: '100%', height: 40 }}
                        />
                    </View>

                    {/* Max slider */}
                    <View>
                        <Slider
                            value={targetLengthMax}
                            onValueChange={(value) => {
                                const newValue = Math.round(value);
                                if (newValue > targetLengthMin) {
                                    setTargetLengthMax(newValue);
                                }
                            }}
                            minimumValue={5}
                            maximumValue={75}
                            step={1}
                            minimumTrackTintColor="#BF9A54"
                            maximumTrackTintColor="#E8E3D6"
                            thumbTintColor="#BF9A54"
                            style={{ width: '100%', height: 40 }}
                        />
                    </View>

                    {/* Tick marks */}
                    <View className="flex-row justify-between px-2 mt-1">
                        <Text className="text-[#858585] font-inter text-xs">0</Text>
                        <Text className="text-[#858585] font-inter text-xs">15min</Text>
                        <Text className="text-[#858585] font-inter text-xs">30min</Text>
                        <Text className="text-[#858585] font-inter text-xs">45min</Text>
                        <Text className="text-[#858585] font-inter text-xs">60min</Text>
                        <Text className="text-[#858585] font-inter text-xs">75min</Text>
                    </View>
                </View>

                {/* Create Button */}
                <TouchableOpacity
                    onPress={handleCreate}
                    disabled={isSubmitting}
                    className={`bg-brand-red rounded-full py-4 items-center ${isSubmitting ? 'opacity-50' : ''}`}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                        <Text className="text-white font-inter-medium text-base">Create</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Create;

const styles = StyleSheet.create({});
