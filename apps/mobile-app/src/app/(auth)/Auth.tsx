import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import AuthInput from '../../components/AuthInput';
import SocialButton from '../../components/SocialButtons';
import { useAuth } from '../../contexts/AuthContext';

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
  const [loading, setLoading] = useState(false);
  const { register, login } = useAuth();

  const handleSubmit = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!isLogin) {
      if (!formData.firstName || !formData.lastName) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      if (formData.password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters long');
        return;
      }
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
                onChangeText={(text: string) => setFormData({...formData, firstName: text})}
              />
            </View>
            <View className="w-[48%]">
              <AuthInput
                label="Last Name"
                placeholder="Becket"
                value={formData.lastName}
                onChangeText={(text: string) => setFormData({...formData, lastName: text})}
              />
            </View>
          </View>
        )}

        <AuthInput
            label="Email"
            placeholder="email@example.com"
            value={formData.email}
            onChangeText={(text: string) => setFormData({...formData, email: text})}
        />

        {!isLogin && (
          <AuthInput
            label="Date of birth"
            placeholder="YYYY-MM-DD"
            value={formData.dateOfBirth}
            onChangeText={(text: string) => setFormData({...formData, dateOfBirth: text})}
          />
        )}

        <AuthInput
          label="Password"
          placeholder="*******"
          secureTextEntry={true}
          value={formData.password}
          onChangeText={(text: string) => setFormData({...formData, password: text})}
        />

        {!isLogin && (
          <AuthInput
            label="Confirm Password"
            placeholder="*******"
            secureTextEntry={true}
            value={formData.confirmPassword}
            onChangeText={(text: string) => setFormData({...formData, confirmPassword: text})}
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
            <SocialButton icon="" />
            <SocialButton icon="📱" />
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}