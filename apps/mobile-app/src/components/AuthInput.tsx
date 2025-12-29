// apps/mobile-app/src/components/AuthInput.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface AuthInputProps {
  label: string;
  value?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  onChangeText?: (text: string) => void;
  error?: string;
  type?: 'text' | 'email' | 'password' | 'date';
  keyboardType?: 'default' | 'email-address' | 'numeric';
}

export default function AuthInput({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  placeholder,
  error,
  type = 'text',
  keyboardType = 'default'
}: AuthInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS
    if (selectedDate && onChangeText) {
      const formattedDate = selectedDate.toISOString().split('T')[0];
      onChangeText(formattedDate);
    }
  };

  const isPasswordField = secureTextEntry || type === 'password';
  const isDateField = type === 'date';

  return (
    <View className="mb-4">
      <Text className="text-[#1A1C1E] font-jakarta mb-1 ml-1">{label}</Text>

      <View className={`flex-row items-center bg-[#F1EEE3] rounded-xl ${focused ? 'border-2 border-brand-gold' : 'border-2 border-transparent'} ${error ? 'border-red-500' : ''}`}>
        <TextInput
          className="flex-1 font-inter py-5 px-4 text-[#1A1C1E]"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPasswordField && !isPasswordVisible}
          placeholder={placeholder}
          placeholderTextColor="#858585"
          keyboardType={type === 'email' ? 'email-address' : keyboardType}
          autoCapitalize={type === 'email' ? 'none' : 'sentences'}
          onFocus={() => {
            setFocused(true);
            if (isDateField) setShowDatePicker(true);
          }}
          onBlur={() => setFocused(false)}
          editable={!isDateField}
        />

        {isPasswordField && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            className="pr-4"
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color="#858585"
            />
          </TouchableOpacity>
        )}

        {isDateField && (
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="pr-4"
          >
            <Ionicons
              name="calendar-outline"
              size={24}
              color="#858585"
            />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View className="flex-row items-center mt-1 ml-1">
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text className="text-red-500 font-jakarta text-xs ml-1">{error}</Text>
        </View>
      )}

      {isDateField && showDatePicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
        />
      )}
    </View>
  );
}