import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import AuthInput from '../../components/AuthInput';
import SocialButton from '../../components/SocialButtons';
import { useAuth } from '../../contexts/AuthContext';

interface ValidationErrors {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  confirmPassword?: string;
}

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { register, login } = useAuth();

  // Validation functions
  const validateEmail = (email: string): string | undefined => {
    if (!email) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return 'Please enter a valid email';
    return undefined;
  };

  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    if (!/(?=.*[a-z])/.test(password)) return 'Must contain a lowercase letter';
    if (!/(?=.*[A-Z])/.test(password)) return 'Must contain an uppercase letter';
    if (!/(?=.*\d)/.test(password)) return 'Must contain a number';
    return undefined;
  };

  const validateConfirmPassword = (confirmPassword: string): string | undefined => {
    if (!confirmPassword) return 'Please confirm your password';
    if (confirmPassword !== formData.password) return 'Passwords do not match';
    return undefined;
  };

  const validateName = (name: string, field: string): string | undefined => {
    if (!name) return `${field} is required`;
    if (name.length < 2) return `Must be at least 2 characters`;
    if (!/^[a-zA-Z\s'-]+$/.test(name)) return `Contains invalid characters`;
    return undefined;
  };

  const validateDateOfBirth = (date: string): string | undefined => {
    if (!date) return undefined; // Optional field
    const selectedDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - selectedDate.getFullYear();
    if (age < 13) return 'You must be at least 13 years old';
    if (age > 120) return 'Please enter a valid date of birth';
    return undefined;
  };

  // Real-time validation
  useEffect(() => {
    const newErrors: ValidationErrors = {};

    if (touched.email) {
      newErrors.email = validateEmail(formData.email);
    }

    if (touched.password) {
      newErrors.password = validatePassword(formData.password);
    }

    if (!isLogin) {
      if (touched.firstName) {
        newErrors.firstName = validateName(formData.firstName, 'First name');
      }
      if (touched.lastName) {
        newErrors.lastName = validateName(formData.lastName, 'Last name');
      }
      if (touched.dateOfBirth) {
        newErrors.dateOfBirth = validateDateOfBirth(formData.dateOfBirth);
      }
      if (touched.confirmPassword) {
        newErrors.confirmPassword = validateConfirmPassword(formData.confirmPassword);
      }
    }

    setErrors(newErrors);
  }, [formData, touched, isLogin]);

  const handleFieldChange = (field: keyof typeof formData, value: string) => {
    setFormData({ ...formData, [field]: value });
    setTouched({ ...touched, [field]: true });
  };

  const handleSubmit = async () => {
    // Mark all fields as touched to show all validation errors
    const allTouched = {
      email: true,
      password: true,
      firstName: !isLogin,
      lastName: !isLogin,
      dateOfBirth: !isLogin,
      confirmPassword: !isLogin
    };
    setTouched(allTouched);

    // Check for validation errors
    const hasErrors = Object.values(errors).some(error => error !== undefined);
    if (hasErrors) {
      Alert.alert('Validation Error', 'Please fix all errors before submitting');
      return;
    }

    // Basic validation
    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin && (!formData.firstName || !formData.lastName)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      if (!isLogin) {
        const response = await register({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth || undefined,
        });

        Alert.alert('Success', 'Registration successful! Please check your email for verification code.');
        router.push({
          pathname: '/(auth)/Verification',
          params: { email: response.email },
        });
      } else {
        const response = await login({
          email: formData.email,
          password: formData.password,
        });

        if (response.requiresVerification) {
          Alert.alert('Verification Required', 'Please verify your email. A verification code has been sent.');
          router.push({
            pathname: '/(auth)/Verification',
            params: { email: response.email },
          });
        } else {
          router.replace('/(tabs)/home');
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-beige">
      <ScrollView contentContainerStyle={{ padding: 24 }}>

        {/* Header Icon */}
        <View className="items-center mt-8 mb-6">
          <View className="w-12 h-12 bg-brand-red rounded-lg rotate-45" />
        </View>

        <Text className="font-inter-medium text-4xl text-center text-gray-900 mb-2">
          {isLogin ? 'Welcome Back' : 'Get Started now'}
        </Text>
        <Text className="font-jakarta text-center text-[#6C7278] my-5 px-8">
          Create an account or log in to explore about our app
        </Text>

        {/* Toggle Switch */}
        <View className="bg-[#E7E0CB] rounded-lg p-1 flex-row mb-8">
          <TouchableOpacity
            onPress={() => setIsLogin(true)}
            className={`flex-1 p-3 rounded-lg items-center ${isLogin ? 'bg-brand-gold' : 'bg-transparent'}`}>
            <Text className={`font-jakarta-medium ${isLogin ? 'text-white' : 'text-gray-500'}`}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsLogin(false)}
            className={`flex-1 p-3 rounded-lg items-center ${!isLogin ? 'bg-brand-gold' : 'bg-transparent'}`}>
            <Text className={`font-jakarta-medium ${!isLogin ? 'text-white' : 'text-gray-500'}`}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        {!isLogin && (
          <View className="flex-row justify-between">
            <View className="w-[48%]">
              <AuthInput
                label="First Name"
                placeholder="Lois"
                value={formData.firstName}
                onChangeText={(text: string) => handleFieldChange('firstName', text)}
                error={touched.firstName ? errors.firstName : undefined}
                type="text"
              />
            </View>
            <View className="w-[48%]">
              <AuthInput
                label="Last Name"
                placeholder="Becket"
                value={formData.lastName}
                onChangeText={(text: string) => handleFieldChange('lastName', text)}
                error={touched.lastName ? errors.lastName : undefined}
                type="text"
              />
            </View>
          </View>
        )}

        <AuthInput
          label="Email"
          placeholder="email@example.com"
          value={formData.email}
          onChangeText={(text: string) => handleFieldChange('email', text)}
          error={touched.email ? errors.email : undefined}
          type="email"
        />

        {!isLogin && (
          <AuthInput
            label="Date of birth (Optional)"
            placeholder="Select date"
            value={formData.dateOfBirth}
            onChangeText={(text: string) => handleFieldChange('dateOfBirth', text)}
            error={touched.dateOfBirth ? errors.dateOfBirth : undefined}
            type="date"
          />
        )}

        <AuthInput
          label="Password"
          placeholder="*******"
          type="password"
          value={formData.password}
          onChangeText={(text: string) => handleFieldChange('password', text)}
          error={touched.password ? errors.password : undefined}
        />

        {!isLogin && (
          <AuthInput
            label="Confirm Password"
            placeholder="*******"
            type="password"
            value={formData.confirmPassword}
            onChangeText={(text: string) => handleFieldChange('confirmPassword', text)}
            error={touched.confirmPassword ? errors.confirmPassword : undefined}
          />
        )}

        {/* Forgot Password Link */}
        {isLogin && (
          <TouchableOpacity className="items-end mb-6">
            <Text className="text-brand-gold font-jakarta-medium text-sm">Forgot Password ?</Text>
          </TouchableOpacity>
        )}

        {/* Main Action Button */}
        <TouchableOpacity
          className="bg-brand-red p-4 rounded-xl items-center mb-8"
          onPress={handleSubmit}
          disabled={loading}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-inter-medium text-base">{isLogin ? 'Log In' : 'Register'}</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        {isLogin && (
          <View className="flex-row items-center mb-8">
            <View className="flex-1 h-[1px] bg-brand-gold" />
            <Text className="mx-4 text-gray-400">Or login with</Text>
            <View className="flex-1 h-[1px] bg-brand-gold" />
          </View>
        )}

        {/* Social Buttons */}
        {isLogin && (
          <View className="flex-row justify-center">
            <SocialButton icon="G" />
            <SocialButton icon="f" />
            <SocialButton icon="" />
            <SocialButton icon="📱" />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
