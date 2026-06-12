import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { GAS_THRESHOLD, COLORS } from '../constants';
import React from 'react';

type Props = {
  value: number;
  threshold?: number;
};

export default function GasMeter({ value, threshold = GAS_THRESHOLD }: Props) {
  const isSafe = value < threshold;
  const color = isSafe ? COLORS.primary : COLORS.danger;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const fillRatio = Math.min(value / 800, 1);
  const strokeDashoffset = circumference * (1 - fillRatio);

  return (
    <View style={styles.wrapper}>
      <Svg width={140} height={140} viewBox="0 0 140 140">
        <Circle cx={70} cy={70} r={radius} stroke="#eee" strokeWidth={10} fill="none" />
        <Circle
          cx={70} cy={70} r={radius}
          stroke={color}
          strokeWidth={10}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin="70,70"
        />
      </Svg>
      <View style={styles.overlay}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={styles.unit}>ppm</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  overlay: { position: 'absolute', alignItems: 'center' },
  value: { fontSize: 30, fontWeight: '600' },
  unit: { fontSize: 12, color: '#888' },
});
