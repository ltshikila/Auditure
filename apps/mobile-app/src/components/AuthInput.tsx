// apps/mobile-app/src/components/AuthInput.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePickerModal from './DatePickerModal';

interface AuthInputProps {
  label: string;
  value?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  onChangeText?: (text: string) => void;
  error?: string;
  type?: 'text' | 'email' | 'password' | 'date';
  keyboardType?: 'default' | 'email-address' | 'numeric';
  textContentType?: TextInput['props']['textContentType'];
  autoComplete?: TextInput['props']['autoComplete'];
}

export default function AuthInput({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  placeholder,
  error,
  type = 'text',
  keyboardType = 'default',
  textContentType,
  autoComplete,
}: AuthInputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [focused, setFocused] = useState(false);

  const isPasswordField = secureTextEntry || type === 'password';
  const isDateField = type === 'date';

  const formatDisplayDate = (isoDate: string): string => {
    if (!isoDate) return '';
    const [yyyy, mm, dd] = isoDate.split('-');
    return `${mm}/${dd}/${yyyy}`;
  };

  const handleDateConfirm = (date: Date) => {
    setShowDatePicker(false);
    if (onChangeText) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      onChangeText(`${yyyy}-${mm}-${dd}`);
    }
  };

  const dateFieldContent = (
    <View className={`flex-row items-center bg-[#F1EEE3] dark:bg-brand-dark-input rounded-xl ${focused || showDatePicker ? 'border-2 border-brand-gold' : 'border-2 border-transparent'} ${error ? 'border-red-500' : ''}`}>
      <Text
        className={`flex-1 font-inter py-4 px-4 ${value ? 'text-[#1A1C1E] dark:text-brand-dark-text' : 'text-[#858585] dark:text-brand-dark-text-secondary'}`}
      >
        {value ? formatDisplayDate(value) : placeholder || 'Select date'}
      </Text>
      <View className="pr-4">
        <Ionicons name="calendar-outline" size={24} color="#858585" />
      </View>
    </View>
  );

  return (
    <View className="mb-4">
      <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-jakarta mb-1 ml-1">{label}</Text>

      {isDateField ? (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowDatePicker(true)}
        >
          {dateFieldContent}
        </TouchableOpacity>
      ) : (
        <View className={`flex-row items-center bg-[#F1EEE3] dark:bg-brand-dark-input rounded-xl ${focused ? 'border-2 border-brand-gold' : 'border-2 border-transparent'} ${error ? 'border-red-500' : ''}`}>
          <TextInput
            className="flex-1 font-inter py-4 px-4 text-[#1A1C1E] dark:text-brand-dark-text"
            value={value}
            onChangeText={onChangeText}
            secureTextEntry={isPasswordField && !isPasswordVisible}
            placeholder={placeholder}
            placeholderTextColor="#858585"
            keyboardType={type === 'email' ? 'email-address' : keyboardType}
            autoCapitalize={type === 'email' ? 'none' : 'sentences'}
            textContentType={textContentType}
            autoComplete={autoComplete}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
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
        </View>
      )}

      {error && (
        <View className="flex-row items-center mt-1 ml-1">
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text className="text-red-500 font-jakarta text-xs ml-1">{error}</Text>
        </View>
      )}

      {isDateField && (
        <DatePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onConfirm={handleDateConfirm}
          value={value ? new Date(value) : undefined}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
        />
      )}
    </View>
  );
}
