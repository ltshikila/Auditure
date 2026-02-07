// apps/mobile-app/src/app/(auth)/Verification.tsx
import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';

export default function VerificationScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verify, resendOTP } = useAuth();
  const { showAlert } = useAlert();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) {
      text = text[0];
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = code.join('');

    if (otpCode.length !== 6) {
      showAlert({ title: 'Error', message: 'Please enter the complete 6-digit code' });
      return;
    }

    setLoading(true);

    try {
      await verify({
        email: email || '',
        code: otpCode,
      });

      showAlert({ title: 'Success', message: 'Email verified successfully!' });
      router.replace('/(tabs)/home');
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Invalid verification code. Please try again.' });
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!email) {
      showAlert({ title: 'Error', message: 'Email address not found' });
      return;
    }

    setResending(true);

    try {
      await resendOTP(email);
      showAlert({ title: 'Success', message: 'A new verification code has been sent to your email' });
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      showAlert({ title: 'Error', message: error.message || 'Failed to resend code. Please try again.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} className="mt-8 mb-6">
          <Text className="text-2xl">←</Text>
        </TouchableOpacity>

        <Text className="font-inter-medium text-4xl text-gray-900 mb-4">Verification</Text>
        <Text className="text-gray-600 font-inter text-lg mb-4">We just sent a 6-digit code to:</Text>
        <Text className="text-gray-900 font-inter-bold text-xl mb-8">{email}</Text>

        <Text className="text-gray-600 font-inter mb-4">Enter the code to continue:</Text>

        {/* Code Input Boxes */}
        <View className="flex-row justify-between mb-12">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <TextInput
              key={i}
              ref={(ref) => {
                inputRefs.current[i] = ref;
              }}
              className="w-14 h-20 border border-[#BFA054] rounded-xl text-center text-xl font-jakarta-medium bg-[#F1EEE3] focus:border-[#C5A065]"
              keyboardType="numeric"
              maxLength={1}
              value={code[i]}
              onChangeText={(text) => handleCodeChange(text, i)}
              onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(key, i)}
            />
          ))}
        </View>

        {/* Resend Code */}
        <TouchableOpacity onPress={handleResendOTP} disabled={resending} className="mb-6">
          <Text className="text-brand-gold font-jakarta text-center">
            {resending ? 'Sending...' : "Didn't receive code? Resend"}
          </Text>
        </TouchableOpacity>

        {/* Verify Button */}
        <TouchableOpacity
          className="bg-brand-red p-4 rounded-xl items-center mb-8 mt-auto"
          onPress={handleVerify}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Verify</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}