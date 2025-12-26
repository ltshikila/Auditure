// apps/mobile-app/src/components/AuthInput.tsx
import React from 'react';
import { View, Text, TextInput } from 'react-native';

// FIXED: Defined interface for strict typing
interface AuthInputProps {
  label: string;
  value?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  onChangeText?: (text: string) => void;
}

export default function AuthInput({ 
  label, 
  value, 
  onChangeText, 
  secureTextEntry = false, 
  placeholder 
}: AuthInputProps) {
  return (
    <View className="mb-4">
      <Text className="text-[#1A1C1E] font-jakarta mb-1 ml-1">{label}</Text>
      <TextInput
        className="bg-[#F1EEE3] font-inter py-5 px-4 rounded-xl text-[#1A1C1E]"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor="#858585"
      />
    </View>
  );
}