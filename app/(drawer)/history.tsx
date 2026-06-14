import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
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

  useEffect(() => {
    load();
  }, [load]);

  // Handle local time conversions safely inside the timezone context
  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('en-RW', {
        timeZone: 'Africa/Kigali',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  // Process data operations cleanly using useMemo hooks to maximize rendering performance
  const dataMetrics = useMemo(() => {
    if (!readings.length) {
      return {
        latestPpm: 0,
        trendDelta: 0,
        avgPpm: 0,
        leakCount: 0,
        chartData: [],
        filteredReadings: [],
      };
    }

    // Assumptions: Firebase/API sends data chronologically (index 0 is oldest, last index is newest)
    const newestFirst = [...readings].reverse();
    const latestPpm = newestFirst[0]?.ppm ?? 0;
    const oldestPpm = readings[0]?.ppm ?? latestPpm;
    const trendDelta = latestPpm - oldestPpm;

    const leakCount = readings.filter((r) => r.status === 'danger').length;
    const avgPpm = Math.round(readings.reduce((a, r) => a + r.ppm, 0) / readings.length);

    // Extract the absolute newest 20 items, then reverse back for chronological graph rendering
    const chartData = newestFirst
      .slice(0, 20)
      .reverse()
      .map((r) => {
        const ts = new Date(r.timestamp);
        return {
          ppm: r.ppm,
          label: Number.isNaN(ts.getTime())
            ? ''
            : ts.toLocaleTimeString('en-RW', { hour: '2-digit', minute: '2-digit' }),
        };
      });

    // Handle interactive list structural filters
    const filteredReadings = readings.filter((r) => {
      if (filter === 'Safe') return r.status === 'safe';
      if (filter === 'Leak') return r.status === 'danger';
      return true;
    });

    return { latestPpm, trendDelta, avgPpm, leakCount, chartData, filteredReadings };
  }, [readings, filter]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.loadingText}>Loading history…</Text>
      </View>
    );
  }

  const { latestPpm, trendDelta, avgPpm, leakCount, chartData, filteredReadings } = dataMetrics;

  return (
    <ScreenShell
      title="History"
      subtitle={`${readings.length} readings · recent gas records`}
      sensorOnline
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      {/* Scrollable Container prevents layout snapping when strings scale up */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.summaryScroll}
      >
        <SummaryCard label="Total" value={String(readings.length)} />
        <SummaryCard 
          label="Latest" 
          value={`${latestPpm} ppm`} 
          danger={latestPpm >= GAS_THRESHOLD} 
        />
        <SummaryCard 
          label="Leaks" 
          value={String(leakCount)} 
          danger={leakCount > 0} 
        />
        <SummaryCard label="Avg ppm" value={String(avgPpm)} />
        <SummaryCard 
          label="Trend" 
          value={`${trendDelta >= 0 ? '+' : ''}${trendDelta} ppm`} 
          danger={trendDelta > 0} 
        />
      </ScrollView>

      <Text style={styles.sectionTitle}>TREND CHART</Text>
      <GasChart data={chartData} />

      <View style={styles.filterRow}>
        {(['All', 'Safe', 'Leak'] as Filter[]).map((f) => (
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
      {filteredReadings.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No readings found</Text>
        </View>
      ) : (
        filteredReadings.map((r, i) => {
          // Fallback uniquely identifying rows safely via timestamp combination strings
          const rowKey = r.id || `${r.timestamp}-${i}`;
          const isDanger = r.status === 'danger';
          
          return (
            <View key={rowKey} style={[styles.row, isDanger && styles.rowDanger]}>
              <Ionicons
                name={isDanger ? 'warning' : 'checkmark-circle'}
                size={18}
                color={isDanger ? THEME.danger : THEME.primary}
              />
              <View style={styles.rowMeta}>
                <Text style={styles.rowPpm}>{r.ppm} ppm</Text>
                <Text style={styles.rowTime}>{formatTime(r.timestamp)}</Text>
              </View>
              <View style={[styles.badge, isDanger ? styles.badgeDanger : styles.badgeSafe]}>
                <Text style={styles.badgeText}>{isDanger ? 'Leak' : 'Safe'}</Text>
              </View>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

function SummaryCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={[styles.summaryCard, danger && styles.summaryDanger]}>
      <Text style={[styles.summaryNum, danger && { color: THEME.danger }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: THEME.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: THEME.textMuted, fontSize: 13 },
  summaryScroll: { gap: 8, paddingRight: 16, marginBottom: 20 },
  summaryCard: {
    width: 96,
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  summaryDanger: { borderColor: THEME.dangerBorder, backgroundColor: THEME.dangerBg },
  summaryNum: { fontSize: 15, fontWeight: '700', color: THEME.text },
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
  rowMeta: { flex: 1, marginLeft: 10 },
  rowPpm: { fontSize: 14, fontWeight: '600', color: THEME.text },
  rowTime: { fontSize: 11, color: THEME.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeSafe: { backgroundColor: THEME.successBg },
  badgeDanger: { backgroundColor: THEME.dangerBg },
  badgeText: { fontSize: 11, fontWeight: '600', color: THEME.text },
});