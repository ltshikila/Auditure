import {
    Text,
    View,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import React, { useState } from 'react';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CustomSlider } from '@/components/CustomSlider';
import { CustomDropdown } from '@/components/CustomDropdown';
import { VoiceModelButton } from '@/components/VoiceModelButton';
import { ProfilePictureInput } from '@/components/ProfilePictureInput';
import { podcasterService } from '@/services/podcaster.service';
import { storageService } from '@/services/storage.service';
import { usePlayback } from '@/contexts/PlaybackContext';
import { MINI_PLAYER_HEIGHT } from '@/components/MiniPlayer';

type VoiceModel = 'custom' | 'conversational' | 'energetic' | 'calm' | 'sarcastic' | 'academic';
type Gender = 'male' | 'female';

const Create = () => {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { episode } = usePlayback();
    const isMiniPlayerVisible = !!episode;
    const [currentStep, setCurrentStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state - Step 1
    const [podcastName, setPodcastName] = useState('');
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [selectedVoiceModel, setSelectedVoiceModel] = useState<VoiceModel>('custom');
    const [selectedGender, setSelectedGender] = useState<Gender>('male');
    const [accent, setAccent] = useState('United States');

    // Slider values (1-10) - Step 1
    const [speakingSpeed, setSpeakingSpeed] = useState(5);
    const [vocalPitch, setVocalPitch] = useState(5);
    const [ageTone, setAgeTone] = useState(5);
    const [sentenceStructure, setSentenceStructure] = useState(5);
    const [emotionalExpression, setEmotionalExpression] = useState(5);

    // Slider values (1-10) - Step 2
    const [tone, setTone] = useState(5);
    const [communicationStyle, setCommunicationStyle] = useState(5);
    const [humorLevel, setHumorLevel] = useState(5);
    const [conversationalDepth, setConversationalDepth] = useState(5);
    const [chaosFactor, setChaosFactor] = useState(5);

    // Form state - Step 3
    const [selectedExpertiseTags, setSelectedExpertiseTags] = useState<string[]>([]);
    const [intellectualAngle, setIntellectualAngle] = useState('Skeptical');
    const [viewpointBehavior, setViewpointBehavior] = useState(5);

    // Accents supported by Gemini TTS (en-US, en-GB, en-AU, en-IN)
    const accentOptions = [
        { label: 'United States', value: 'United States' },
        { label: 'United Kingdom', value: 'United Kingdom' },
        { label: 'Australia', value: 'Australia' },
        { label: 'India', value: 'India' },
    ];

    const intellectualAngleOptions = [
        { label: 'Skeptical', value: 'Skeptical' },
        { label: 'Accepting', value: 'Accepting' },
        { label: 'Critical', value: 'Critical' },
        { label: 'Pragmatic', value: 'Pragmatic' },
        { label: 'Idealistic', value: 'Idealistic' },
        { label: 'Empirical', value: 'Empirical' },
    ];

    const voiceModels: { type: VoiceModel; label: string }[] = [
        { type: 'custom', label: 'Custom' },
        { type: 'conversational', label: 'Conversational' },
        { type: 'energetic', label: 'Energetic' },
        { type: 'calm', label: 'Calm' },
        { type: 'sarcastic', label: 'Sarcastic' },
        { type: 'academic', label: 'Academic' },
    ];

    const expertiseTags = [
        'Philosophy',
        'Psychology',
        'Finance',
        'History',
        'Literature',
        'Politics',
        'Self-help',
        'Science',
        'Business',
        'Art & Culture',
    ];

    const voiceModelTemplates: Record<VoiceModel, Partial<{
        speakingSpeed: number;
        vocalPitch: number;
        ageTone: number;
        sentenceStructure: number;
        emotionalExpression: number;
        tone: number;
        communicationStyle: number;
        humorLevel: number;
        chaosFactor: number;
    }>> = {
        custom: {}, // No autofill
        conversational: {
            speakingSpeed: 5,
            emotionalExpression: 7, // Natural, expressive
            tone: 6,
            humorLevel: 6,
            sentenceStructure: 4, // Casual, moderately concise
            communicationStyle: 3, // More storytelling
            chaosFactor: 6, // Naturally engaging with some passion
        },
        energetic: {
            speakingSpeed: 8,
            tone: 9,
            humorLevel: 7,
            emotionalExpression: 9,
            sentenceStructure: 3, // More concise/punchy
            chaosFactor: 8, // Highly passionate, intense reactions
        },
        calm: {
            speakingSpeed: 3,
            tone: 2,
            humorLevel: 4,
            emotionalExpression: 3,
            sentenceStructure: 7, // More elaborate
            chaosFactor: 2, // Very measured, rarely intense
        },
        sarcastic: {
            speakingSpeed: 6,
            tone: 6,
            humorLevel: 9,
            emotionalExpression: 7,
            sentenceStructure: 4, // Punchy delivery
            chaosFactor: 7, // Sharp emotional swings, biting reactions
        },
        academic: {
            speakingSpeed: 4,
            tone: 3,
            humorLevel: 2,
            emotionalExpression: 2,
            sentenceStructure: 8, // Very elaborate
            communicationStyle: 7, // More analytical
            chaosFactor: 1, // Extremely controlled, analytical
        },
    };

    const handleVoiceModelSelect = (modelType: VoiceModel) => {
        setSelectedVoiceModel(modelType);

        // Apply template values if not 'custom'
        const template = voiceModelTemplates[modelType];
        if (Object.keys(template).length > 0) {
            if (template.speakingSpeed !== undefined) setSpeakingSpeed(template.speakingSpeed);
            if (template.vocalPitch !== undefined) setVocalPitch(template.vocalPitch);
            if (template.ageTone !== undefined) setAgeTone(template.ageTone);
            if (template.sentenceStructure !== undefined) setSentenceStructure(template.sentenceStructure);
            if (template.emotionalExpression !== undefined) setEmotionalExpression(template.emotionalExpression);
            if (template.tone !== undefined) setTone(template.tone);
            if (template.communicationStyle !== undefined) setCommunicationStyle(template.communicationStyle);
            if (template.humorLevel !== undefined) setHumorLevel(template.humorLevel);
            if (template.chaosFactor !== undefined) setChaosFactor(template.chaosFactor);
        }
    };

    // Helper to switch to 'custom' when user manually adjusts template fields
    const switchToCustomIfNeeded = () => {
        if (selectedVoiceModel !== 'custom') {
            setSelectedVoiceModel('custom');
        }
    };

    const toggleExpertiseTag = (tag: string) => {
        if (selectedExpertiseTags.includes(tag)) {
            setSelectedExpertiseTags(selectedExpertiseTags.filter(t => t !== tag));
        } else {
            if (selectedExpertiseTags.length < 3) {
                setSelectedExpertiseTags([...selectedExpertiseTags, tag]);
            }
        }
    };

    const renderStepIndicator = () => (
        <View className="flex-row items-center justify-center mb-6">
            {/* Step 1 */}
            <View
                className={`${currentStep >= 1 ? 'bg-brand-gold' : 'border border-brand-gold bg-transparent'} rounded-full w-14 h-14 items-center justify-center`}>
                {currentStep > 1 ? (
                    <Ionicons name="checkmark" size={20} color="white" />
                ) : (
                    <Text
                        className={`${currentStep === 1 ? 'text-white' : 'text-brand-gold'} font-jakarta-bold text-base`}>
                        1
                    </Text>
                )}
            </View>
            <View className="w-20 h-0.5 bg-brand-gold" />

            {/* Step 2 */}
            <View
                className={`${currentStep >= 2 ? 'bg-brand-gold' : 'border border-brand-gold bg-transparent'} rounded-full w-14 h-14 items-center justify-center`}>
                {currentStep > 2 ? (
                    <Ionicons name="checkmark" size={20} color="white" />
                ) : (
                    <Text
                        className={`${currentStep === 2 ? 'text-white' : 'text-brand-gold'} font-jakarta-bold text-base`}>
                        2
                    </Text>
                )}
            </View>
            <View className="w-20 h-0.5 bg-brand-gold" />

            {/* Step 3 */}
            <View
                className={`${currentStep >= 3 ? 'bg-brand-gold' : 'border border-brand-gold bg-transparent'} rounded-full w-14 h-14 items-center justify-center`}>
                <Text
                    className={`${currentStep === 3 ? 'text-white' : 'text-brand-gold'} font-jakarta-bold text-base`}>
                    3
                </Text>
            </View>
        </View>
    );


    return (
        <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-brand-beige">
            <KeyboardAwareScrollView
                contentContainerStyle={{ padding: 24 }}
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
                        Design your own virtual podcaster personality
                    </Text>
                </View>

                {/* Step Indicator */}
                {renderStepIndicator()}

                {/* Step 1: Core Identity */}
                {currentStep === 1 && (
                    <>
                        <Text className="font-inter-bold text-2xl text-[#1A1C1E] mb-4">
                            Core Identity
                        </Text>

                        {/* Virtual Podcast Name */}
                        <View className="mb-6">
                            <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">
                                Virtual Podcaster Name
                            </Text>
                            <View className="flex-row items-center bg-brand-input rounded-xl px-4 py-3">
                                <TextInput
                                    className="flex-1 font-inter text-[#1A1C1E]"
                                    value={podcastName}
                                    onChangeText={setPodcastName}
                                    placeholder="Enter a name for your podcaster"
                                    placeholderTextColor="#858585"
                                />
                                
                            </View>
                        </View>

                        {/* Profile Picture */}
                        <ProfilePictureInput
                            imageUri={profilePicture}
                            onImageSelected={setProfilePicture}
                        />

                        {/* Voice Model */}
                        <View className="mb-6">
                            <View className="flex-row items-center justify-between mb-3">
                                <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">
                                    Voice Model
                                </Text>
                                <View className="bg-brand-red rounded-full w-10 h-10 items-center justify-center">
                                    <Ionicons name="play" size={18} color="white" />
                                </View>
                            </View>

                            <View className="flex-row flex-wrap justify-between">
                                {voiceModels.map(model => (
                                    <VoiceModelButton
                                        key={model.type}
                                        label={model.label}
                                        isSelected={selectedVoiceModel === model.type}
                                        onPress={() => handleVoiceModelSelect(model.type)}
                                    />
                                ))}
                            </View>

                            {/* Gender Selection */}
                            <View className="flex-row border-b border-[#E8E3D6] mt-4">
                                <TouchableOpacity
                                    onPress={() => setSelectedGender('male')}
                                    className={`flex-1 pb-2 items-center ${
                                        selectedGender === 'male'
                                            ? 'border-b-2 border-brand-gold'
                                            : ''
                                    }`}>
                                    <Text
                                        className={`font-jakarta ${
                                            selectedGender === 'male'
                                                ? 'text-brand-gold'
                                                : 'text-[#1A1C1E]'
                                        }`}>
                                        Male
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setSelectedGender('female')}
                                    className={`flex-1 pb-2 items-center ${
                                        selectedGender === 'female'
                                            ? 'border-b-2 border-brand-gold'
                                            : ''
                                    }`}>
                                    <Text
                                        className={`font-jakarta ${
                                            selectedGender === 'female'
                                                ? 'text-brand-gold'
                                                : 'text-[#1A1C1E]'
                                        }`}>
                                        Female
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Accent */}
                        <CustomDropdown
                            label="Accent"
                            options={accentOptions}
                            selectedValue={accent}
                            onSelect={setAccent}
                        />

                        {/* Sliders */}
                        <CustomSlider
                            label="Speaking Speed"
                            value={speakingSpeed}
                            onValueChange={setSpeakingSpeed}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Slow"
                            rightLabel="Fast"
                        />

                        <CustomSlider
                            label="Vocal Pitch"
                            value={vocalPitch}
                            onValueChange={setVocalPitch}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Low"
                            rightLabel="High"
                        />

                        <CustomSlider
                            label="Age Tone"
                            value={ageTone}
                            onValueChange={setAgeTone}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Youthful"
                            rightLabel="Senior"
                        />

                        <CustomSlider
                            label="Sentence Structure"
                            value={sentenceStructure}
                            onValueChange={setSentenceStructure}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Concise"
                            rightLabel="Elaborate"
                        />

                        <CustomSlider
                            label="Emotional Expression"
                            value={emotionalExpression}
                            onValueChange={setEmotionalExpression}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Monotone"
                            rightLabel="Expressive"
                        />
                    </>
                )}

                {/* Step 2: Core Personality Model */}
                {currentStep === 2 && (
                    <>
                        <View className="mb-4">
                            <Text className="font-jakarta-bold text-xl text-[#1A1C1E]">
                                Core Personality Model
                            </Text>
                            <Text className="font-inter text-[#1A1C1E] text-sm mt-1">
                                Defines persona consistency across all episodes
                            </Text>
                        </View>

                        <CustomSlider
                            label="Tone"
                            value={tone}
                            onValueChange={setTone}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Calm"
                            rightLabel="Energetic"
                        />

                        <CustomSlider
                            label="Communication Style"
                            value={communicationStyle}
                            onValueChange={setCommunicationStyle}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Storytelling"
                            rightLabel="Analytical"
                        />

                        <CustomSlider
                            label="Humor Level"
                            value={humorLevel}
                            onValueChange={setHumorLevel}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Dry"
                            rightLabel="Comedic"
                        />

                        <CustomSlider
                            label="Conversational Depth"
                            value={conversationalDepth}
                            onValueChange={setConversationalDepth}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Surface-Level"
                            rightLabel="Deep Thinking"
                        />

                        <CustomSlider
                            label="Chaos Factor"
                            value={chaosFactor}
                            onValueChange={setChaosFactor}
                            onSlidingComplete={switchToCustomIfNeeded}
                            leftLabel="Steady"
                            rightLabel="Volatile"
                        />
                    </>
                )}

                {/* Step 3: Knowledge & Worldview */}
                {currentStep === 3 && (
                    <>
                        <View className="mb-4">
                            <Text className="font-inter-bold text-2xl text-[#1A1C1E]">
                                Knowledge & Worldview
                            </Text>
                            <Text className="font-jakarta text-[#1A1C1E] text-sm mt-1">
                                Governs interpretation style across all{' '}
                                <Text className="font-inter-bold">books</Text> covered.
                            </Text>
                        </View>

                        {/* Expertise Tags */}
                        <View className="mb-6">
                            <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-2">
                                Expertise Tags
                            </Text>
                            <Text className="font-jakarta text-[#1A1C1E] text-sm mb-3">
                                Choose 1-3
                            </Text>
                            <View className="flex-row flex-wrap gap-2">
                                {expertiseTags.map(tag => {
                                    const isSelected = selectedExpertiseTags.includes(tag);
                                    return (
                                        <TouchableOpacity
                                            key={tag}
                                            onPress={() => toggleExpertiseTag(tag)}
                                            className={`px-4 py-2 rounded-full ${
                                                isSelected ? 'bg-brand-red' : 'bg-[#E8E3D6]'
                                            }`}>
                                            <Text
                                                className={`font-inter text-sm ${isSelected ? 'text-white' : 'text-[#1A1C1E]'}`}>
                                                {tag}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Intellectual Angle */}
                        <View className="mb-3">
                            <Text className="text-[#1A1C1E] font-inter-medium text-lg mb-1">
                                Intellectual Angle
                            </Text>
                            <Text className="font-inter text-[#858585] text-sm mb-2">
                                The angle in which the podcaster approaches a books idea
                            </Text>
                            <CustomDropdown
                                label=""
                                options={intellectualAngleOptions}
                                selectedValue={intellectualAngle}
                                onSelect={setIntellectualAngle}
                            />
                        </View>

                        {/* Viewpoint Behavior */}
                        <View className="mb-3">
                            <View className="flex-row justify-between items-center mb-1">
                                <Text className="text-[#1A1C1E] font-inter-medium text-lg">
                                    Viewpoint Behavior
                                </Text>
                                <View className="bg-brand-gold rounded-full px-4 py-1.5">
                                    <Text className="text-white font-inter-medium text-base">{viewpointBehavior}</Text>
                                </View>
                            </View>
                            <Text className="font-inter text-[#858585] text-sm mb-2">
                                Defines debate and critique tendencies
                            </Text>
                            <CustomSlider
                                label=""
                                value={viewpointBehavior}
                                onValueChange={setViewpointBehavior}
                                leftLabel="Agreeable"
                                rightLabel="Challenging"
                                showValue={false}
                            />
                        </View>
                    </>
                )}
            </KeyboardAwareScrollView>

            {/* Navigation Buttons - Fixed at bottom */}
            <View
                className="flex-row justify-between items-center px-6 py-5 bg-brand-beige"
                style={{ paddingBottom: Math.max(insets.bottom, 20) + (isMiniPlayerVisible ? MINI_PLAYER_HEIGHT + 16 : 0) }}>
                {/* Back Button */}
                <TouchableOpacity
                    onPress={() => {
                        if (currentStep > 1) {
                            setCurrentStep(currentStep - 1);
                        } else {
                            router.back();
                        }
                    }}
                    className="flex-row items-center px-4 py-3">
                    <Ionicons name="chevron-back" size={24} color="#1A1C1E" />
                    <Text className="text-[#1A1C1E] font-inter text-base ml-1">
                        {currentStep > 1 ? 'Back' : 'Cancel'}
                    </Text>
                </TouchableOpacity>

                {/* Next/Create Button */}
                {currentStep < 3 ? (
                    <TouchableOpacity
                        onPress={() => setCurrentStep(currentStep + 1)}
                        className="flex-row items-center bg-brand-gold rounded-full px-6 py-3">
                        <Text className="text-white font-inter-medium text-base mr-1">
                            Next
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="white" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={async () => {
                            // Validation
                            if (!podcastName.trim()) {
                                Alert.alert('Validation Error', 'Please enter a podcaster name');
                                return;
                            }

                            if (selectedExpertiseTags.length === 0) {
                                Alert.alert('Validation Error', 'Please select at least one expertise tag');
                                return;
                            }

                            try {
                                setIsSubmitting(true);

                                const token = await storageService.getAccessToken();
                                if (!token) {
                                    router.replace('/(auth)/Auth');
                                    return;
                                }

                                const podcasterData = {
                                    name: podcastName.trim(),
                                    profilePictureUrl: profilePicture || undefined,
                                    voiceModel: selectedVoiceModel.toUpperCase() as any,
                                    gender: selectedGender.toUpperCase() as any,
                                    accent,
                                    speakingSpeed,
                                    vocalPitch,
                                    ageTone,
                                    sentenceStructure,
                                    emotionalExpression,
                                    tone,
                                    communicationStyle,
                                    humorLevel,
                                    conversationalDepth,
                                    chaosFactor,
                                    expertiseTags: selectedExpertiseTags,
                                    intellectualAngle,
                                    viewpointBehavior,
                                    isPublic: false,
                                };

                                await podcasterService.create(podcasterData, token);

                                Alert.alert('Success', 'Podcaster created successfully!');
                                router.replace('/(tabs)/studio');
                            } catch (err: any) {
                                console.error('Error creating podcaster:', err);
                                Alert.alert('Error', err.message || 'Failed to create podcaster');
                            } finally {
                                setIsSubmitting(false);
                            }
                        }}
                        disabled={isSubmitting}
                        className={`bg-brand-gold rounded-full px-7 py-3 ${isSubmitting ? 'opacity-50' : ''}`}>
                        {isSubmitting ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text className="text-white font-inter-medium text-base">
                                Create
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
};

export default Create;
