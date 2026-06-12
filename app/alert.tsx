import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { THEME, GAS_THRESHOLD, USSD_CODE } from '../constants';
import { subscribeToGasLevel, subscribeToActiveIncident, type Incident } from '../services/firebase';
import { api } from '../services/api';
import React from 'react';

const ACTION_ITEMS = [
  { key: 'push', label: 'Push notification sent', channel: 'push' },
  { key: 'voice', label: 'Voice call to emergency contact', channel: 'voice' },
  { key: 'sms', label: 'SMS alert sent', channel: 'sms' },
  { key: 'incident', label: 'Incident logged in cloud', channel: null },
  { key: 'fan', label: 'Exhaust fan activated (local)', channel: null },
];

export default function AlertScreen() {
  const [ppm, setPpm] = useState<number | null>(null);
  const [incident, setIncident] = useState<Incident | null>(null);
  const [acking, setAcking] = useState(false);
  const [triggeredAt] = useState(
    new Date().toLocaleTimeString('en-RW', {
      timeZone: 'Africa/Kigali',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }),
  );

  useEffect(() => {
    const unsubGas = subscribeToGasLevel((newPpm) => {
      setPpm(newPpm);
      if (newPpm < GAS_THRESHOLD) {
        Alert.alert(
          'Gas level is safe',
          `Level dropped to ${newPpm} ppm. Local alarms reset. Monitoring continues.`,
          [{ text: 'Go back', onPress: () => router.back() }],
        );
      }
    });

    const unsubIncident = subscribeToActiveIncident(setIncident);

    return () => {
      unsubGas();
      unsubIncident();
    };
  }, []);

  const handleCall = () => {
    Alert.alert('Call emergency contact?', '+250 78 083 8274', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call now', style: 'destructive', onPress: () => Linking.openURL('tel:+250780838274') },
    ]);
  };

  const handleAcknowledge = async () => {
    if (!incident?.id) {
      Alert.alert('No incident', 'Waiting for cloud incident record…');
      return;
    }
    if (incident.acknowledged) {
      router.back();
      return;
    }

    Alert.alert(
      'Acknowledge alert?',
      'Confirms you received the warning. Repeated voice/SMS reminders will stop. Local fan and buzzer stay on until gas is safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, I received it',
          onPress: async () => {
            setAcking(true);
            try {
              await api.acknowledgeIncident(incident.id!, 'app');
              Alert.alert(
                'Acknowledged',
                `Escalation stopped. USSD users can also ack via ${USSD_CODE} → 5.`,
                [{ text: 'OK', onPress: () => router.back() }],
              );
            } catch {
              Alert.alert('Error', `Could not send acknowledgment. Try USSD ${USSD_CODE} → 5.`);
            } finally {
              setAcking(false);
            }
          },
        },
      ],
    );
  };

  const fillPercent = Math.min(((ppm ?? 0) / 800) * 100, 100);
  const escalation = incident?.escalationLevel ?? 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconCircle}>
        <Ionicons name="warning" size={52} color={THEME.danger} />
      </View>

      <Text style={styles.title}>Gas Leak Detected</Text>
      <Text style={styles.subtitle}>Triggered at {triggeredAt} (Kigali)</Text>

      {incident && !incident.acknowledged && escalation > 0 && (
        <View style={styles.escalationBanner}>
          <Ionicons name="repeat" size={16} color={THEME.warning} />
          <Text style={styles.escalationText}>
            Escalation {escalation} — no acknowledgment yet
          </Text>
        </View>
      )}

      {incident?.acknowledged && (
        <View style={styles.ackedBanner}>
          <Ionicons name="checkmark-done" size={16} color={THEME.success} />
          <Text style={styles.ackedText}>
            Acknowledged via {incident.ackChannel} — reminders stopped
          </Text>
        </View>
      )}

      <View style={styles.ppmCard}>
        <Text style={styles.ppmLabel}>CURRENT LEVEL</Text>
        <Text style={styles.ppmValue}>{ppm ?? '—'}</Text>
        <Text style={styles.ppmUnit}>ppm</Text>
        <View style={styles.ppmBar}>
          <View style={[styles.ppmBarFill, { width: `${fillPercent}%` }]} />
        </View>
        <Text style={styles.ppmThreshold}>
          Safe limit: {GAS_THRESHOLD} ppm
          {ppm !== null && ppm >= GAS_THRESHOLD && ` · ${ppm - GAS_THRESHOLD} above limit`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Immediate actions</Text>
        {[
          'Do NOT switch lights or appliances on or off',
          'Open all windows and doors immediately',
          'Turn off the gas supply valve if safe to do so',
          'Evacuate everyone from the building now',
          'Call emergency services from outside',
        ].map((item, i) => (
          <View key={i} style={styles.instructionRow}>
            <View style={styles.numBadge}><Text style={styles.numText}>{i + 1}</Text></View>
            <Text style={styles.instructionText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actionsCard}>
        <Text style={styles.actionsTitle}>Automated response</Text>
        {ACTION_ITEMS.map((item) => {
          const delivered = item.channel
            ? incident?.channels?.[item.channel]
            : !!incident;
          return (
            <View key={item.key} style={styles.actionRow}>
              <Ionicons
                name={delivered ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={delivered ? THEME.primary : THEME.textMuted}
              />
              <Text style={styles.actionText}>{item.label}</Text>
            </View>
          );
        })}
        <Text style={styles.ussdHint}>No smartphone? Dial {USSD_CODE} → 5 to acknowledge.</Text>
      </View>

      <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
        <Ionicons name="call" size={18} color="#fff" />
        <Text style={styles.callBtnText}>Call emergency contact</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.ackBtn, incident?.acknowledged && styles.ackBtnDone]}
        onPress={handleAcknowledge}
        disabled={acking}
      >
        {acking ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="hand-left" size={18} color="#fff" />
            <Text style={styles.ackBtnText}>
              {incident?.acknowledged ? 'Acknowledged — go back' : 'I received this alert — acknowledge'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  content: { padding: 20, paddingTop: 60, alignItems: 'center' },
  iconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: THEME.dangerBg, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: THEME.dangerBorder,
  },
  title: { fontSize: 26, fontWeight: '700', color: THEME.danger, marginBottom: 4 },
  subtitle: { fontSize: 13, color: THEME.textMuted, marginBottom: 16 },
  escalationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(251,191,36,0.12)', padding: 10, borderRadius: 10,
    marginBottom: 12, width: '100%', borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  escalationText: { fontSize: 12, color: THEME.warning, flex: 1 },
  ackedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.successBg, padding: 10, borderRadius: 10,
    marginBottom: 12, width: '100%', borderWidth: 1, borderColor: THEME.successBorder,
  },
  ackedText: { fontSize: 12, color: THEME.success, flex: 1 },
  ppmCard: {
    backgroundColor: THEME.surface, borderRadius: 16, padding: 20,
    alignItems: 'center', width: '100%', marginBottom: 16,
    borderWidth: 1, borderColor: THEME.dangerBorder,
  },
  ppmLabel: { fontSize: 11, color: THEME.textMuted, letterSpacing: 1 },
  ppmValue: { fontSize: 64, fontWeight: '300', color: THEME.danger, lineHeight: 72 },
  ppmUnit: { fontSize: 16, color: THEME.textMuted, marginBottom: 12 },
  ppmBar: {
    width: '100%', height: 6, backgroundColor: THEME.bgSecondary,
    borderRadius: 3, marginBottom: 8, overflow: 'hidden',
  },
  ppmBarFill: { height: '100%', backgroundColor: THEME.danger, borderRadius: 3 },
  ppmThreshold: { fontSize: 11, color: THEME.textMuted, textAlign: 'center' },
  card: {
    backgroundColor: THEME.surface, borderRadius: 14,
    padding: 16, width: '100%', marginBottom: 14,
    borderWidth: 1, borderColor: THEME.border,
  },
  cardTitle: { fontSize: 13, fontWeight: '600', color: THEME.text, marginBottom: 12 },
  instructionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  numBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: THEME.danger, alignItems: 'center', justifyContent: 'center',
  },
  numText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  instructionText: { flex: 1, fontSize: 12, color: THEME.textSecondary, lineHeight: 18 },
  actionsCard: {
    backgroundColor: THEME.successBg, borderRadius: 14,
    padding: 14, width: '100%', marginBottom: 20,
    borderWidth: 1, borderColor: THEME.successBorder,
  },
  actionsTitle: { fontSize: 12, fontWeight: '600', color: THEME.primary, marginBottom: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  actionText: { fontSize: 12, color: THEME.textSecondary },
  ussdHint: { fontSize: 11, color: THEME.textMuted, marginTop: 8, fontStyle: 'italic' },
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.danger, borderRadius: 14,
    padding: 16, width: '100%', justifyContent: 'center', marginBottom: 10,
  },
  callBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  ackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.primaryDark, borderRadius: 14,
    padding: 16, width: '100%', justifyContent: 'center', marginBottom: 30,
  },
  ackBtnDone: { backgroundColor: THEME.primaryMuted },
  ackBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'center' },
});
