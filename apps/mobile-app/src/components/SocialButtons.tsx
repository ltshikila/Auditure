// apps/mobile-app/src/components/SocialButtons.tsx
import React from 'react';
import { TouchableOpacity, Image, ImageSourcePropType } from 'react-native';

interface SocialButtonProps {
  icon: ImageSourcePropType;
}

export default function SocialButton({ icon }: SocialButtonProps) {
  return (
    <TouchableOpacity className="bg-[#EBEBE6] w-16 h-16 rounded-xl items-center justify-center mx-2">
      <Image source={icon} style={{ width: 28, height: 28 }} resizeMode="contain" />
    </TouchableOpacity>
  );
}