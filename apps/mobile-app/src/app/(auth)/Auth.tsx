import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import AuthInput from '../../components/AuthInput'; 
import SocialButton from '../../components/SocialButtons'; 

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', firstName: '', lastName: '' });

  const handleSubmit = async () => {
    if (!isLogin) {
      console.log("Registering", formData);
      router.push({
        pathname: "/(auth)/Verification",
        params: { email: formData.email }
      });
    } else {
      console.log("Logging in", formData);
      router.replace("/(tabs)/home"); 
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
            <View className="w-[48%]"><AuthInput label="First Name" placeholder="Lois" /></View>
            <View className="w-[48%]"><AuthInput label="Last Name" placeholder="Becket" /></View>
          </View>
        )}

        <AuthInput 
            label="Email" 
            placeholder="email@example.com" 
            value={formData.email}
            onChangeText={(text: string) => setFormData({...formData, email: text})} 
        />
        
        {!isLogin && <AuthInput label="Date of birth" placeholder="18/03/2024" />}
        
        <AuthInput label="Password" placeholder="*******" secureTextEntry={true} />
        
        {!isLogin && <AuthInput label="Confirm Password" placeholder="*******" secureTextEntry={true} />}

        {/* Forgot Password Link */}
        {isLogin && (
          <TouchableOpacity className="items-end mb-6">
            <Text className="text-brand-gold font-jakarta-medium text-sm">Forgot Password ?</Text>
          </TouchableOpacity>
        )}

        {/* Main Action Button */}
        <TouchableOpacity 
          className="bg-brand-red p-4 rounded-xl items-center mb-8"
          onPress={handleSubmit}>
          <Text className="text-white font-inter-medium text-base">{isLogin ? 'Log In' : 'Register'}</Text>
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