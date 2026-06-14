import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { GAS_THRESHOLD, THEME } from '../../constants';
import { type Incident } from '../../services/firebase';
import { api } from '../../services/api';
import {
  requestPermission,
  sendLocalLeakAlert,
  sendLocalSafeAlert,
} from '../../services/notifications';
import ScreenShell from '../../components/ScreenShell';
import LcdPreview from '../../components/LcdPreview';
import React from 'react';

type Reading = { ppm: number; status: 'safe' | 'danger'; time: string };

export default function Dashboard() {
  const [ppm, setPpm] = useState<number | null>(null);
  const [isLeaking, setIsLeaking] = useState(false);
  const [sensorOnline, setSensorOnline] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('—');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [alertStatus, setAlertStatus] = useState<string | null>(null);
  const [electricity, setElectricity] = useState<'on' | 'off'>('on');
  const [fan, setFan] = useState<'on' | 'off'>('off');
  const [rssi, setRssi] = useState<number | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [apiRefreshing, setApiRefreshing] = useState(false);

  const wasLeaking = useRef(false);
  const activeIncidentRef = useRef<Incident | null>(null);

  useEffect(() => {
    activeIncidentRef.current = activeIncident;
  }, [activeIncident]);

  const refreshFromBackend = useCallback(async () => {
    setApiRefreshing(true);
    try {
      const [health, gas, sensor] = await Promise.all([
        api.checkHealth(),
        api.getGas(),
        api.getSensor().catch(() => null),
      ]);
      const livePpm = gas.ppm ?? sensor?.ppm ?? sensor?.gasLevel ?? 0;
      const liveStatus = gas.status
        ?? (sensor?.status ?? (livePpm >= (sensor?.threshold ?? GAS_THRESHOLD) ? 'danger' : 'safe'));
      const timeStr = new Date(gas.timestamp ?? Date.now()).toLocaleTimeString('en-RW', {
        timeZone: 'Africa/Kigali',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });

      setBackendOnline(health.status === 'ok');
      setPpm(livePpm);
      setIsLeaking(liveStatus === 'danger');
      setSensorOnline(true);
      setLastUpdated(timeStr);
      setReadings((prev) => [{ ppm: livePpm, status: liveStatus, time: timeStr }, ...prev.slice(0, 9)]);

      if (sensor) {
        if (sensor.electricity) setElectricity(sensor.electricity);
        if (sensor.fan) setFan(sensor.fan);
        if (sensor.rssi != null) setRssi(sensor.rssi);
      }

      if (liveStatus === 'danger' && !wasLeaking.current) {
        wasLeaking.current = true;
        await sendLocalLeakAlert(livePpm);
        router.push('/alert');
        setAlertStatus('Backend alerting: voice, SMS, USSD…');
      } else if (liveStatus !== 'danger' && wasLeaking.current) {
        wasLeaking.current = false;
        await sendLocalSafeAlert(livePpm);
        setAlertStatus('resolved');
        setTimeout(() => setAlertStatus(null), 4000);
      }
    } catch {
      setBackendOnline(false);
      setSensorOnline(false);
    } finally {
      setApiRefreshing(false);
    }
  }, []);

  useEffect(() => {
    requestPermission();
    refreshFromBackend();
    const timer = setInterval(refreshFromBackend, 5000);
    return () => clearInterval(timer);
  }, [refreshFromBackend]);

  useEffect(() => {
    if (!isLeaking) return undefined;
    const refreshIncident = () => {
      api.getActiveIncident()
        .then((inc) => { if (inc) setActiveIncident(inc as Incident); })
        .catch(() => {});
    };
    refreshIncident();
    const timer = setInterval(refreshIncident, 15000);
    return () => clearInterval(timer);
  }, [isLeaking]);


  const fillPercent = Math.min(((ppm ?? 0) / 800) * 100, 100);

  return (
    <ScreenShell
      title="Dashboard"
      subtitle={backendOnline === false
        ? 'Live sensor · backend offline'
        : backendOnline
          ? 'Live gas monitoring · cloud connected'
          : 'Live gas monitoring'}
      sensorOnline={sensorOnline}
    >
      {backendOnline !== null && (
        <TouchableOpacity
          style={[styles.apiBar, backendOnline ? styles.apiBarOnline : styles.apiBarOffline]}
          onPress={refreshFromBackend}
          disabled={apiRefreshing}
        >
          <Ionicons
            name={backendOnline ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={16}
            color={backendOnline ? THEME.primary : THEME.danger}
          />
          <Text style={styles.apiBarText}>
            {apiRefreshing
              ? 'Syncing GET /api/gas + /api/sensor…'
              : backendOnline
                ? `Backend online · ${api.baseUrl}`
                : 'Backend offline — tap to retry'}
          </Text>
          <Ionicons name="refresh" size={14} color={THEME.textMuted} />
        </TouchableOpacity>
      )}

      {alertStatus === 'resolved' && (
        <View style={styles.resolvedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={THEME.success} />
          <Text style={styles.resolvedText}>Gas resolved — local alarms reset</Text>
        </View>
      )}

      {alertStatus && alertStatus !== 'resolved' && (
        <View style={styles.statusBanner}>
          <Ionicons name="notifications" size={15} color={THEME.info} />
          <Text style={styles.statusText}>{alertStatus}</Text>
        </View>
      )}

      {activeIncident && activeIncident.status === 'active' && (
        <View style={[
          styles.incidentBanner,
          activeIncident.acknowledged ? styles.incidentAcked : styles.incidentActive,
        ]}>
          <Ionicons
            name={activeIncident.acknowledged ? 'checkmark-done' : 'alert-circle'}
            size={16}
            color={activeIncident.acknowledged ? THEME.success : THEME.danger}
          />
          <Text style={styles.incidentText}>
            {activeIncident.acknowledged
              ? `Acknowledged via ${activeIncident.ackChannel} — fan/buzzer still active until safe`
              : `Active incident — peak ${activeIncident.peakPpm} ppm · tap Alert to acknowledge`}
          </Text>
        </View>
      )}

      {isLeaking && activeIncident && !activeIncident.acknowledged && (
        <TouchableOpacity
          style={styles.ackBanner}
          onPress={() => router.push('/alert')}
        >
          <Ionicons name="hand-left" size={16} color={THEME.primary} />
          <Text style={styles.ackBannerText}>
            Tap to acknowledge alert via backend
          </Text>
          <Ionicons name="chevron-forward" size={16} color={THEME.primary} />
        </TouchableOpacity>
      )}

      <View style={[styles.banner, isLeaking ? styles.bannerDanger : styles.bannerSafe]}>
        <Ionicons
          name={isLeaking ? 'warning' : 'shield-checkmark'}
          size={20}
          color={isLeaking ? THEME.danger : THEME.primary}
        />
        <Text style={styles.bannerText}>
          {ppm === null
            ? 'Connecting to sensor…'
            : isLeaking
            ? `LEAK DETECTED — ${ppm} ppm. Evacuate now.`
            : `All clear — ${ppm} ppm is within safe limits.`}
        </Text>
      </View>

      <View style={[styles.gaugeCard, isLeaking && styles.gaugeDanger]}>
        <Text style={styles.gaugeLabel}>CURRENT GAS LEVEL</Text>
        <Text style={[styles.gaugeValue, isLeaking && { color: THEME.danger }]}>
          {ppm ?? '—'}
        </Text>
        <Text style={styles.gaugeUnit}>ppm</Text>

        <View style={styles.gaugeRing}>
          <View style={[styles.gaugeFill, {
            width: `${fillPercent}%`,
            backgroundColor: isLeaking ? THEME.danger : THEME.primary,
          }]} />
          <View style={[styles.thresholdMark, { left: `${(GAS_THRESHOLD / 800) * 100}%` }]} />
        </View>

        <View style={styles.gaugeFooter}>
          <Text style={styles.gaugeMeta}>Threshold: {GAS_THRESHOLD} ppm</Text>
          <Text style={styles.gaugeMeta}>{lastUpdated}</Text>
        </View>
      </View>

      <LcdPreview
        gasLevel={ppm}
        status={isLeaking ? 'danger' : 'safe'}
        online={sensorOnline}
      />

      <View style={styles.statsRow}>
        <Stat icon="flash" label="Electricity" value={electricity === 'on' ? 'ON' : 'CUT OFF'}
          danger={electricity === 'off'} />
        <Stat icon="partly-sunny-outline" label="Exhaust fan" value={fan === 'on' ? 'RUNNING' : 'OFF'}
          active={fan === 'on'} />
        <Stat icon="wifi" label="Signal" value={rssi !== null ? `${rssi} dBm` : '—'} />
      </View>

      {isLeaking && (
        <View style={styles.channelsCard}>
          <Text style={styles.channelsTitle}>Alert channels (redundant)</Text>
          <View style={styles.channelsRow}>
            {[
              { icon: 'phone-portrait', label: 'App', on: true },
              { icon: 'call', label: 'Voice', on: activeIncident?.channels?.voice },
              { icon: 'chatbubble', label: 'SMS', on: activeIncident?.channels?.sms },
              { icon: 'keypad', label: 'USSD', on: true },
            ].map((ch) => (
              <View key={ch.label} style={styles.channelItem}>
                <Ionicons
                  name={ch.icon as any}
                  size={20}
                  color={ch.on ? THEME.danger : THEME.textMuted}
                />
                <Text style={styles.channelLabel}>{ch.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>LIVE READINGS</Text>
      {readings.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Waiting for sensor data…</Text>
        </View>
      ) : (
        readings.map((r, i) => (
          <View key={i} style={[styles.row, r.status === 'danger' && styles.rowDanger]}>
            <Ionicons
              name={r.status === 'danger' ? 'warning' : 'checkmark-circle'}
              size={18}
              color={r.status === 'danger' ? THEME.danger : THEME.primary}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.rowPpm}>{r.ppm} ppm</Text>
              <Text style={styles.rowTime}>{r.time}</Text>
            </View>
            <View style={[styles.badge, r.status === 'danger' ? styles.badgeDanger : styles.badgeSafe]}>
              <Text style={styles.badgeText}>{r.status === 'danger' ? 'Leak' : 'Safe'}</Text>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.emergencyBtn}
        onPress={() => Linking.openURL('tel:+250780838274')}
      >
        <Ionicons name="call" size={18} color="#fff" />
        <Text style={styles.emergencyBtnText}>Emergency call</Text>
      </TouchableOpacity>
    </ScreenShell>
  );
}

function Stat({
  icon, label, value, danger, active,
}: {
  icon: string; label: string; value: string;
  danger?: boolean; active?: boolean;
}) {
  return (
    <View style={[
      styles.statCard,
      danger && styles.statDanger,
      active && styles.statActive,
    ]}>
      <Ionicons
        name={icon as any}
        size={20}
        color={danger ? THEME.danger : active ? THEME.info : THEME.primary}
      />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, danger && { color: THEME.danger }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  resolvedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.successBg, padding: 12, borderRadius: 12,
    marginBottom: 12, borderWidth: 1, borderColor: THEME.successBorder,
  },
  resolvedText: { fontSize: 13, color: THEME.success, fontWeight: '500' },
  apiBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 10, marginBottom: 12, borderWidth: 1,
  },
  apiBarOnline: { backgroundColor: THEME.primaryGlow, borderColor: THEME.successBorder },
  apiBarOffline: { backgroundColor: THEME.dangerBg, borderColor: THEME.dangerBorder },
  apiBarText: { flex: 1, fontSize: 11, color: THEME.textSecondary },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.infoBg, padding: 10, borderRadius: 10, marginBottom: 12,
  },
  statusText: { fontSize: 12, color: THEME.info },
  incidentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1,
  },
  incidentActive: { backgroundColor: THEME.dangerBg, borderColor: THEME.dangerBorder },
  incidentAcked: { backgroundColor: THEME.successBg, borderColor: THEME.successBorder },
  incidentText: { flex: 1, fontSize: 12, color: THEME.textSecondary, lineHeight: 17 },
  ackBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.primaryGlow, padding: 12, borderRadius: 12,
    marginBottom: 12, borderWidth: 1, borderColor: THEME.successBorder,
  },
  ackBannerText: { flex: 1, fontSize: 12, color: THEME.primary, fontWeight: '600' },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, marginBottom: 16,
    borderWidth: 1,
  },
  bannerSafe: { backgroundColor: THEME.successBg, borderColor: THEME.successBorder },
  bannerDanger: { backgroundColor: THEME.dangerBg, borderColor: THEME.dangerBorder },
  bannerText: { flex: 1, fontSize: 13, color: THEME.text, fontWeight: '500', lineHeight: 18 },
  gaugeCard: {
    backgroundColor: THEME.surface, borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: THEME.border,
  },
  gaugeDanger: { borderColor: THEME.dangerBorder, backgroundColor: THEME.surfaceElevated },
  gaugeLabel: { fontSize: 11, color: THEME.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  gaugeValue: { fontSize: 72, fontWeight: '300', color: THEME.primary, lineHeight: 80 },
  gaugeUnit: { fontSize: 16, color: THEME.textMuted, marginBottom: 16 },
  gaugeRing: {
    width: '100%', height: 8, backgroundColor: THEME.bgSecondary,
    borderRadius: 4, overflow: 'visible', position: 'relative',
  },
  gaugeFill: { height: '100%', borderRadius: 4 },
  thresholdMark: {
    position: 'absolute', top: -5, width: 2, height: 18,
    backgroundColor: THEME.danger, borderRadius: 1,
  },
  gaugeFooter: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 10 },
  gaugeMeta: { fontSize: 11, color: THEME.textMuted },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: THEME.surface, borderRadius: 14,
    padding: 12, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: THEME.border,
  },
  statDanger: { borderColor: THEME.dangerBorder, backgroundColor: THEME.dangerBg },
  statActive: { borderColor: 'rgba(56,189,248,0.4)', backgroundColor: THEME.infoBg },
  statLabel: { fontSize: 10, color: THEME.textMuted, textAlign: 'center' },
  statValue: { fontSize: 12, fontWeight: '600', color: THEME.text, textAlign: 'center' },
  channelsCard: {
    backgroundColor: THEME.dangerBg, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: THEME.dangerBorder,
  },
  channelsTitle: { fontSize: 11, color: THEME.danger, fontWeight: '600', marginBottom: 10, letterSpacing: 0.5 },
  channelsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  channelItem: { alignItems: 'center', gap: 4 },
  channelLabel: { fontSize: 9, color: THEME.textMuted },
  sectionTitle: { fontSize: 11, color: THEME.textMuted, letterSpacing: 1, marginBottom: 10 },
  emptyBox: {
    backgroundColor: THEME.surface, borderRadius: 12, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: THEME.border, marginBottom: 12,
  },
  emptyText: { color: THEME.textMuted, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.surface,
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: THEME.border,
  },
  rowDanger: { borderColor: THEME.dangerBorder, backgroundColor: THEME.dangerBg },
  rowPpm: { fontSize: 14, fontWeight: '600', color: THEME.text },
  rowTime: { fontSize: 11, color: THEME.textMuted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeSafe: { backgroundColor: THEME.successBg },
  badgeDanger: { backgroundColor: THEME.dangerBg },
  badgeText: { fontSize: 11, fontWeight: '600', color: THEME.text },
  emergencyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: THEME.danger, borderRadius: 14, padding: 16, marginTop: 8,
  },
  emergencyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
