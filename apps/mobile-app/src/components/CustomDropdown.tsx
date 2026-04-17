import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DropdownOption {
    label: string;
    value: string;
}

interface CustomDropdownProps {
    label: string;
    options: DropdownOption[];
    selectedValue: string;
    onSelect: (value: string) => void;
    placeholder?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    label,
    options,
    selectedValue,
    onSelect,
    placeholder = 'Select an option',
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (value: string) => {
        onSelect(value);
        setIsOpen(false);
    };

    const selectedOption = options.find(opt => opt.value === selectedValue);

    return (
        <View className="mb-6">
            {label && <Text className="text-[#1A1C1E] dark:text-brand-dark-text font-inter-medium text-lg mb-2">{label}</Text>}
            <TouchableOpacity
                onPress={() => setIsOpen(!isOpen)}
                className="flex-row items-center justify-between bg-transparent border border-brand-gold rounded-2xl px-4 py-3.5">
                <Text className="font-inter text-[#1A1C1E] dark:text-brand-dark-text">
                    {selectedOption?.label || placeholder}
                </Text>
                <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={24}
                    color="#BF9A54"
                />
            </TouchableOpacity>

            {isOpen && (
                <View className="bg-white dark:bg-brand-dark-surface rounded-2xl mt-2 overflow-hidden" style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 5,
                }}>
                    {options.map((option, index) => {
                        const isSelected = option.value === selectedValue;
                        return (
                            <TouchableOpacity
                                key={option.value}
                                onPress={() => handleSelect(option.value)}
                                className={`px-5 py-3.5 ${
                                    index < options.length - 1 ? 'border-b border-[#F0F0F0]' : ''
                                } ${isSelected ? 'bg-[#FDFBF7] dark:bg-brand-dark-surface' : ''}`}>
                                <Text
                                    className={`font-inter text-base ${
                                        isSelected ? 'text-brand-gold font-inter-medium' : 'text-[#1A1C1E] dark:text-brand-dark-text'
                                    }`}>
                                    {option.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}
        </View>
    );
};
