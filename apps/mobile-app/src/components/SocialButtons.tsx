// apps/mobile-app/src/components/SocialButtons.tsx
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';

// FIXED: Defined interface for strict typing
interface SocialButtonProps {
  icon: string;
}

export default function SocialButton({ icon }: SocialButtonProps) {
  return (
    <TouchableOpacity className="bg-[#EBEBE6] w-16 h-16 rounded-xl items-center justify-center mx-2">
      <Text className="text-xl">{icon}</Text>
    </TouchableOpacity>
  );
}