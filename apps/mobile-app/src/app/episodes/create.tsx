import {
    Text,
    View,
    ScrollView,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { PodcasterSelector } from '@/components/PodcasterSelector';
import { InfoTooltip } from '@/components/InfoTooltip';
import { podcasterService, Podcaster } from '@/services/podcaster.service';
import { episodeService, EpisodeType, EpisodeTheme, ContentCoverage, FileUpload, VoiceTier } from '@/services/episode.service';
import { bookService, Book, Chapter } from '@/services/book.service';
import { storageService } from '@/services/storage.service';
import Slider from '@react-native-community/slider';

type BookSourceMode = 'search' | 'upload';

type TabOption<T> = {
    value: T;
    label: string;
};

const Create = () => {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

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
    const [targetLengthMin, setTargetLengthMin] = useState(10);
    const [targetLengthMax, setTargetLengthMax] = useState(30);
    const [voiceTier, setVoiceTier] = useState<VoiceTier>('STANDARD');

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

    // Voice tier options with descriptions
    const voiceTierOptions: TabOption<VoiceTier>[] = [
        { value: 'STANDARD', label: 'Standard' },
        { value: 'GEMINI', label: 'Gemini Pro' },
    ];

    const voiceTierDescriptions: Record<VoiceTier, string> = {
        STANDARD: 'Google Cloud Standard TTS. Good quality at a lower cost ($4/1M chars). Ideal for free tier usage.',
        GEMINI: 'Gemini 2.5 Pro TTS with natural multi-speaker synthesis (~$0.32/10-min). Premium listening experience.',
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
            Alert.alert(
                'Book Not Ready',
                book.extractionStatus === 'PROCESSING'
                    ? 'This book is still being processed. Please wait until extraction is complete.'
                    : book.extractionStatus === 'FAILED'
                    ? 'Text extraction failed for this book. Try uploading again.'
                    : 'This book is pending extraction.'
            );
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

    // Filter books by search term
    const filteredBooks = userBooks.filter(book =>
        book.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
        (book.author && book.author.toLowerCase().includes(bookSearch.toLowerCase()))
    );

    // Parse chapters input
    const parseChapters = (input: string): number[] => {
        if (!input.trim()) return [];
        return input
            .split(',')
            .map(s => parseInt(s.trim(), 10))
            .filter(n => !isNaN(n) && n > 0);
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
                setSelectedFile({
                    uri: asset.uri,
                    name: asset.name,
                    type: asset.mimeType || 'application/pdf',
                });
            }
        } catch (error) {
            console.error('Error picking document:', error);
            Alert.alert('Error', 'Failed to pick document');
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
            Alert.alert('Validation Error', 'Please select a book');
            return;
        }

        if (bookSourceMode === 'upload' && !selectedFile) {
            Alert.alert('Validation Error', 'Please upload a book file (PDF or EPUB)');
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

        const chaptersToUse = getSelectedChapters();

        if (contentCoverage !== 'ENTIRE_BOOK') {
            if (chaptersToUse.length === 0) {
                Alert.alert('Validation Error', 'Please select at least one chapter');
                return;
            }
            if (contentCoverage === 'SINGLE_CHAPTER' && chaptersToUse.length > 1) {
                Alert.alert('Validation Error', 'Single chapter mode only allows one chapter');
                return;
            }
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

            // Validate chapters if selecting from library
            if (bookSourceMode === 'search' && selectedBookId && contentCoverage !== 'ENTIRE_BOOK') {
                const validation = await bookService.validateChapters(selectedBookId, chaptersToUse, token);
                if (!validation.valid) {
                    Alert.alert(
                        'Invalid Chapters',
                        `Chapters ${validation.invalidChapters.join(', ')} do not exist in this book. Available: ${validation.availableChapters.join(', ')}`
                    );
                    setIsSubmitting(false);
                    return;
                }
            }

            if (bookSourceMode === 'upload' && selectedFile) {
                // Create with file upload - track progress
                setUploadProgress(0);
                await episodeService.createWithFile(
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
                );
                setUploadProgress(null);
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

            Alert.alert('Success', 'Episode creation started! You\'ll be notified when it\'s ready.');
            router.back();
        } catch (err: any) {
            console.error('Error creating episode:', err);
            Alert.alert('Error', err.message || 'Failed to create episode');
        } finally {
            setIsSubmitting(false);
            setUploadProgress(null);
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
            <KeyboardAwareScrollView
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid={true}
                extraScrollHeight={20}
            >
                {/* Title */}
                <View className="mb-6">
                    <Text className="font-jakarta-bold text-2xl text-[#1A1C1E] mb-1">
                        Create
                    </Text>
                    <Text className="font-jakarta text-[#1A1C1E] text-sm">
                        Create a podcast episode or your own virtual podcaster
                    </Text>
                </View>

                {/* Book Source Selection */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-3">Book Source</Text>

                    {/* Mode Toggle */}
                    <View className="flex-row border-b border-[#E8E3D6] mb-4">
                        <TouchableOpacity
                            onPress={() => setBookSourceMode('upload')}
                            className={`flex-1 pb-3 items-center ${
                                bookSourceMode === 'upload' ? 'border-b-2 border-brand-gold' : ''
                            }`}
                        >
                            <Text
                                className={`font-inter text-sm ${
                                    bookSourceMode === 'upload' ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E]'
                                }`}
                            >
                                Upload File
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setBookSourceMode('search')}
                            className={`flex-1 pb-3 items-center ${
                                bookSourceMode === 'search' ? 'border-b-2 border-brand-gold' : ''
                            }`}
                        >
                            <Text
                                className={`font-inter text-sm ${
                                    bookSourceMode === 'search' ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E]'
                                }`}
                            >
                                Search Library
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Upload File Mode */}
                    {bookSourceMode === 'upload' && (
                        <View>
                            {selectedFile ? (
                                <View className="bg-brand-input rounded-xl px-4 py-4">
                                    <View className="flex-row items-center">
                                        <View className="bg-brand-gold/20 rounded-lg p-2 mr-3">
                                            <Ionicons
                                                name={selectedFile.type.includes('pdf') ? 'document-text' : 'book'}
                                                size={24}
                                                color="#BF9A54"
                                            />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="font-inter-medium text-[#1A1C1E] text-sm" numberOfLines={1}>
                                                {selectedFile.name}
                                            </Text>
                                            <Text className="font-inter text-[#858585] text-xs mt-0.5">
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
                                    onPress={handlePickFile}
                                    className="bg-brand-input rounded-xl px-4 py-6 items-center border-2 border-dashed border-[#E8E3D6]"
                                >
                                    <View className="bg-brand-gold/20 rounded-full p-3 mb-3">
                                        <Ionicons name="cloud-upload-outline" size={28} color="#BF9A54" />
                                    </View>
                                    <Text className="font-inter-medium text-[#1A1C1E] text-sm mb-1">
                                        Tap to upload a book
                                    </Text>
                                    <Text className="font-inter text-[#858585] text-xs">
                                        PDF or EPUB files up to 50MB
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Search Library Mode */}
                    {bookSourceMode === 'search' && (
                        <View>
                            {/* Search input */}
                            <View className="flex-row items-center bg-brand-input rounded-xl px-4 py-3 mb-3">
                                <Ionicons name="search" size={20} color="#858585" style={{ marginRight: 8 }} />
                                <TextInput
                                    className="flex-1 font-inter text-[#1A1C1E]"
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
                                            <Text className="font-inter-medium text-[#1A1C1E]" numberOfLines={1}>
                                                {selectedBook.title}
                                            </Text>
                                            {selectedBook.author && (
                                                <Text className="font-inter text-[#858585] text-xs">
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
                                        <View className="py-6 items-center">
                                            <ActivityIndicator size="small" color="#BF9A54" />
                                            <Text className="font-inter text-[#858585] text-sm mt-2">
                                                Loading your books...
                                            </Text>
                                        </View>
                                    ) : filteredBooks.length === 0 ? (
                                        <View className="py-6 items-center">
                                            <Ionicons name="book-outline" size={32} color="#858585" />
                                            <Text className="font-inter text-[#858585] text-sm mt-2">
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
                                                    className="bg-brand-input rounded-xl px-4 py-3 mb-2"
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
                                                            <Text className="font-inter-medium text-[#1A1C1E] text-sm" numberOfLines={1}>
                                                                {book.title}
                                                            </Text>
                                                            <View className="flex-row items-center mt-0.5">
                                                                {book.author && (
                                                                    <Text className="font-inter text-[#858585] text-xs mr-2">
                                                                        {book.author}
                                                                    </Text>
                                                                )}
                                                                <View
                                                                    className={`px-2 py-0.5 rounded-full ${
                                                                        book.extractionStatus === 'COMPLETED'
                                                                            ? 'bg-green-100'
                                                                            : book.extractionStatus === 'PROCESSING'
                                                                            ? 'bg-yellow-100'
                                                                            : book.extractionStatus === 'FAILED'
                                                                            ? 'bg-red-100'
                                                                            : 'bg-gray-100'
                                                                    }`}
                                                                >
                                                                    <Text
                                                                        className={`font-inter text-[10px] ${
                                                                            book.extractionStatus === 'COMPLETED'
                                                                                ? 'text-green-700'
                                                                                : book.extractionStatus === 'PROCESSING'
                                                                                ? 'text-yellow-700'
                                                                                : book.extractionStatus === 'FAILED'
                                                                                ? 'text-red-700'
                                                                                : 'text-gray-700'
                                                                        }`}
                                                                    >
                                                                        {book.extractionStatus === 'COMPLETED'
                                                                            ? 'Ready'
                                                                            : book.extractionStatus === 'PROCESSING'
                                                                            ? 'Processing'
                                                                            : book.extractionStatus === 'FAILED'
                                                                            ? 'Failed'
                                                                            : 'Pending'}
                                                                    </Text>
                                                                </View>
                                                            </View>
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

                    {/* Chapter selection (shown when not ENTIRE_BOOK) */}
                    {contentCoverage !== 'ENTIRE_BOOK' && (
                        <View className="mt-3">
                            {/* For upload mode or when no chapters loaded: show text input */}
                            {(bookSourceMode === 'upload' || bookChapters.length === 0) && (
                                <View>
                                    <View className="bg-brand-input rounded-xl px-4 py-3">
                                        <TextInput
                                            className="font-inter text-[#1A1C1E]"
                                            value={chapters}
                                            onChangeText={setChapters}
                                            placeholder={
                                                contentCoverage === 'SINGLE_CHAPTER'
                                                    ? 'Enter chapter number (e.g., 3)'
                                                    : 'Enter chapter numbers (e.g., 1, 2, 3)'
                                            }
                                            placeholderTextColor="#858585"
                                            keyboardType="default"
                                        />
                                    </View>
                                    <Text className="font-inter text-[#858585] text-xs mt-1 ml-1">
                                        Separate multiple chapters with commas
                                    </Text>
                                </View>
                            )}

                            {/* For search mode with chapters: show chapter checkboxes */}
                            {bookSourceMode === 'search' && selectedBook && (
                                <View>
                                    {isLoadingChapters ? (
                                        <View className="py-4 items-center">
                                            <ActivityIndicator size="small" color="#BF9A54" />
                                            <Text className="font-inter text-[#858585] text-sm mt-2">
                                                Loading chapters...
                                            </Text>
                                        </View>
                                    ) : bookChapters.length === 0 ? (
                                        <View className="bg-brand-input rounded-xl px-4 py-3">
                                            <Text className="font-inter text-[#858585] text-sm">
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
                                                        className="flex-row items-center bg-brand-input rounded-lg px-3 py-2.5 mb-1.5"
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
                                                            <Text className="font-inter text-[#1A1C1E] text-sm">
                                                                Chapter {chapter.chapterNumber}
                                                                {chapter.title ? `: ${chapter.title}` : ''}
                                                            </Text>
                                                            {(chapter.startPage || chapter.textLength) && (
                                                                <Text className="font-inter text-[#858585] text-xs">
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
                            maximumValue={30}
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
                            maximumValue={30}
                            step={1}
                            minimumTrackTintColor="#BF9A54"
                            maximumTrackTintColor="#E8E3D6"
                            thumbTintColor="#BF9A54"
                            style={{ width: '100%', height: 40 }}
                        />
                    </View>

                    {/* Tick marks */}
                    <View className="flex-row justify-between px-2 mt-1">
                        <Text className="text-[#858585] font-inter text-xs">5min</Text>
                        <Text className="text-[#858585] font-inter text-xs">10min</Text>
                        <Text className="text-[#858585] font-inter text-xs">15min</Text>
                        <Text className="text-[#858585] font-inter text-xs">20min</Text>
                        <Text className="text-[#858585] font-inter text-xs">25min</Text>
                        <Text className="text-[#858585] font-inter text-xs">30min</Text>
                    </View>
                </View>

                {/* Voice Quality */}
                <View className="mb-6">
                    <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-3">Voice Quality</Text>
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
                visible={uploadProgress !== null}
                transparent
                animationType="fade"
            >
                <View className="flex-1 bg-black/50 items-center justify-center px-8">
                    <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <View className="items-center mb-4">
                            <View className="bg-brand-gold/20 rounded-full p-4 mb-3">
                                <Ionicons name="cloud-upload" size={32} color="#BF9A54" />
                            </View>
                            <Text className="font-jakarta-bold text-lg text-[#1A1C1E]">
                                Uploading Book
                            </Text>
                            <Text className="font-inter text-[#858585] text-sm text-center mt-1">
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

                                    <View className="flex-row justify-between">
                                        <Text className="font-inter text-[#858585] text-xs">
                                            {displayProgress}% uploaded
                                        </Text>
                                        <Text className="font-inter text-[#858585] text-xs">
                                            Please wait...
                                        </Text>
                                    </View>
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
