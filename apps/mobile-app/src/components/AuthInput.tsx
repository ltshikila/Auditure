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
      <Text className="text-gray-600 mb-1 ml-1">{label}</Text>
      <TextInput
        className="bg-[#EBEBE6] p-4 rounded-xl text-gray-800"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        placeholder={placeholder}
        placeholderTextColor="#A0A0A0"
      />
    </View>
  );
}