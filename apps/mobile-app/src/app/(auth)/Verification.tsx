// apps/mobile-app/src/app/(auth)/Verification.tsx
import React from 'react';
import { View, Text, TouchableOpacity, TextInput,} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router'; // FIXED: Import router hook

export default function VerificationScreen() {
  // FIXED: Using useLocalSearchParams with generic type to fix 'email' error
  const { email } = useLocalSearchParams<{ email: string }>();

  return (
    <SafeAreaView className="flex-1 bg-[#FDFBF7] px-6">
      {/* Back Button */}
      <TouchableOpacity onPress={() => router.back()} className="mt-8 mb-6">
        <Text className="text-2xl">←</Text>
      </TouchableOpacity>

      <Text className="text-3xl font-bold text-gray-900 mb-4">Verification</Text>
      <Text className="text-gray-600 text-lg mb-2">We just sent a 6-digit code to:</Text>
      <Text className="text-gray-900 font-bold text-lg mb-8">{email}</Text>

      <Text className="text-gray-600 mb-4">Enter the code to continue:</Text>

      {/* Code Input Boxes */}
      <View className="flex-row justify-between mb-12">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <TextInput 
            key={i}
            className="w-12 h-14 border-2 border-[#E6E2D6] rounded-xl text-center text-xl font-bold bg-[#F5F5F0] focus:border-[#C5A065]"
            keyboardType="numeric"
            maxLength={1}
          />
        ))}
      </View>

      {/* Verify Button */}
      <TouchableOpacity 
        className="bg-[#8B0000] p-4 rounded-xl items-center mt-auto mb-8"
        onPress={() => console.log('Verified!')}>
        <Text className="text-white font-bold text-lg">Verify</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}