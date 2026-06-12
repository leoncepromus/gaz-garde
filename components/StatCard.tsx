import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  label: string;
  value: string;
  icon: string;
};

export default function StatCard({ label, value, icon }: Props) {
  return (
    <View style={styles.card}>
      <Ionicons name={icon as any} size={18} color="#1D9E75" />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: '#e0e0e0', gap: 4 },
  label: { fontSize: 11, color: '#888' },
  value: { fontSize: 22, fontWeight: '500', color: '#1a1a1a' },
});
