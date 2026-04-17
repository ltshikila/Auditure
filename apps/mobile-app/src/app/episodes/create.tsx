import {
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
} from 'react-native';
import React, { useState, useEffect, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { PodcasterSelector } from '@/components/PodcasterSelector';
import { InfoTooltip } from '@/components/InfoTooltip';
import { SkeletonBox, SkeletonProvider } from '@/components/skeleton';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { episodeService, EpisodeType, EpisodeTheme, ContentCoverage, FileUpload, VoiceTier } from '@/services/episode.service';
import { bookService, Book, Chapter } from '@/services/book.service';
import { storageService } from '@/services/storage.service';
import { subscriptionService, SubscriptionStatus } from '@/services/subscription.service';
import { SliderTrack } from '@/components/CustomSlider';
import { usePlayback } from '@/contexts/PlaybackContext';
import { MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';
import { useAlert } from '@/contexts/AlertContext';

type BookSourceMode = 'search' | 'upload';

type TabOption<T> = {
    value: T;
    label: string;
};

const Create = () => {
    const router = useRouter();
    const { episode } = usePlayback();
    const { showAlert } = useAlert();
    const isMiniPlayerVisible = !!episode;
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showUploadDisclaimer, setShowUploadDisclaimer] = useState(false);

    // Podcasters
    const [podcasters, setPodcasters] = useState<Podcaster[]>([]);

    // Book source mode
    const [bookSourceMode, setBookSourceMode] = useState<BookSourceMode>('upload');
    const [selectedFile, setSelectedFile] = useState<FileUpload | null>(null);

    // Library books state
    const [userBooks, setUserBooks] = useState<Book[]>([]);
    const [isLoadingBooks, setIsLoadingBooks] = useState(false);
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [bookChapters, setBookChapters] = useState<Chapter[]>([]);
    const [isLoadingChapters, setIsLoadingChapters] = useState(false);
    const [selectedChapterIds, setSelectedChapterIds] = useState<Set<number>>(new Set());

    // Form state
    const [bookSearch, setBookSearch] = useState('');
    const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
    const [selectedPodcasterId, setSelectedPodcasterId] = useState<string | null>(null);
    const [episodeTitle, setEpisodeTitle] = useState('');
    const [contentCoverage, setContentCoverage] = useState<ContentCoverage>('ENTIRE_BOOK');
    const [chapters, setChapters] = useState('');
    const [episodeType, setEpisodeType] = useState<EpisodeType>('MONOLOGUE');
    const [episodeTheme, setEpisodeTheme] = useState<EpisodeTheme>('LECTURE');
    const [targetLengthMin, setTargetLengthMin] = useState(5);
    const [targetLengthMax, setTargetLengthMax] = useState(10);
    const [voiceTier, setVoiceTier] = useState<VoiceTier>('STANDARD');
    const [subscriptionTier, setSubscriptionTier] = useState<'FREE' | 'STARTER' | 'PRO'>('FREE');

    // Duration limit based on subscription tier (Free=10min, Starter/Pro=30min)
    const maxDuration = subscriptionTier === 'FREE' ? 10 : 30;

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
    ];

    const episodeTypeDescriptions: Record<string, string> = {
        MONOLOGUE: 'A podcast episode with just your virtual podcaster speaking. Catered to more of a lecture format podcast.',
        DUO: 'A conversation between two speakers - your podcaster and a generated guest. Great for discussions and interviews.',
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

    // Voice tier options with descriptions
    const voiceTierOptions: TabOption<VoiceTier>[] = [
        { value: 'STANDARD', label: 'Standard' },
        { value: 'GEMINI', label: 'Pro' },
    ];

    const voiceTierDescriptions: Record<VoiceTier, string> = {
        STANDARD: 'Clear, natural speech quality. Included with all subscription tiers — great for everyday listening.',
        GEMINI: 'Premium voice quality with natural multi-speaker synthesis. Rich, immersive listening experience.',
    };

    // Load user's podcasters and subscription tier
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
                // Fetch subscription tier for duration limits
                try {
                    const status = await subscriptionService.getSubscriptionStatus(token);
                    const tier = (status.tier || 'FREE') as 'FREE' | 'STARTER' | 'PRO';
                    setSubscriptionTier(tier);
                    // Set default max duration based on tier
                    const tierMaxDuration = tier === 'FREE' ? 10 : 30;
                    setTargetLengthMax(tierMaxDuration);
                } catch (subError) {
                    console.error('Failed to load subscription:', subError);
                }
            } catch (error) {
                console.error('Failed to load podcasters:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadPodcasters();
    }, []);

    // Load user's books when switching to search mode
    useEffect(() => {
        if (bookSourceMode === 'search') {
            loadUserBooks();
        }
    }, [bookSourceMode]);

    // Load chapters when a book is selected
    useEffect(() => {
        if (selectedBook && (selectedBook.extractionStatus === 'COMPLETED' || selectedBook.extractionStatus === 'PARTIALLY_COMPLETED')) {
            loadBookChapters(selectedBook.id);
        } else {
            setBookChapters([]);
            setSelectedChapterIds(new Set());
        }
    }, [selectedBook]);

    const loadUserBooks = async () => {
        try {
            setIsLoadingBooks(true);
            const token = await storageService.getAccessToken();
            if (!token) return;
            const books = await bookService.getBooks(token);
            setUserBooks(books);
        } catch (error) {
            console.error('Failed to load books:', error);
        } finally {
            setIsLoadingBooks(false);
        }
    };

    const loadBookChapters = async (bookId: string) => {
        try {
            setIsLoadingChapters(true);
            const token = await storageService.getAccessToken();
            if (!token) return;
            const chapters = await bookService.getChapters(bookId, token);
            setBookChapters(chapters);
        } catch (error) {
            console.error('Failed to load chapters:', error);
        } finally {
            setIsLoadingChapters(false);
        }
    };

    const handleSelectBook = (book: Book) => {
        if (book.extractionStatus !== 'COMPLETED' && book.extractionStatus !== 'PARTIALLY_COMPLETED') {
            showAlert({
                title: 'Book Not Ready',
                message: book.extractionStatus === 'PROCESSING'
                    ? 'This book is still being processed. Please wait until extraction is complete.'
                    : book.extractionStatus === 'FAILED'
                    ? 'Text extraction failed for this book. Try uploading again.'
                    : 'This book is pending extraction.',
            });
            return;
        }
        setSelectedBook(book);
        setSelectedBookId(book.id);
        setSelectedChapterIds(new Set());
    };

    const handleToggleChapter = (chapterNumber: number) => {
        setSelectedChapterIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(chapterNumber)) {
                newSet.delete(chapterNumber);
            } else {
                newSet.add(chapterNumber);
            }
            return newSet;
        });
    };

    // Filter to ready books, deduplicate by title (keep most recent), then apply search
    const filteredBooks = useMemo(() => {
        // Only show books with completed extraction
        const readyBooks = userBooks.filter(
            book => book.extractionStatus === 'COMPLETED' || book.extractionStatus === 'PARTIALLY_COMPLETED'
        );

        // Deduplicate by title (case-insensitive), keeping the most recently uploaded
        const deduped = new Map<string, Book>();
        for (const book of readyBooks) {
            const key = book.title.toLowerCase().trim();
            const existing = deduped.get(key);
            if (!existing || new Date(book.createdAt) > new Date(existing.createdAt)) {
                deduped.set(key, book);
            }
        }
        const uniqueBooks = Array.from(deduped.values());

        // Apply search filter
        if (!bookSearch) return uniqueBooks;
        const query = bookSearch.toLowerCase();
        return uniqueBooks.filter(book =>
            book.title.toLowerCase().includes(query) ||
            (book.author && book.author.toLowerCase().includes(query))
        );
    }, [userBooks, bookSearch]);

    // Parse chapters input
    const parseChapters = (input: string): number[] => {
        if (!input.trim()) return [];
        const result: number[] = [];
        for (const part of input.split(',')) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const rangeMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10);
                const end = parseInt(rangeMatch[2], 10);
                if (start > 0 && end >= start) {
                    for (let i = start; i <= end; i++) result.push(i);
                }
            } else {
                const n = parseInt(trimmed, 10);
                if (!isNaN(n) && n > 0) result.push(n);
            }
        }
        return [...new Set(result)].sort((a, b) => a - b);
    };

    // Handle file picking
    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/epub+zip'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB
                if (asset.size && asset.size > MAX_FILE_SIZE) {
                    showAlert({
                        title: 'File Too Large',
                        message: `This file is ${Math.round(asset.size / 1024 / 1024)}MB. The maximum upload size is 32MB. Please use a smaller file.`,
                    });
                    return;
                }
                setSelectedFile({
                    uri: asset.uri,
                    name: asset.name,
                    type: asset.mimeType || 'application/pdf',
                });
            }
        } catch (error) {
            console.error('Error picking document:', error);
            showAlert({ title: 'Error', message: 'Failed to pick document' });
        }
    };

    // Clear selected file
    const handleClearFile = () => {
        setSelectedFile(null);
    };

    // Render tab selector
    const renderTabSelector = <T extends string>(
        options: TabOption<T>[],
        selected: T,
        onSelect: (value: T) => void
    ) => (
        <View className="flex-row border-b border-[#E8E3D6] dark:border-brand-dark-border">
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
                            selected === option.value ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E] dark:text-brand-dark-text'
                        }`}
                    >
                        {option.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    // Get chapters based on mode and content coverage
    const getSelectedChapters = (): number[] => {
        if (contentCoverage === 'ENTIRE_BOOK') {
            return [];
        }
        if (bookSourceMode === 'search') {
            return Array.from(selectedChapterIds).sort((a, b) => a - b);
        }
        return parseChapters(chapters);
    };

    const handleCreate = async () => {
        // Validation based on mode
        if (bookSourceMode === 'search' && !selectedBookId) {
            showAlert({ title: 'Validation Error', message: 'Please select a book' });
            return;
        }

        if (bookSourceMode === 'upload' && !selectedFile) {
            showAlert({ title: 'Validation Error', message: 'Please upload a book file (PDF or EPUB)' });
            return;
        }

        if (!selectedPodcasterId) {
            showAlert({ title: 'Validation Error', message: 'Please select a virtual podcaster' });
            return;
        }

        if (!episodeTitle.trim()) {
            showAlert({ title: 'Validation Error', message: 'Please enter an episode title' });
            return;
        }

        const chaptersToUse = getSelectedChapters();

        if (contentCoverage !== 'ENTIRE_BOOK') {
            if (chaptersToUse.length === 0) {
                showAlert({ title: 'Validation Error', message: 'Please select at least one chapter' });
                return;
            }
            if (contentCoverage === 'SINGLE_CHAPTER' && chaptersToUse.length > 1) {
                showAlert({ title: 'Validation Error', message: 'Single chapter mode only allows one chapter' });
                return;
            }
        }

        if (targetLengthMin >= targetLengthMax) {
            showAlert({ title: 'Validation Error', message: 'Minimum length must be less than maximum length' });
            return;
        }

        try {
            setIsSubmitting(true);

            const token = await storageService.getAccessToken();
            if (!token) {
                router.replace('/(auth)/Auth');
                return;
            }

            // Validate chapters if selecting from library
            if (bookSourceMode === 'search' && selectedBookId && contentCoverage !== 'ENTIRE_BOOK') {
                const validation = await bookService.validateChapters(selectedBookId, chaptersToUse, token);
                if (!validation.valid) {
                    showAlert({
                        title: 'Invalid Chapters',
                        message: `Chapters ${validation.invalidChapters.join(', ')} do not exist in this book. Available: ${validation.availableChapters.join(', ')}`,
                    });
                    setIsSubmitting(false);
                    return;
                }
            }

            if (bookSourceMode === 'upload' && selectedFile) {
                // Create with file upload - track progress asynchronously
                setUploadProgress(0);
                setShowUploadModal(true);
                episodeService.createWithFile(
                    selectedFile,
                    {
                        podcasterId: selectedPodcasterId,
                        title: episodeTitle.trim(),
                        contentCoverage,
                        chapters: chaptersToUse,
                        episodeType,
                        episodeTheme,
                        targetLengthMin,
                        targetLengthMax,
                        voiceTier,
                    },
                    token,
                    (progress) => setUploadProgress(progress)
                ).then(() => {
                    setUploadProgress(null);
                    setShowUploadModal(false);
                    setIsSubmitting(false);
                    showAlert({ title: 'Success', message: 'Episode creation started! You\'ll be notified when it\'s ready.' });
                    router.back();
                }).catch((err: any) => {
                    console.error('Error uploading file:', err);
                    setUploadProgress(null);
                    setShowUploadModal(false);
                    setIsSubmitting(false);
                    showAlert({ title: 'Error', message: err.message || 'Failed to upload book' });
                });
                return; // Don't continue to the finally block — async upload handles cleanup
            } else if (selectedBookId) {
                // Create with existing book
                await episodeService.create(
                    {
                        bookId: selectedBookId,
                        podcasterId: selectedPodcasterId,
                        title: episodeTitle.trim(),
                        contentCoverage,
                        chapters: chaptersToUse,
                        episodeType,
                        episodeTheme,
                        targetLengthMin,
                        targetLengthMax,
                        voiceTier,
                    },
                    token
                );
            }

            showAlert({ title: 'Success', message: 'Episode creation started! You\'ll be notified when it\'s ready.' });
            router.back();
        } catch (err: any) {
            console.error('Error creating episode:', err);
            showAlert({ title: 'Error', message: err.message || 'Failed to create episode' });
        } finally {
            setIsSubmitting(false);
            setUploadProgress(null);
        }
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg items-center justify-center">
                <ActivityIndicator size="large" color="#BF9A54" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
            <KeyboardAwareScrollView
                contentContainerStyle={{ padding: 24, paddingBottom: 50 + (isMiniPlayerVisible ? MINI_PLAYER_HEIGHT + 16 : 0) }}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                extraScrollHeight={20}
            >
                {/* Header with Back Button */}
                <View className="mb-6">
                    <View className="flex-row items-center">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 items-center justify-center -ml-2 mr-2"
                        >
                            <Ionicons name="arrow-back" size={24} color="#1A1C1E" />
                        </TouchableOpacity>
                        <Text className="font-jakarta-bold text-2xl text-[#1A1C1E] dark:text-brand-dark-text">
                            Create
                        </Text>
                    </View>
                    <Text className="font-jakarta text-[#1A1C1E] dark:text-brand-dark-text text-sm mt-1">
                        Create a podcast episode or your own virtual podcaster
                    </Text>
                </View>

                {/* Book Source Selection */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-3">Book Source</Text>

                    {/* Mode Toggle */}
                    <View className="flex-row border-b border-[#E8E3D6] dark:border-brand-dark-border mb-4">
                        <TouchableOpacity
                            onPress={() => {
                                setBookSourceMode('upload');
                                setSelectedBook(null);
                                setSelectedBookId(null);
                                setSelectedChapterIds(new Set());
                            }}
                            className={`flex-1 pb-3 items-center ${
                                bookSourceMode === 'upload' ? 'border-b-2 border-brand-gold' : ''
                            }`}
                        >
                            <Text
                                className={`font-inter text-sm ${
                                    bookSourceMode === 'upload' ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E] dark:text-brand-dark-text'
                                }`}
                            >
                                Upload File
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                setBookSourceMode('search');
                                setChapters('');
                                setSelectedFile(null);
                            }}
                            className={`flex-1 pb-3 items-center ${
                                bookSourceMode === 'search' ? 'border-b-2 border-brand-gold' : ''
                            }`}
                        >
                            <Text
                                className={`font-inter text-sm ${
                                    bookSourceMode === 'search' ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E] dark:text-brand-dark-text'
                                }`}
                            >
                                Search Library
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Upload File Mode */}
                    {bookSourceMode === 'upload' && (
                        <View>
                            {/* Upload Disclaimer Modal */}
                            <Modal
                                visible={showUploadDisclaimer}
                                transparent
                                animationType="fade"
                            >
                                <View className="flex-1 bg-black/50 items-center justify-center px-8">
                                    <View className="bg-brand-beige dark:bg-brand-dark-bg rounded-2xl p-6 w-full max-w-sm">
                                        <View className="items-center mb-4">
                                            <View className="bg-brand-gold/20 rounded-full p-4 mb-3">
                                                <Ionicons name="information-circle-outline" size={32} color="#BF9A54" />
                                            </View>
                                            <Text className="font-jakarta-bold text-lg text-[#1A1C1E] dark:text-brand-dark-text text-center">
                                                Before You Upload
                                            </Text>
                                        </View>

                                        <Text className="font-inter text-[#1A1C1E] dark:text-brand-dark-text text-sm text-center leading-5 mb-2">
                                            For the best experience, we recommend uploading a{' '}
                                            <Text className="font-inter-medium">clean, official copy</Text>{' '}
                                            of the book.
                                        </Text>
                                        <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs text-center leading-4 mb-5">
                                            Unofficial or low-quality files can cause issues like wrong book details, missing covers, or chapters not being picked up correctly.
                                        </Text>

                                        <TouchableOpacity
                                            onPress={() => {
                                                setShowUploadDisclaimer(false);
                                                handlePickFile();
                                            }}
                                            className="bg-brand-gold rounded-full py-3.5 items-center mb-2"
                                        >
                                            <Text className="text-white font-inter-medium text-sm">I Understand, Continue</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setShowUploadDisclaimer(false)}
                                            className="py-3 items-center"
                                        >
                                            <Text className="text-[#858585] dark:text-brand-dark-text-secondary font-inter text-sm">Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </Modal>

                            {selectedFile ? (
                                <View className="bg-brand-input dark:bg-brand-dark-input rounded-xl px-4 py-4">
                                    <View className="flex-row items-center">
                                        <View className="bg-brand-gold/20 rounded-lg p-2 mr-3">
                                            <Ionicons
                                                name={selectedFile.type.includes('pdf') ? 'document-text' : 'book'}
                                                size={24}
                                                color="#BF9A54"
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-inter-medium text-[#1A1C1E] dark:text-brand-dark-text text-sm" numberOfLines={1}>
                                                {selectedFile.name}
                                            </Text>
                                            <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs mt-0.5">
                                                {selectedFile.type.includes('pdf') ? 'PDF Document' : 'EPUB Book'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={handleClearFile} className="p-2">
                                            <Ionicons name="close-circle" size={22} color="#858585" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setShowUploadDisclaimer(true)}
                                    activeOpacity={0.7}
                                    className="rounded-2xl px-4 py-6 items-center bg-[#F5F5F0] dark:bg-brand-dark-surface"
                                    style={{
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.08,
                                        shadowRadius: 4,
                                        elevation: 6,
                                    }}
                                >
                                    <View className="bg-brand-gold/20 rounded-full p-3 mb-3">
                                        <Ionicons name="cloud-upload-outline" size={28} color="#BF9A54" />
                                    </View>
                                    <Text className="font-inter-medium text-[#1A1C1E] dark:text-brand-dark-text text-sm mb-1">
                                        Tap to upload a book
                                    </Text>
                                    <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs">
                                        PDF or EPUB files up to 32MB
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Search Library Mode */}
                    {bookSourceMode === 'search' && (
                        <View>
                            {/* Search input */}
                            <View className="flex-row items-center bg-brand-input dark:bg-brand-dark-input rounded-xl px-4 py-3 mb-3">
                                <Ionicons name="search" size={20} color="#858585" style={{ marginRight: 8 }} />
                                <TextInput
                                    className="flex-1 font-inter text-[#1A1C1E] dark:text-brand-dark-text"
                                    value={bookSearch}
                                    onChangeText={setBookSearch}
                                    placeholder="Search your books..."
                                    placeholderTextColor="#858585"
                                />
                                {bookSearch.length > 0 && (
                                    <TouchableOpacity onPress={() => setBookSearch('')}>
                                        <Ionicons name="close-circle" size={20} color="#858585" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Selected book display */}
                            {selectedBook && (
                                <View className="bg-brand-gold/10 rounded-xl px-4 py-3 mb-3 border border-brand-gold">
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-1">
                                            <Text className="font-inter-medium text-[#1A1C1E] dark:text-brand-dark-text" numberOfLines={1}>
                                                {selectedBook.title}
                                            </Text>
                                            {selectedBook.author && (
                                                <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs">
                                                    by {selectedBook.author}
                                                </Text>
                                            )}
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setSelectedBook(null);
                                                setSelectedBookId(null);
                                                setBookChapters([]);
                                                setSelectedChapterIds(new Set());
                                            }}
                                            className="p-2"
                                        >
                                            <Ionicons name="close-circle" size={22} color="#BF9A54" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            {/* Books list (when no book selected) */}
                            {!selectedBook && (
                                <View className="max-h-48">
                                    {isLoadingBooks ? (
                                        <SkeletonProvider>
                                            {[0, 1, 2].map((i) => (
                                                <View key={i} className="bg-brand-input dark:bg-brand-dark-input rounded-xl px-4 py-3 mb-2">
                                                    <View className="flex-row items-center">
                                                        <SkeletonBox width={36} height={36} borderRadius={8} style={{ marginRight: 12 }} />
                                                        <View className="flex-1">
                                                            <SkeletonBox width="70%" height={14} borderRadius={4} />
                                                            <SkeletonBox width="40%" height={10} borderRadius={4} style={{ marginTop: 6 }} />
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </SkeletonProvider>
                                    ) : filteredBooks.length === 0 ? (
                                        <View className="py-6 items-center">
                                            <Ionicons name="book-outline" size={32} color="#858585" />
                                            <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-sm mt-2">
                                                {userBooks.length === 0
                                                    ? 'No books in your library yet'
                                                    : 'No books match your search'}
                                            </Text>
                                        </View>
                                    ) : (
                                        <ScrollView
                                            nestedScrollEnabled
                                            showsVerticalScrollIndicator
                                            className="max-h-48"
                                        >
                                            {filteredBooks.map((book) => (
                                                <TouchableOpacity
                                                    key={book.id}
                                                    onPress={() => handleSelectBook(book)}
                                                    className="bg-brand-input dark:bg-brand-dark-input rounded-xl px-4 py-3 mb-2"
                                                >
                                                    <View className="flex-row items-center">
                                                        <View className="bg-brand-gold/20 rounded-lg p-2 mr-3">
                                                            <Ionicons
                                                                name={book.sourceType === 'PDF' ? 'document-text' : 'book'}
                                                                size={20}
                                                                color="#BF9A54"
                                                            />
                                                        </View>
                                                        <View className="flex-1">
                                                            <Text className="font-inter-medium text-[#1A1C1E] dark:text-brand-dark-text text-sm" numberOfLines={1}>
                                                                {book.title}
                                                            </Text>
                                                            {book.author && (
                                                                <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs mt-0.5">
                                                                    {book.author}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        <Ionicons name="chevron-forward" size={20} color="#858585" />
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
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
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-2">Episode Title</Text>
                    <View className="bg-brand-input dark:bg-brand-dark-input rounded-xl px-4 py-3">
                        <TextInput
                            className="font-inter text-[#1A1C1E] dark:text-brand-dark-text"
                            value={episodeTitle}
                            onChangeText={setEpisodeTitle}
                            placeholder="Enter title of this episode"
                            placeholderTextColor="#858585"
                            maxLength={100}
                        />
                    </View>
                </View>

                {/* Content Coverage */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-3">Content Coverage</Text>
                    {renderTabSelector(contentCoverageOptions, contentCoverage, setContentCoverage)}

                    {/* Chapter selection (shown when not ENTIRE_BOOK) */}
                    {contentCoverage !== 'ENTIRE_BOOK' && (
                        <View className="mt-3">
                            {/* For upload mode or when no chapters loaded: show text input */}
                            {(bookSourceMode === 'upload' || bookChapters.length === 0) && (
                                <View>
                                    <View className="bg-brand-input dark:bg-brand-dark-input rounded-xl px-4 py-3">
                                        <TextInput
                                            className="font-inter text-[#1A1C1E] dark:text-brand-dark-text"
                                            value={chapters}
                                            onChangeText={setChapters}
                                            placeholder={
                                                contentCoverage === 'SINGLE_CHAPTER'
                                                    ? 'Enter chapter number (e.g., 3)'
                                                    : 'Enter chapters (e.g., 1, 2, 3 or 1-5)'
                                            }
                                            placeholderTextColor="#858585"
                                            keyboardType="default"
                                        />
                                    </View>
                                    <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs mt-1 ml-1">
                                        Use commas to separate and hyphens for ranges (e.g., 1-5, 13, 20-22)
                                    </Text>
                                </View>
                            )}

                            {/* For search mode with chapters: show chapter checkboxes */}
                            {bookSourceMode === 'search' && selectedBook && (
                                <View>
                                    {isLoadingChapters ? (
                                        <View className="py-4 items-center">
                                            <ActivityIndicator size="small" color="#BF9A54" />
                                            <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-sm mt-2">
                                                Loading chapters...
                                            </Text>
                                        </View>
                                    ) : bookChapters.length === 0 ? (
                                        <View className="bg-brand-input dark:bg-brand-dark-input rounded-xl px-4 py-3">
                                            <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-sm">
                                                No chapters detected in this book. The entire book will be used.
                                            </Text>
                                        </View>
                                    ) : (
                                        <View>
                                            {/* Chapter list */}
                                            <ScrollView
                                                nestedScrollEnabled
                                                showsVerticalScrollIndicator
                                                className="max-h-40"
                                            >
                                                {bookChapters.map((chapter) => (
                                                    <TouchableOpacity
                                                        key={chapter.id}
                                                        onPress={() => {
                                                            if (contentCoverage === 'SINGLE_CHAPTER') {
                                                                // Single chapter mode: only one selection
                                                                setSelectedChapterIds(new Set([chapter.chapterNumber]));
                                                            } else {
                                                                handleToggleChapter(chapter.chapterNumber);
                                                            }
                                                        }}
                                                        className="flex-row items-center bg-brand-input dark:bg-brand-dark-input rounded-lg px-3 py-2.5 mb-1.5"
                                                    >
                                                        <View
                                                            className={`w-5 h-5 rounded ${
                                                                contentCoverage === 'SINGLE_CHAPTER' ? 'rounded-full' : ''
                                                            } border mr-3 items-center justify-center ${
                                                                selectedChapterIds.has(chapter.chapterNumber)
                                                                    ? 'bg-brand-gold border-brand-gold'
                                                                    : 'border-[#858585]'
                                                            }`}
                                                        >
                                                            {selectedChapterIds.has(chapter.chapterNumber) && (
                                                                <Ionicons name="checkmark" size={14} color="white" />
                                                            )}
                                                        </View>
                                                        <View className="flex-1">
                                                            <Text className="font-inter text-[#1A1C1E] dark:text-brand-dark-text text-sm">
                                                                Chapter {chapter.chapterNumber}
                                                                {chapter.title ? `: ${chapter.title}` : ''}
                                                            </Text>
                                                            {(chapter.startPage || chapter.textLength) && (
                                                                <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs">
                                                                    {chapter.startPage && chapter.endPage
                                                                        ? `Pages ${chapter.startPage}-${chapter.endPage}`
                                                                        : ''}
                                                                    {chapter.startPage && chapter.textLength ? ' • ' : ''}
                                                                    {chapter.textLength
                                                                        ? `~${Math.round(chapter.textLength / 250)} min read`
                                                                        : ''}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>

                                            {/* Selection summary */}
                                            {selectedChapterIds.size > 0 && (
                                                <Text className="font-inter text-brand-gold text-xs mt-2">
                                                    {selectedChapterIds.size} chapter{selectedChapterIds.size !== 1 ? 's' : ''} selected
                                                </Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* Episode Type */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-3">Episode Type</Text>
                    <InfoTooltip text={episodeTypeDescriptions[episodeType]} />
                    {renderTabSelector(episodeTypeOptions, episodeType, setEpisodeType)}
                </View>

                {/* Episode Theme */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-3">Episode Theme</Text>
                    <InfoTooltip text={episodeThemeDescriptions[episodeTheme]} />
                    {renderTabSelector(episodeThemeOptions, episodeTheme, setEpisodeTheme)}
                </View>

                {/* Episode Length Range */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-3">Episode Length</Text>

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
                    <View className="mb-2">
                        <SliderTrack
                            value={targetLengthMin}
                            onValueChange={(v) => {
                                const clamped = Math.min(v, targetLengthMax - 1);
                                setTargetLengthMin(Math.max(5, clamped));
                            }}
                            minimumValue={5}
                            maximumValue={maxDuration}
                            step={1}
                        />
                    </View>

                    {/* Max slider */}
                    <SliderTrack
                        value={targetLengthMax}
                        onValueChange={(v) => {
                            const clamped = Math.max(v, targetLengthMin + 1);
                            setTargetLengthMax(Math.min(maxDuration, clamped));
                        }}
                        minimumValue={5}
                        maximumValue={maxDuration}
                        step={1}
                    />

                    {/* Tick marks */}
                    <View className="flex-row justify-between px-2 mt-1">
                        {Array.from({ length: (maxDuration - 5) / 5 + 1 }, (_, i) => 5 + i * 5).map(v => (
                            <Text key={v} className="text-[#858585] dark:text-brand-dark-text-secondary font-inter text-xs">{v}min</Text>
                        ))}
                    </View>
                </View>

                {/* Voice Quality */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-3">Voice Quality</Text>
                    <InfoTooltip text={voiceTierDescriptions[voiceTier]} />
                    {renderTabSelector(voiceTierOptions, voiceTier, setVoiceTier)}
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
            </KeyboardAwareScrollView>

            {/* Upload Progress Modal */}
            <Modal
                visible={showUploadModal}
                transparent
                animationType="fade"
            >
                <View className="flex-1 bg-black/50 items-center justify-center px-8">
                    <View className="bg-brand-beige dark:bg-brand-dark-bg rounded-2xl p-6 w-full max-w-sm">
                        <View className="items-center mb-4">
                            <View className="bg-brand-gold/20 rounded-full p-4 mb-3">
                                <Ionicons name="cloud-upload" size={32} color="#BF9A54" />
                            </View>
                            <Text className="font-jakarta-bold text-lg text-[#1A1C1E] dark:text-brand-dark-text">
                                Uploading Book
                            </Text>
                            <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-sm text-center mt-1">
                                {selectedFile?.name}
                            </Text>
                        </View>

                        {/* Progress bar - raw progress goes to 200%, so divide by 2 */}
                        {(() => {
                            const displayProgress = Math.min(100, Math.round((uploadProgress ?? 0) / 2));
                            return (
                                <>
                                    <View className="mb-2">
                                        <View className="h-3 bg-[#E8E3D6] rounded-full overflow-hidden">
                                            <View
                                                className="h-full bg-brand-gold rounded-full"
                                                style={{ width: `${displayProgress}%` }}
                                            />
                                        </View>
                                    </View>

                                    <Text className="font-inter text-[#858585] dark:text-brand-dark-text-secondary text-xs">
                                        {displayProgress}% uploaded
                                    </Text>
                                </>
                            );
                        })()}

                        {(uploadProgress ?? 0) >= 200 && (
                            <View className="mt-4 bg-brand-gold/10 rounded-xl px-4 py-3">
                                <View className="flex-row items-center">
                                    <ActivityIndicator size="small" color="#BF9A54" />
                                    <Text className="font-inter text-brand-gold text-sm ml-2">
                                        Processing book...
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default Create;
