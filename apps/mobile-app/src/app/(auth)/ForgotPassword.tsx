import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router } from 'expo-router';

import AuthInput from '../../components/AuthInput';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useTheme } from '../../contexts/ThemeContext';

const backIcon = require('../../assets/icons/back.png');

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { forgotPassword } = useAuth();
  const { showAlert } = useAlert();
  const { resolved } = useTheme();
  const iconTint = resolved === 'dark' ? '#ECEDEE' : '#1A1C1E';

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendCode = async () => {
    if (!email) {
      showAlert({ title: 'Error', message: 'Please enter your email address' });
      return;
    }

    if (!validateEmail(email)) {
      showAlert({ title: 'Error', message: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);

    try {
      await forgotPassword(email);
      showAlert({
        title: 'Code Sent',
        message: 'If an account with that email exists, a reset code has been sent.',
      });
      router.push({
        pathname: '/(auth)/ResetPassword',
        params: { email },
      });
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-beige dark:bg-brand-dark-bg">
      <KeyboardAwareScrollView
        contentContainerStyle={{ padding: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 justify-center items-center -ml-2 mt-4 mb-4">
          <Image source={backIcon} style={{ width: 24, height: 24, tintColor: iconTint }} />
        </TouchableOpacity>

        <Text className="font-inter-medium text-4xl text-gray-900 dark:text-brand-dark-text mb-4">Forgot Password</Text>
        <Text className="text-gray-600 dark:text-brand-dark-text-secondary font-inter text-lg mb-8">
          Enter your email address and we'll send you a code to reset your password.
        </Text>

        <AuthInput
          label="Email"
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          type="email"
        />

        {/* Send Code Button */}
        <TouchableOpacity
          className="bg-brand-red p-4 rounded-xl items-center mt-4"
          onPress={handleSendCode}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-inter-medium text-base">Send Code</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
