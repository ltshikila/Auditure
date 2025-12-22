/// <reference types="nativewind/types" />
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import "./global.css"

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-900">
      <Text className="text-white text-2xl font-bold">
        NativeWind is working!
      </Text>
      <StatusBar style="light" />
    </View>
  );
}