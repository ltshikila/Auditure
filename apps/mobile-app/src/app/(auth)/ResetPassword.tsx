import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { router, useLocalSearchParams } from 'expo-router';

import AuthInput from '../../components/AuthInput';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';

const backIcon = require('../../assets/icons/back.png');

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resetPassword, forgotPassword } = useAuth();
  const { showAlert } = useAlert();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmError, setConfirmError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (!/(?=.*[a-z])/.test(password)) return 'Must contain a lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Must contain an uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Must contain a number';
    return undefined;
  };

  useEffect(() => {
    if (newPassword) {
      setPasswordError(validatePassword(newPassword));
    }
    if (confirmPassword) {
      setConfirmError(
        confirmPassword !== newPassword ? 'Passwords do not match' : undefined
      );
    }
  }, [newPassword, confirmPassword]);

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

  const handleResetPassword = async () => {
    const otpCode = code.join('');

    if (otpCode.length !== 6) {
      showAlert({ title: 'Error', message: 'Please enter the complete 6-digit code' });
      return;
    }

    const passErr = validatePassword(newPassword);
    if (passErr) {
      setPasswordError(passErr);
      showAlert({ title: 'Error', message: passErr });
      return;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match');
      showAlert({ title: 'Error', message: 'Passwords do not match' });
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email || '', otpCode, newPassword);
      showAlert({
        title: 'Success',
        message: 'Your password has been reset. Please log in with your new password.',
      });
      router.replace('/(auth)/Auth');
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to reset password. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      showAlert({ title: 'Error', message: 'Email address not found' });
      return;
    }

    setResending(true);

    try {
      await forgotPassword(email);
      showAlert({ title: 'Success', message: 'A new reset code has been sent to your email' });
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error: any) {
      showAlert({
        title: 'Error',
        message: error.message || 'Failed to resend code. Please try again.',
      });
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
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 justify-center items-center -ml-2 mt-4 mb-4">
          <Image source={backIcon} style={{ width: 24, height: 24, tintColor: '#1A1C1E' }} />
        </TouchableOpacity>

        <Text className="font-inter-medium text-4xl text-gray-900 mb-4">Reset Password</Text>
        <Text className="text-gray-600 font-inter text-lg mb-2">We sent a 6-digit code to:</Text>
        <Text className="text-gray-900 font-inter-bold text-xl mb-6">{email}</Text>

        <Text className="text-gray-600 font-inter mb-4">Enter the code:</Text>

        {/* Code Input Boxes */}
        <View className="flex-row justify-between mb-6">
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
        <TouchableOpacity onPress={handleResendCode} disabled={resending} className="mb-6">
          <Text className="text-brand-gold font-jakarta text-center">
            {resending ? 'Sending...' : "Didn't receive code? Resend"}
          </Text>
        </TouchableOpacity>

        {/* New Password Fields */}
        <AuthInput
          label="New Password"
          placeholder="*******"
          type="password"
          value={newPassword}
          onChangeText={setNewPassword}
          error={passwordError}
        />

        <AuthInput
          label="Confirm Password"
          placeholder="*******"
          type="password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          error={confirmError}
        />

        {/* Reset Password Button */}
        <TouchableOpacity
          className="bg-brand-red p-4 rounded-xl items-center mt-4"
          onPress={handleResetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-inter-medium text-base">Reset Password</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
