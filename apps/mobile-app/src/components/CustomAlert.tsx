import React, { useEffect } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import type { AlertConfig, AlertButton } from '@/contexts/AlertContext';
import { useIsDark } from '@/hooks/use-colors';

interface CustomAlertProps {
  config: AlertConfig;
  visible: boolean;
  onDismiss: (onPress?: () => void | Promise<void>) => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const CustomAlert: React.FC<CustomAlertProps> = ({ config, visible, onDismiss }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const isDark = useIsDark();
  const cardBg = isDark ? '#1E2022' : '#FFFFFF';
  const titleColor = isDark ? '#ECEDEE' : '#2F2F2F';
  const messageColor = isDark ? '#9BA1A6' : '#6C7278';

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.85, { duration: 150 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const buttons: AlertButton[] = config.buttons?.length
    ? config.buttons
    : [{ text: 'OK', style: 'default' }];

  const isStacked = buttons.length > 2;

  const handleBackdropPress = () => {
    const cancelButton = buttons.find((b) => b.style === 'cancel');
    if (cancelButton) {
      onDismiss(cancelButton.onPress);
    } else if (buttons.length === 1) {
      onDismiss(buttons[0].onPress);
    }
  };

  const getButtonStyle = (style?: AlertButton['style']) => {
    switch (style) {
      case 'cancel':
        return isDark ? 'bg-brand-dark-surface-elevated' : 'bg-[#F5F5F0]';
      case 'destructive':
        return 'bg-[#920002]';
      default:
        return 'bg-[#BF9A54]';
    }
  };

  const getButtonTextStyle = (style?: AlertButton['style']) => {
    switch (style) {
      case 'cancel':
        return isDark ? 'text-brand-dark-text' : 'text-[#2F2F2F]';
      default:
        return 'text-white';
    }
  };

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <AnimatedPressable
        style={[{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }, overlayStyle]}
        onPress={handleBackdropPress}
      >
        <Animated.View
          style={[
            {
              backgroundColor: cardBg,
              borderRadius: 20,
              padding: 24,
              width: '100%',
              maxWidth: 340,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            },
            cardStyle,
          ]}
          // Prevent backdrop press from firing when tapping the card
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <Text
            style={{ fontFamily: 'PlusJakartaSans_700Bold', fontSize: 18, color: titleColor, textAlign: 'center', marginBottom: config.message ? 8 : 20 }}
          >
            {config.title}
          </Text>

          {config.message ? (
            <Text
              style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: messageColor, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}
            >
              {config.message}
            </Text>
          ) : null}

          <View style={isStacked ? { gap: 8 } : { flexDirection: 'row', gap: 12 }}>
            {buttons.map((button, index) => (
              <Pressable
                key={index}
                className={`${isStacked ? 'w-full' : 'flex-1'} py-3.5 rounded-xl ${getButtonStyle(button.style)} items-center justify-center`}
                onPress={() => onDismiss(button.onPress)}
              >
                <Text
                  style={{ fontFamily: 'Inter_500Medium', fontSize: 15 }}
                  className={getButtonTextStyle(button.style)}
                >
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </AnimatedPressable>
    </Modal>
  );
};
