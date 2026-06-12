import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';

type Props = {
  ppm: number;
  time: string;
  status: 'safe' | 'danger';
};

export default function ReadingCard({ ppm, time, status }: Props) {
  const isLeak = status === 'danger';
  return (
    <View style={[styles.card, isLeak && styles.cardDanger]}>
      <View style={styles.left}>
        <Ionicons
          name={isLeak ? 'warning' : 'checkmark-circle'}
          size={20}
          color={isLeak ? COLORS.dangerDark : COLORS.successDark}
        />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.ppm}>{ppm} ppm</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
      </View>
      <View style={[styles.badge, isLeak ? styles.badgeDanger : styles.badgeSafe]}>
        <Text style={[styles.badgeText, { color: isLeak ? COLORS.dangerDark : COLORS.successDark }]}>
          {isLeak ? 'Leak!' : 'Safe'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: '#e0e0e0' },
  cardDanger: { borderColor: '#F7C1C1', backgroundColor: '#FFFAFA' },
  left: { flexDirection: 'row', alignItems: 'center' },
  ppm: { fontSize: 14, fontWeight: '500', color: '#1a1a1a' },
  time: { fontSize: 11, color: '#888', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeSafe: { backgroundColor: COLORS.successLight },
  badgeDanger: { backgroundColor: COLORS.dangerLight },
  badgeText: { fontSize: 11, fontWeight: '500' },
});
