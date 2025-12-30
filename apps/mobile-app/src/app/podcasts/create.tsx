import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';

type VoiceModel = 'custom' | 'realistic' | 'energetic' | 'calm' | 'sarcastic' | 'academic';
type Gender = 'male' | 'female';

const Create = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  // Form state - Step 1
  const [podcastName, setPodcastName] = useState('');
  const [selectedVoiceModel, setSelectedVoiceModel] = useState<VoiceModel>('custom');
  const [selectedGender, setSelectedGender] = useState<Gender>('male');
  const [accent, setAccent] = useState('United States');
  const [showAccentPicker, setShowAccentPicker] = useState(false);

  // Slider values (1-10) - Step 1
  const [speakingSpeed, setSpeakingSpeed] = useState(5);
  const [vocalPitch, setVocalPitch] = useState(5);
  const [vocabularyComplexity, setVocabularyComplexity] = useState(5);
  const [ageTone, setAgeTone] = useState(5);

  // Slider values (1-10) - Step 2
  const [tone, setTone] = useState(5);
  const [communicationStyle, setCommunicationStyle] = useState(5);
  const [humorLevel, setHumorLevel] = useState(5);
  const [conversationalDepth, setConversationalDepth] = useState(5);

  // Form state - Step 3
  const [selectedExpertiseTags, setSelectedExpertiseTags] = useState<string[]>([]);
  const [intellectualAngle, setIntellectualAngle] = useState('Skeptical');
  const [showIntellectualAnglePicker, setShowIntellectualAnglePicker] = useState(false);
  const [viewpointBehavior, setViewpointBehavior] = useState(5);

  const accents = [
    'United States',
    'United Kingdom',
    'Australia',
    'Canada',
    'Ireland',
    'South Africa',
  ];

  const voiceModels: { type: VoiceModel; label: string }[] = [
    { type: 'custom', label: 'Custom' },
    { type: 'realistic', label: 'Realistic' },
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

  const intellectualAngles = [
    'Skeptical',
    'Open-minded',
    'Critical',
    'Accepting',
    'Questioning',
    'Trusting',
  ];

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
      <View className={`${currentStep >= 1 ? 'bg-brand-gold' : 'border-2 border-brand-gold bg-transparent'} rounded-full w-10 h-10 items-center justify-center`}>
        {currentStep > 1 ? (
          <Ionicons name="checkmark" size={20} color="white" />
        ) : (
          <Text className={`${currentStep === 1 ? 'text-white' : 'text-brand-gold'} font-jakarta-bold text-base`}>1</Text>
        )}
      </View>
      <View className="w-16 h-0.5 bg-brand-gold" />

      {/* Step 2 */}
      <View className={`${currentStep >= 2 ? 'bg-brand-gold' : 'border-2 border-brand-gold bg-transparent'} rounded-full w-10 h-10 items-center justify-center`}>
        {currentStep > 2 ? (
          <Ionicons name="checkmark" size={20} color="white" />
        ) : (
          <Text className={`${currentStep === 2 ? 'text-white' : 'text-brand-gold'} font-jakarta-bold text-base`}>2</Text>
        )}
      </View>
      <View className="w-16 h-0.5 bg-brand-gold" />

      {/* Step 3 */}
      <View className={`${currentStep >= 3 ? 'bg-brand-gold' : 'border-2 border-brand-gold bg-transparent'} rounded-full w-10 h-10 items-center justify-center`}>
        <Text className={`${currentStep === 3 ? 'text-white' : 'text-brand-gold'} font-jakarta-bold text-base`}>3</Text>
      </View>
    </View>
  );

  const renderVoiceModelButton = (model: VoiceModel, label: string) => {
    const isSelected = selectedVoiceModel === model;
    return (
      <TouchableOpacity
        key={model}
        onPress={() => setSelectedVoiceModel(model)}
        className={`flex-1 min-w-[30%] max-w-[30%] aspect-square rounded-2xl items-center justify-center mb-3 ${
          isSelected ? 'bg-brand-gold' : 'bg-[#E8E3D6]'
        }`}
      >
        <View className={`w-12 h-12 rounded-full mb-2 ${isSelected ? 'bg-white' : 'bg-[#D4CEC0]'}`} />
        <Text className={`font-jakarta ${isSelected ? 'text-white' : 'text-[#1A1C1E]'}`}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCircularSlider = (
    value: number,
    label: string,
    leftLabel: string,
    rightLabel: string,
    onValueChange: (value: number) => void
  ) => {
    const angle = ((value - 1) / 9) * 180 - 90; // Map 1-10 to -90 to 90 degrees

    return (
      <View className="mb-6">
        <Text className="text-[#1A1C1E] font-jakarta-bold text-base mb-3">{label}</Text>
        <View className="items-center">
          <View className="relative w-48 h-24 items-center justify-end mb-2">
            {/* Background arc */}
            <View className="absolute bottom-0 w-48 h-24 border-8 border-[#E8E3D6] rounded-t-full" />
            {/* Active arc - approximated with overlay */}
            <View
              className="absolute bottom-0 w-48 h-24 border-8 border-brand-gold rounded-t-full"
              style={{
                transform: [{ scaleX: (value - 1) / 9 }],
                transformOrigin: 'left',
              }}
            />
            {/* Center value display */}
            <View className="absolute bottom-0 items-center mb-4">
              <Text className="text-brand-gold font-jakarta-bold text-4xl">{value}°</Text>
            </View>
          </View>

          {/* Slider */}
          <View className="w-full px-4">
            <Slider
              value={value}
              onValueChange={onValueChange}
              minimumValue={1}
              maximumValue={10}
              step={1}
              minimumTrackTintColor="#BF9A54"
              maximumTrackTintColor="#E8E3D6"
              thumbTintColor="#BF9A54"
              style={{ width: '100%', height: 40 }}
            />
          </View>

          {/* Labels */}
          <View className="flex-row justify-between w-full px-6 mt-1">
            <Text className="text-[#858585] font-inter text-sm">{leftLabel}</Text>
            <Text className="text-[#858585] font-inter text-sm">{rightLabel}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center">
          <View className="w-8 h-8 bg-brand-red rounded items-center justify-center mr-2">
            <Ionicons name="book" size={18} color="white" />
          </View>
          <Text className="font-jakarta-bold text-xl text-[#1A1C1E]">BookCast</Text>
        </View>
        <View className="flex-row items-center gap-4">
          <Ionicons name="notifications-outline" size={24} color="#1A1C1E" />
          <Ionicons name="search-outline" size={24} color="#1A1C1E" />
        </View>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Title */}
        <View className="mb-6">
          <Text className="font-jakarta-bold text-2xl text-[#1A1C1E] mb-1">Create</Text>
          <Text className="font-inter text-[#858585] text-sm">
            Create a podcast episode or your own virtual podcaster
          </Text>
        </View>

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Step 1: Core Identity */}
        {currentStep === 1 && (
          <>
            <Text className="font-jakarta-bold text-xl text-[#1A1C1E] mb-4">Core Identity</Text>

        {/* Virtual Podcast Name */}
        <View className="mb-6">
          <Text className="text-[#1A1C1E] font-jakarta mb-2">Virtual Podcast Name</Text>
          <View className="flex-row items-center bg-brand-input rounded-xl px-4 py-4">
            <TextInput
              className="flex-1 font-inter text-[#1A1C1E]"
              value={podcastName}
              onChangeText={setPodcastName}
              placeholder="Type or search book title"
              placeholderTextColor="#858585"
            />
            <Ionicons name="heart-outline" size={24} color="#858585" />
          </View>
        </View>

        {/* Voice Model */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-[#1A1C1E] font-jakarta-bold text-base">Voice Model</Text>
            <View className="bg-brand-red rounded-full w-10 h-10 items-center justify-center">
              <Ionicons name="play" size={18} color="white" />
            </View>
          </View>

          <View className="flex-row flex-wrap justify-between">
            {voiceModels.map((model) => renderVoiceModelButton(model.type, model.label))}
          </View>

          {/* Gender Selection */}
          <View className="flex-row border-b border-[#E8E3D6] mt-2">
            <TouchableOpacity
              onPress={() => setSelectedGender('male')}
              className={`flex-1 pb-2 items-center ${
                selectedGender === 'male' ? 'border-b-2 border-brand-gold' : ''
              }`}
            >
              <Text
                className={`font-jakarta ${
                  selectedGender === 'male' ? 'text-brand-gold' : 'text-[#858585]'
                }`}
              >
                Male
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedGender('female')}
              className={`flex-1 pb-2 items-center ${
                selectedGender === 'female' ? 'border-b-2 border-brand-gold' : ''
              }`}
            >
              <Text
                className={`font-jakarta ${
                  selectedGender === 'female' ? 'text-brand-gold' : 'text-[#858585]'
                }`}
              >
                Female
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Accent */}
        <View className="mb-6">
          <Text className="text-[#1A1C1E] font-jakarta mb-2">Accent</Text>
          <TouchableOpacity
            onPress={() => setShowAccentPicker(!showAccentPicker)}
            className="flex-row items-center justify-between bg-brand-input rounded-xl px-4 py-4"
          >
            <Text className="font-inter text-[#1A1C1E]">{accent}</Text>
            <Ionicons
              name={showAccentPicker ? "chevron-up" : "chevron-down"}
              size={24}
              color="#BF9A54"
            />
          </TouchableOpacity>

          {showAccentPicker && (
            <View className="bg-white rounded-xl mt-2 border border-[#E8E3D6] overflow-hidden">
              {accents.map((acc, index) => (
                <TouchableOpacity
                  key={acc}
                  onPress={() => {
                    setAccent(acc);
                    setShowAccentPicker(false);
                  }}
                  className={`px-4 py-3 ${index < accents.length - 1 ? 'border-b border-[#E8E3D6]' : ''} ${
                    accent === acc ? 'bg-brand-beige' : ''
                  }`}
                >
                  <Text className={`font-inter ${accent === acc ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E]'}`}>
                    {acc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Sliders */}
        {renderCircularSlider(
          speakingSpeed,
          'Speaking Speed',
          'Slow',
          'Fast',
          setSpeakingSpeed
        )}

        {renderCircularSlider(
          vocalPitch,
          'Vocal Pitch',
          'Low',
          'High',
          setVocalPitch
        )}

        {renderCircularSlider(
          vocabularyComplexity,
          'Vocabulary Complexity',
          'Simple',
          'Advanced',
          setVocabularyComplexity
        )}

        {renderCircularSlider(
          ageTone,
          'Age Tone',
          'Youthful',
          'Senior',
          setAgeTone
        )}
          </>
        )}

        {/* Step 2: Core Personality Model */}
        {currentStep === 2 && (
          <>
            <View className="mb-4">
              <Text className="font-jakarta-bold text-xl text-[#1A1C1E]">Core Personality Model</Text>
              <Text className="font-inter text-[#858585] text-sm mt-1">
                Defines persona consistency across all episodes
              </Text>
            </View>

            {renderCircularSlider(
              tone,
              'Tone',
              'Calm',
              'Energetic',
              setTone
            )}

            {renderCircularSlider(
              communicationStyle,
              'Communication Style',
              'Storytelling',
              'Analytical',
              setCommunicationStyle
            )}

            {renderCircularSlider(
              humorLevel,
              'Humor Level',
              'Dry',
              'Comedic',
              setHumorLevel
            )}

            {renderCircularSlider(
              conversationalDepth,
              'Conversational Depth',
              'Surface-Level',
              'Deep Thinking',
              setConversationalDepth
            )}
          </>
        )}

        {/* Step 3: Knowledge & Worldview */}
        {currentStep === 3 && (
          <>
            <View className="mb-4">
              <Text className="font-jakarta-bold text-xl text-[#1A1C1E]">Knowledge & Worldview</Text>
              <Text className="font-inter text-[#858585] text-sm mt-1">
                Governs interpretation style across all <Text className="font-inter-bold">books</Text> covered.
              </Text>
            </View>

            {/* Expertise Tags */}
            <View className="mb-6">
              <Text className="text-[#1A1C1E] font-jakarta-bold text-base mb-2">Expertise Tags</Text>
              <Text className="font-inter text-[#858585] text-sm mb-3">Choose 1-3</Text>
              <View className="flex-row flex-wrap gap-2">
                {expertiseTags.map((tag) => {
                  const isSelected = selectedExpertiseTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleExpertiseTag(tag)}
                      className={`px-4 py-2 rounded-full ${
                        isSelected ? 'bg-brand-red' : 'bg-[#E8E3D6]'
                      }`}
                    >
                      <Text className={`font-inter ${isSelected ? 'text-white' : 'text-[#1A1C1E]'}`}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Intellectual Angle */}
            <View className="mb-6">
              <Text className="text-[#1A1C1E] font-jakarta-bold text-base mb-1">Intellectual Angle</Text>
              <Text className="font-inter text-[#858585] text-sm mb-3">
                The angle in which the podcaster approaches a books idea
              </Text>
              <TouchableOpacity
                onPress={() => setShowIntellectualAnglePicker(!showIntellectualAnglePicker)}
                className="flex-row items-center justify-between bg-brand-input rounded-xl px-4 py-4"
              >
                <Text className="font-inter text-[#1A1C1E]">{intellectualAngle}</Text>
                <Ionicons
                  name={showIntellectualAnglePicker ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="#BF9A54"
                />
              </TouchableOpacity>

              {showIntellectualAnglePicker && (
                <View className="bg-white rounded-xl mt-2 border border-[#E8E3D6] overflow-hidden">
                  {intellectualAngles.map((angle, index) => (
                    <TouchableOpacity
                      key={angle}
                      onPress={() => {
                        setIntellectualAngle(angle);
                        setShowIntellectualAnglePicker(false);
                      }}
                      className={`px-4 py-3 ${index < intellectualAngles.length - 1 ? 'border-b border-[#E8E3D6]' : ''} ${
                        intellectualAngle === angle ? 'bg-brand-beige' : ''
                      }`}
                    >
                      <Text className={`font-inter ${intellectualAngle === angle ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E]'}`}>
                        {angle}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Viewpoint Behavior */}
            <View className="mb-6">
              <Text className="text-[#1A1C1E] font-jakarta-bold text-base mb-1">Viewpoint Behavior</Text>
              <Text className="font-inter text-[#858585] text-sm mb-3">
                Defines debate and critique tendencies
              </Text>
              {renderCircularSlider(
                viewpointBehavior,
                '',
                'Agreeable',
                'Challenging',
                setViewpointBehavior
              )}
            </View>
          </>
        )}

        {/* Bottom spacing */}
        <View className="h-8" />
      </ScrollView>

      {/* Bottom Tab Bar & Navigation */}
      <View className="absolute bottom-0 left-0 right-0 bg-white" style={{ paddingBottom: Platform.OS === 'ios' ? 20 : 0 }}>
        {/* Navigation Buttons */}
        <View className="flex-row justify-between items-center px-6 py-4 border-t border-[#E8E3D6]">
          <TouchableOpacity
            onPress={() => currentStep > 1 && setCurrentStep(currentStep - 1)}
            disabled={currentStep === 1}
          >
            <Text className={`font-jakarta-medium ${currentStep === 1 ? 'text-[#D4CEC0]' : 'text-brand-gold'}`}>
              Back
            </Text>
          </TouchableOpacity>

          {currentStep < 3 ? (
            <TouchableOpacity
              onPress={() => setCurrentStep(currentStep + 1)}
              className="bg-brand-red px-8 py-3 rounded-xl"
            >
              <Text className="text-white font-jakarta-medium">Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => {
                // Handle form submission
                console.log('Submitting podcast creation form...');
                // You can add your submission logic here
              }}
              className="bg-brand-red px-8 py-3 rounded-xl"
            >
              <Text className="text-white font-jakarta-medium">Submit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tab Bar Icons */}
        <View className="flex-row justify-around items-center py-3 border-t border-[#E8E3D6]">
          <TouchableOpacity className="items-center">
            <Ionicons name="home-outline" size={24} color="#858585" />
          </TouchableOpacity>
          <TouchableOpacity className="items-center">
            <Ionicons name="mic" size={24} color="#920002" />
            <View className="w-1 h-1 bg-brand-red rounded-full mt-1" />
          </TouchableOpacity>
          <TouchableOpacity className="items-center">
            <Ionicons name="radio-outline" size={24} color="#858585" />
          </TouchableOpacity>
          <TouchableOpacity className="items-center">
            <Ionicons name="person-outline" size={24} color="#858585" />
          </TouchableOpacity>
        </View>

        {/* iPhone Home Indicator */}
        <View className="items-center pb-2">
          <View className="w-32 h-1 bg-[#1A1C1E] rounded-full" />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default Create;

const styles = StyleSheet.create({});
