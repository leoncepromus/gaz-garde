import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';

type Props = {
  status: 'safe' | 'danger';
};

export default function AlertBanner({ status }: Props) {
  const isSafe = status === 'safe';
  return (
    <View style={[styles.banner, isSafe ? styles.safe : styles.danger]}>
      <Ionicons
        name={isSafe ? 'checkmark-circle' : 'warning'}
        size={18}
        color={isSafe ? COLORS.successDark : COLORS.dangerDark}
      />
      <Text style={[styles.text, { color: isSafe ? COLORS.successDark : COLORS.dangerDark }]}>
        {'  '}{isSafe ? 'All clear — gas level normal' : 'Gas leak detected! Evacuate now.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginBottom: 12 },
  safe: { backgroundColor: COLORS.successLight },
  danger: { backgroundColor: COLORS.dangerLight },
  text: { fontSize: 13, fontWeight: '500' },
});
