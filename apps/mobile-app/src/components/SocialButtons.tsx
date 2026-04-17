// apps/mobile-app/src/components/SocialButtons.tsx
import React from 'react';
import { TouchableOpacity, Image, ImageSourcePropType } from 'react-native';

interface SocialButtonProps {
  icon: ImageSourcePropType;
}

export default function SocialButton({ icon }: SocialButtonProps) {
  return (
    <TouchableOpacity className="bg-[#F5F5F0] dark:bg-brand-dark-surface w-16 h-16 rounded-xl items-center justify-center mx-2" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 }}>
      <Image source={icon} style={{ width: 28, height: 28, tintColor: '#BF9A54' }} resizeMode="contain" />
    </TouchableOpacity>
  );
}