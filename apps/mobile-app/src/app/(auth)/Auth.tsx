// src/app/(auth)/Auth.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router'; // Ensure this import is correct

import AuthInput from '../../components/AuthInput'; 
import SocialButton from '../../components/SocialButtons'; 

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '', firstName: '', lastName: '' });

  const toggle = () => setIsLogin(!isLogin);

  const handleSubmit = async () => {
    if (!isLogin) {
      console.log("Registering", formData);
      router.push({
        pathname: "/(auth)/Verification",
        params: { email: formData.email }
      });
    } else {
      console.log("Logging in", formData);
      // FIXED: Include the group name '(tabs)' in the path
      router.replace("/(tabs)/home"); 
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FDFBF7]">
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        
        {/* Header Icon */}
        <View className="items-center mt-8 mb-6">
          <View className="w-12 h-12 bg-[#8B0000] rounded-lg rotate-45" /> 
        </View>

        <Text className="text-3xl font-bold text-center text-gray-900 mb-2">
          {isLogin ? 'Welcome Back' : 'Get Started now'}
        </Text>
        <Text className="text-center text-gray-500 mb-8">
          Create an account or log in to explore about our app
        </Text>

        {/* Toggle Switch */}
        <View className="bg-[#E6E2D6] rounded-full p-1 flex-row mb-8">
          <TouchableOpacity 
            onPress={() => setIsLogin(true)}
            className={`flex-1 p-3 rounded-full items-center ${isLogin ? 'bg-[#C5A065]' : 'bg-transparent'}`}>
            <Text className={`font-bold ${isLogin ? 'text-white' : 'text-gray-500'}`}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setIsLogin(false)}
            className={`flex-1 p-3 rounded-full items-center ${!isLogin ? 'bg-[#C5A065]' : 'bg-transparent'}`}>
            <Text className={`font-bold ${!isLogin ? 'text-white' : 'text-gray-500'}`}>Sign Up</Text>
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
            // FIXED: Typed 'text' argument explicitly
            onChangeText={(text: string) => setFormData({...formData, email: text})} 
        />
        
        {!isLogin && <AuthInput label="Date of birth" placeholder="18/03/2024" />}
        
        <AuthInput label="Password" placeholder="*******" secureTextEntry={true} />
        
        {!isLogin && <AuthInput label="Confirm Password" placeholder="*******" secureTextEntry={true} />}

        {/* Forgot Password Link */}
        {isLogin && (
          <TouchableOpacity className="items-end mb-6">
            <Text className="text-[#C5A065] font-bold">Forgot Password ?</Text>
          </TouchableOpacity>
        )}

        {/* Main Action Button */}
        <TouchableOpacity 
          className="bg-[#8B0000] p-4 rounded-xl items-center mb-8"
          onPress={handleSubmit}>
          <Text className="text-white font-bold text-lg">{isLogin ? 'Log In' : 'Register'}</Text>
        </TouchableOpacity>

        {/* Divider */}
        {isLogin && (
          <View className="flex-row items-center mb-8">
            <View className="flex-1 h-[1px] bg-gray-300" />
            <Text className="mx-4 text-gray-400">Or login with</Text>
            <View className="flex-1 h-[1px] bg-gray-300" />
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