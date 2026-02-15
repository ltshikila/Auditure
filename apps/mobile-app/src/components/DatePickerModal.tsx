import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3;

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(month: number, year: number): number {
    return new Date(year, month + 1, 0).getDate();
}

function generateYears(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= 1900; y--) {
        years.push(y);
    }
    return years;
}

interface WheelColumnProps {
    data: string[];
    selectedIndex: number;
    onSelect: (index: number) => void;
}

function WheelColumn({ data, selectedIndex, onSelect }: WheelColumnProps) {
    const listRef = useRef<FlatList>(null);
    const scrollingRef = useRef(false);

    useEffect(() => {
        if (!scrollingRef.current && listRef.current) {
            listRef.current.scrollToOffset({
                offset: selectedIndex * ITEM_HEIGHT,
                animated: false,
            });
        }
    }, [selectedIndex]);

    const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        const index = Math.round(y / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(index, data.length - 1));
        scrollingRef.current = false;
        if (clamped !== selectedIndex) {
            onSelect(clamped);
        }
    };

    const handleScrollBegin = () => {
        scrollingRef.current = true;
    };

    return (
        <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, overflow: 'hidden', flex: 1 }}>
            <FlatList
                ref={listRef}
                data={data}
                keyExtractor={(_, i) => i.toString()}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_HEIGHT}
                decelerationRate="fast"
                onScrollBeginDrag={handleScrollBegin}
                onMomentumScrollEnd={handleMomentumEnd}
                contentContainerStyle={{
                    paddingVertical: ITEM_HEIGHT * ((VISIBLE_ITEMS - 1) / 2),
                }}
                getItemLayout={(_, index) => ({
                    length: ITEM_HEIGHT,
                    offset: ITEM_HEIGHT * index,
                    index,
                })}
                renderItem={({ item, index }) => {
                    const isSelected = index === selectedIndex;
                    return (
                        <TouchableOpacity
                            onPress={() => {
                                onSelect(index);
                                listRef.current?.scrollToOffset({
                                    offset: index * ITEM_HEIGHT,
                                    animated: true,
                                });
                            }}
                            style={{
                                height: ITEM_HEIGHT,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Text
                                style={{
                                    fontSize: isSelected ? 18 : 15,
                                    fontWeight: isSelected ? '600' : '400',
                                    color: isSelected ? '#1A1C1E' : '#B0A898',
                                }}
                            >
                                {item}
                            </Text>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
}

interface DatePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (date: Date) => void;
    value?: Date;
    maximumDate?: Date;
    minimumDate?: Date;
}

export default function DatePickerModal({
    visible,
    onClose,
    onConfirm,
    value,
    maximumDate,
    minimumDate,
}: DatePickerModalProps) {
    const initial = value || new Date(2000, 0, 1);
    const [month, setMonth] = useState(initial.getMonth());
    const [day, setDay] = useState(initial.getDate());
    const [yearIndex, setYearIndex] = useState(0);

    const years = useRef(generateYears()).current;
    const yearStrings = useRef(years.map(String)).current;

    useEffect(() => {
        if (visible) {
            const d = value || new Date(2000, 0, 1);
            setMonth(d.getMonth());
            setDay(d.getDate());
            const yi = years.indexOf(d.getFullYear());
            setYearIndex(yi >= 0 ? yi : 0);
        }
    }, [visible]);

    const selectedYear = years[yearIndex] || new Date().getFullYear();
    const daysInMonth = getDaysInMonth(month, selectedYear);
    const clampedDay = Math.min(day, daysInMonth);

    const dayStrings: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
        dayStrings.push(String(d));
    }

    const handleConfirm = () => {
        const selected = new Date(selectedYear, month, clampedDay);
        if (maximumDate && selected > maximumDate) {
            onConfirm(maximumDate);
        } else if (minimumDate && selected < minimumDate) {
            onConfirm(minimumDate);
        } else {
            onConfirm(selected);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
            >
                <View
                    onStartShouldSetResponder={() => true}
                    style={{
                        backgroundColor: '#F5F0E8',
                        borderRadius: 20,
                        paddingVertical: 24,
                        paddingHorizontal: 20,
                        width: '85%',
                        maxWidth: 360,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 8,
                    }}
                >
                    <Text style={{ color: '#1A1C1E', fontSize: 20, fontWeight: '600', marginBottom: 20 }}>
                        Date of Birth
                    </Text>

                    {/* Wheel Columns */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Month */}
                        <WheelColumn
                            data={MONTHS}
                            selectedIndex={month}
                            onSelect={setMonth}
                        />

                        {/* Day */}
                        <WheelColumn
                            data={dayStrings}
                            selectedIndex={clampedDay - 1}
                            onSelect={(i) => setDay(i + 1)}
                        />

                        {/* Year */}
                        <WheelColumn
                            data={yearStrings}
                            selectedIndex={yearIndex}
                            onSelect={setYearIndex}
                        />
                    </View>

                    {/* Selection indicator lines */}
                    <View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: 20,
                            right: 20,
                            top: 24 + 20 + ITEM_HEIGHT,
                            height: ITEM_HEIGHT,
                            borderTopWidth: 1,
                            borderBottomWidth: 1,
                            borderColor: '#E0D9CC',
                        }}
                    />

                    {/* Buttons */}
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20, gap: 24 }}>
                        <TouchableOpacity onPress={onClose} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                            <Text style={{ color: '#858585', fontSize: 16 }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleConfirm} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                            <Text style={{ color: '#BF9A54', fontSize: 16, fontWeight: '600' }}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}
