import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../constants';
import {
  subscribeToSensor,
  setLampRelay,
  clearLampRelay,
  type SensorData,
} from '../../services/firebase';
import { api } from '../../services/api';
import ScreenShell from '../../components/ScreenShell';
import React from 'react';

export default function RelaysScreen() {
  const [electricity, setElectricity] = useState<'on' | 'off'>('on');
  const [fan, setFan] = useState<'on' | 'off'>('off');
  const [manualMode, setManualMode] = useState(false);
  const [isLeaking, setIsLeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sensorOnline, setSensorOnline] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSensor((data: SensorData) => {
      setSensorOnline(true);
      setIsLeaking(data.status === 'danger');
      setElectricity(data.electricity);
      setFan(data.fan);
    });
    return () => unsub();
  }, []);

  const toggleManualMode = async (enabled: boolean) => {
    setManualMode(enabled);
    if (!enabled) {
      try {
        await api.setRelay('auto');
      } catch {
        await clearLampRelay();
      }
      Alert.alert('Auto mode', 'Lamp returns to sensor control. Fan always local.');
    } else {
      Alert.alert(
        'Manual lamp override',
        'Sends commands to backend → Firebase /gas/relay. Fan is never controlled remotely (v2.1).',
      );
    }
  };

  const toggleLamp = () => {
    if (!manualMode) {
      Alert.alert('Enable manual mode', 'Turn on manual mode to override the lamp relay.');
      return;
    }
    if (isLeaking) {
      Alert.alert('Leak active', 'Device keeps lamp OFF during leak regardless of app.');
      return;
    }
    const next = electricity === 'on' ? 'off' : 'on';
    Alert.alert(
      next === 'off' ? 'Cut electricity?' : 'Restore electricity?',
      'Sends command via backend API to /gas/relay.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              await api.setRelay(next);
              setElectricity(next);
            } catch {
              try {
                await setLampRelay(next);
                setElectricity(next);
              } catch {
                Alert.alert('Error', 'Could not reach backend or Firebase relay');
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenShell
      title="Relay Control"
      subtitle="v2.1 — lamp remote, fan local only"
      sensorOnline={sensorOnline}
    >
      <View style={styles.modeCard}>
        <View style={styles.modeLeft}>
          <Ionicons name="hand-left-outline" size={22} color={THEME.primary} />
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.modeTitle}>Manual lamp override</Text>
            <Text style={styles.modeSub}>Writes to /gas/relay</Text>
          </View>
        </View>
        <Switch
          value={manualMode}
          onValueChange={toggleManualMode}
          trackColor={{ false: THEME.border, true: THEME.primaryMuted }}
          thumbColor={manualMode ? THEME.primary : THEME.textMuted}
        />
      </View>

      {isLeaking && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={18} color={THEME.danger} />
          <Text style={styles.warningText}>Leak active — device controls lamp & fan locally</Text>
        </View>
      )}

      <RelayCard
        icon="flash"
        title="Electricity (lamp)"
        subtitle={electricity === 'on' ? 'Power ON' : 'Power CUT OFF'}
        remote
        active={electricity === 'on'}
        danger={electricity === 'off'}
        onToggle={toggleLamp}
        disabled={!manualMode || loading}
      />

      <RelayCard
        icon="partly-sunny-outline"
        title="Exhaust fan"
        subtitle={fan === 'on' ? 'RUNNING' : 'OFF'}
        localOnly
        active={fan === 'on'}
      />

      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={THEME.primary} />
          <Text style={styles.loadingText}>Writing /gas/relay…</Text>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>v2.1 relay rules</Text>
        {[
          'Fan: always controlled by gas sensor on device',
          'Lamp: sensor on leak; app can override via /gas/relay when safe',
          'Active-LOW relays: LOW = energized (ON)',
        ].map((line, i) => (
          <Text key={i} style={styles.infoText}>• {line}</Text>
        ))}
      </View>
    </ScreenShell>
  );
}

function RelayCard({
  icon, title, subtitle, active, danger, remote, localOnly, onToggle, disabled,
}: {
  icon: string; title: string; subtitle: string;
  active?: boolean; danger?: boolean; remote?: boolean; localOnly?: boolean;
  onToggle?: () => void; disabled?: boolean;
}) {
  const inner = (
    <View style={[
      styles.relayCard,
      active && styles.relayActive,
      danger && styles.relayDanger,
      disabled && styles.relayDisabled,
      localOnly && styles.relayLocal,
    ]}>
      <View style={styles.relayLeft}>
        <Ionicons name={icon as any} size={24} color={THEME.primary} />
        <View>
          <Text style={styles.relayTitle}>{title}</Text>
          <Text style={styles.relaySub}>{subtitle}</Text>
          {remote && <Text style={styles.badgeRemote}>Remote (/gas/relay)</Text>}
          {localOnly && <Text style={styles.badgeLocal}>Local sensor only</Text>}
        </View>
      </View>
      {!localOnly && (
        <View style={[styles.togglePill, active && styles.togglePillOn]}>
          <Text style={styles.toggleText}>{active ? 'ON' : 'OFF'}</Text>
        </View>
      )}
    </View>
  );

  if (localOnly || !onToggle) return inner;
  return (
    <TouchableOpacity onPress={onToggle} disabled={disabled} activeOpacity={0.8}>
      {inner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  modeCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: THEME.surface, borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: THEME.border,
  },
  modeLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  modeTitle: { fontSize: 15, fontWeight: '600', color: THEME.text },
  modeSub: { fontSize: 12, color: THEME.textMuted, marginTop: 2 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.dangerBg, padding: 12, borderRadius: 10,
    marginBottom: 16, borderWidth: 1, borderColor: THEME.dangerBorder,
  },
  warningText: { fontSize: 13, color: THEME.danger, flex: 1 },
  relayCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: THEME.surface, borderRadius: 16, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: THEME.border,
  },
  relayActive: { borderColor: THEME.successBorder },
  relayDanger: { borderColor: THEME.dangerBorder, backgroundColor: THEME.dangerBg },
  relayDisabled: { opacity: 0.6 },
  relayLocal: { opacity: 0.85 },
  relayLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  relayTitle: { fontSize: 16, fontWeight: '600', color: THEME.text },
  relaySub: { fontSize: 13, color: THEME.textSecondary, marginTop: 2 },
  badgeRemote: { fontSize: 10, color: THEME.info, marginTop: 4 },
  badgeLocal: { fontSize: 10, color: THEME.textMuted, marginTop: 4 },
  togglePill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: THEME.bgSecondary, borderWidth: 1, borderColor: THEME.border,
  },
  togglePillOn: { backgroundColor: THEME.primaryGlow, borderColor: THEME.primary },
  toggleText: { fontSize: 12, fontWeight: '700', color: THEME.text },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  loadingText: { color: THEME.textMuted, fontSize: 13 },
  infoCard: {
    backgroundColor: THEME.surface, borderRadius: 14, padding: 16,
    marginTop: 8, borderWidth: 1, borderColor: THEME.border,
  },
  infoTitle: { fontSize: 13, fontWeight: '600', color: THEME.textSecondary, marginBottom: 10 },
  infoText: { fontSize: 12, color: THEME.textMuted, marginBottom: 6, lineHeight: 18 },
});
