import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '@/components';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#FDFBF7]" edges={['top', 'left', 'right']}>
      <TopBar />
      <View className="flex-1 items-center justify-center">
        <Text className="text-3xl font-bold text-[#8B0000]">Auditure Home</Text>
        <Text className="text-gray-600 mt-2">Welcome to your library.</Text>
      </View>
    </SafeAreaView>
  );
}