import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, GAS_THRESHOLD } from '../../constants';
import { fetchHistory } from '../../services/firebase';
import { api, type HistoryEntry } from '../../services/api';
import ScreenShell from '../../components/ScreenShell';
import GasChart from '../../components/GasChart';
import React from 'react';

type Filter = 'All' | 'Safe' | 'Leak';
type Reading = HistoryEntry;

export default function HistoryScreen() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');

  const load = useCallback(async () => {
    try {
      const data = await api.getHistory(50);
      setReadings(data);
    } catch {
      const data = await fetchHistory(50);
      setReadings(data as Reading[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = readings.filter(r => {
    if (filter === 'Safe') return r.status === 'safe';
    if (filter === 'Leak') return r.status === 'danger';
    return true;
  });

  const chartData = [...readings].reverse().slice(-20).map(r => ({ ppm: r.ppm }));
  const leakCount = readings.filter(r => r.status === 'danger').length;
  const avgPpm = readings.length
    ? Math.round(readings.reduce((a, r) => a + r.ppm, 0) / readings.length) : 0;

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-RW', {
        timeZone: 'Africa/Kigali',
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return ts; }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Loading history…</Text>
      </View>
    );
  }

  return (
    <ScreenShell
      title="History"
      subtitle={`${readings.length} readings · GET /api/history`}
      sensorOnline
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
    >
      <View style={styles.summaryRow}>
        <SummaryCard label="Total" value={String(readings.length)} />
        <SummaryCard label="Leaks" value={String(leakCount)} danger={leakCount > 0} />
        <SummaryCard label="Avg ppm" value={String(avgPpm)} />
        <SummaryCard label="Threshold" value={String(GAS_THRESHOLD)} />
      </View>

      <Text style={styles.sectionTitle}>TREND CHART</Text>
      <GasChart data={chartData} />

      <View style={styles.filterRow}>
        {(['All', 'Safe', 'Leak'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>READINGS TABLE</Text>
      {filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No readings found</Text>
        </View>
      ) : (
        filtered.map((r, i) => (
          <View key={i} style={[styles.row, r.status === 'danger' && styles.rowDanger]}>
            <Ionicons
              name={r.status === 'danger' ? 'warning' : 'checkmark-circle'}
              size={18}
              color={r.status === 'danger' ? THEME.danger : THEME.primary}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.rowPpm}>{r.ppm} ppm</Text>
              <Text style={styles.rowTime}>{formatTime(r.timestamp)}</Text>
            </View>
            <View style={[styles.badge, r.status === 'danger' ? styles.badgeDanger : styles.badgeSafe]}>
              <Text style={styles.badgeText}>{r.status === 'danger' ? 'Leak' : 'Safe'}</Text>
            </View>
          </View>
        ))
      )}
    </ScreenShell>
  );
}

function SummaryCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={[styles.summaryCard, danger && styles.summaryDanger]}>
      <Text style={[styles.summaryNum, danger && { color: THEME.danger }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: THEME.textMuted, fontSize: 13 },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  summaryCard: {
    flex: 1, backgroundColor: THEME.surface, borderRadius: 12,
    padding: 10, alignItems: 'center', borderWidth: 1, borderColor: THEME.border,
  },
  summaryDanger: { borderColor: THEME.dangerBorder, backgroundColor: THEME.dangerBg },
  summaryNum: { fontSize: 18, fontWeight: '700', color: THEME.text },
  summaryLabel: { fontSize: 10, color: THEME.textMuted, marginTop: 2 },
  sectionTitle: { fontSize: 11, color: THEME.textMuted, letterSpacing: 1, marginBottom: 10, marginTop: 16 },
  filterRow: { flexDirection: 'row', gap: 8, marginVertical: 16 },
  filterPill: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border,
  },
  filterActive: { backgroundColor: THEME.primaryGlow, borderColor: THEME.primary },
  filterText: { fontSize: 12, color: THEME.textMuted },
  filterTextActive: { color: THEME.primary, fontWeight: '600' },
  emptyBox: {
    backgroundColor: THEME.surface, borderRadius: 12, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: THEME.border,
  },
  emptyText: { color: THEME.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface,
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: THEME.border,
  },
  rowDanger: { borderColor: THEME.dangerBorder, backgroundColor: THEME.dangerBg },
  rowPpm: { fontSize: 14, fontWeight: '600', color: THEME.text },
  rowTime: { fontSize: 11, color: THEME.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeSafe: { backgroundColor: THEME.successBg },
  badgeDanger: { backgroundColor: THEME.dangerBg },
  badgeText: { fontSize: 11, fontWeight: '600', color: THEME.text },
});
