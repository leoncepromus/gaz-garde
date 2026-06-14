import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal, Pressable,
  Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import {
  THEME, GAS_THRESHOLD, APP_NAME, USSD_CODE,
} from '../../constants';
import { getCurrentGasLevel } from '../../services/firebase';
import { api, configureApiBaseUrl, sensorPpm } from '../../services/api';
import ScreenShell from '../../components/ScreenShell';
import React from 'react';

const SETTINGS_KEY = 'gasSettings';

const DEFAULT_THRESHOLDS = {
  safeMax: 300,
  warningMax: 500,
  dangerMin: 501,
};

const REPEAT_INTERVALS = [
  { label: 'Every 60 seconds', seconds: 60 },
  { label: 'Every 2 minutes', seconds: 120 },
  { label: 'Every 3 minutes', seconds: 180 },
  { label: 'Every 5 minutes', seconds: 300 },
];

type GasSettings = {
  safeMax: number;
  warningMax: number;
  dangerMin: number;
  pushEnabled: boolean;
  voiceEnabled: boolean;
  ussdEnabled: boolean;
  repeatIntervalSec: number;
  primaryNumber: string;
  secondaryNumber: string;
  wifiSsid: string;
  wifiPassword: string;
  cloudServerUrl: string;
  apiKey: string;
  autoReset: boolean;
};

const DEFAULT_SETTINGS: GasSettings = {
  safeMax: DEFAULT_THRESHOLDS.safeMax,
  warningMax: DEFAULT_THRESHOLDS.warningMax,
  dangerMin: DEFAULT_THRESHOLDS.dangerMin,
  pushEnabled: true,
  voiceEnabled: true,
  ussdEnabled: true,
  repeatIntervalSec: 180,
  primaryNumber: '+250780838274',
  secondaryNumber: '',
  wifiSsid: '',
  wifiPassword: '',
  cloudServerUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001',
  apiKey: '',
  autoReset: true,
};

export default function SettingsScreen() {
  const [settings, setSettings] = useState<GasSettings>(DEFAULT_SETTINGS);
  const [safeMax, setSafeMax] = useState(String(DEFAULT_THRESHOLDS.safeMax));
  const [warningMax, setWarningMax] = useState(String(DEFAULT_THRESHOLDS.warningMax));
  const [dangerMin, setDangerMin] = useState(String(DEFAULT_THRESHOLDS.dangerMin));

  const [applyingThresholds, setApplyingThresholds] = useState(false);
  const [testingCall, setTestingCall] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [testingSafeAlert, setTestingSafeAlert] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [intervalModalVisible, setIntervalModalVisible] = useState(false);

  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [currentPpm, setCurrentPpm] = useState<number | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryCharging, setBatteryCharging] = useState(false);

  useEffect(() => {
    loadSettings();
    checkBackend();
    loadCurrentPpm();
    loadBatteryStatus();
  }, []);

  const persistSettings = async (next: GasSettings) => {
    setSettings(next);
    configureApiBaseUrl(next.cloudServerUrl);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  };

  const patchSettings = async (patch: Partial<GasSettings>) => {
    const next = { ...settings, ...patch };
    await persistSettings(next);
  };

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!saved) return;

      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      configureApiBaseUrl(
        process.env.EXPO_PUBLIC_API_URL
          ?? parsed.cloudServerUrl
          ?? 'http://localhost:3001',
      );
      setSettings(parsed);
      setSafeMax(String(parsed.safeMax ?? DEFAULT_THRESHOLDS.safeMax));
      setWarningMax(String(parsed.warningMax ?? DEFAULT_THRESHOLDS.warningMax));
      setDangerMin(String(parsed.dangerMin ?? DEFAULT_THRESHOLDS.dangerMin));
    } catch { /* ignore */ }
  };

  const loadBatteryStatus = async () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery = await (navigator as Navigator & {
          getBattery: () => Promise<{
            addEventListener(arg0: string, arg1: () => void): unknown; level: number; charging: boolean
          }>;
        }).getBattery();
        setBatteryLevel(Math.round(battery.level * 100));
        setBatteryCharging(battery.charging);
        battery.addEventListener?.('levelchange', () => {
          setBatteryLevel(Math.round(battery.level * 100));
        });
        battery.addEventListener?.('chargingchange', () => {
          setBatteryCharging(battery.charging);
        });
        return;
      } catch { /* fall through */ }
    }

    if (Device.isDevice) {
      setBatteryLevel(null);
    } else {
      setBatteryLevel(100);
    }
  };

  const checkBackend = async () => {
    try {
      await api.checkHealth();
      setBackendStatus('online');
    } catch {
      setBackendStatus('offline');
    }
  };

  const loadCurrentPpm = async () => {
    try {
      const gas = await api.getGas();
      setCurrentPpm(gas.ppm);
    } catch {
      setCurrentPpm(await getCurrentGasLevel());
    }
  };

  const validateThresholds = () => {
    const safe = parseInt(safeMax, 10);
    const warning = parseInt(warningMax, 10);
    const danger = parseInt(dangerMin, 10);

    if ([safe, warning, danger].some(n => Number.isNaN(n) || n < 0)) {
      Alert.alert('Invalid thresholds', 'Enter valid ppm numbers (0 or greater).');
      return null;
    }
    if (safe >= warning) {
      Alert.alert('Invalid thresholds', 'Warning level must be higher than safe max.');
      return null;
    }
    if (warning >= danger) {
      Alert.alert('Invalid thresholds', 'Danger level must be higher than warning max.');
      return null;
    }
    return { safe, warning, danger };
  };

  const handleApplyThresholds = async () => {
    const parsed = validateThresholds();
    if (!parsed) return;

    setApplyingThresholds(true);
    try {
      await patchSettings({
        safeMax: parsed.safe,
        warningMax: parsed.warning,
        dangerMin: parsed.danger,
      });
      Alert.alert(
        'Thresholds applied',
        `Safe: 0–${parsed.safe} ppm\nWarning: ${parsed.safe + 1}–${parsed.warning} ppm\nDanger: >${parsed.warning} ppm`,
      );
    } catch {
      Alert.alert('Error', 'Could not save thresholds.');
    } finally {
      setApplyingThresholds(false);
    }
  };

  const handleTestCall = async () => {
    const number = settings.primaryNumber.trim();
    if (!number) {
      Alert.alert('Missing number', 'Enter a primary contact number first.');
      return;
    }

    setTestingCall(true);
    try {
      const tel = number.startsWith('tel:') ? number : `tel:${number.replace(/\s/g, '')}`;
      const supported = await Linking.canOpenURL(tel);
      if (!supported) {
        Alert.alert('Unavailable', 'Phone calls are not supported on this device.');
        return;
      }
      await Linking.openURL(tel);
    } catch {
      Alert.alert('Error', 'Could not open the phone dialer.');
    } finally {
      setTestingCall(false);
    }
  };

  const handleTestBackendAlert = async () => {
    if (backendStatus !== 'online') {
      Alert.alert('Backend offline', 'Sync with the cloud server first.');
      return;
    }

    const ppm = currentPpm !== null && currentPpm >= GAS_THRESHOLD ? currentPpm : 512;

    Alert.alert(
      'Test backend alert?',
      `Triggers voice call + SMS via ${api.baseUrl} at ${ppm} ppm.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send test alert',
          style: 'destructive',
          onPress: async () => {
            setTestingAlert(true);
            try {
              const result = await api.triggerTestAlert(ppm);
              const voice = result.call.success ? 'sent' : `failed (${result.call.error ?? 'unknown'})`;
              const sms = result.sms.success ? 'sent' : `failed (${result.sms.error ?? 'unknown'})`;
              Alert.alert('Test alert', `Voice: ${voice}\nSMS: ${sms}`);
            } catch (err) {
              Alert.alert('Test failed', err instanceof Error ? err.message : 'Could not reach backend');
            } finally {
              setTestingAlert(false);
            }
          },
        },
      ],
    );
  };

  const handleTestSafeAlert = async () => {
    if (backendStatus !== 'online') {
      Alert.alert('Backend offline', 'Sync with the cloud server first.');
      return;
    }

    const ppm = currentPpm ?? 0;
    setTestingSafeAlert(true);
    try {
      const result = await api.triggerSafeAlert(ppm);
      const status = result.sms.success ? 'sent' : `failed (${result.sms.error ?? 'unknown'})`;
      Alert.alert('Safe notification', `All-clear SMS: ${status}`);
    } catch (err) {
      Alert.alert('Test failed', err instanceof Error ? err.message : 'Could not reach backend');
    } finally {
      setTestingSafeAlert(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncStatus(null);
    configureApiBaseUrl(settings.cloudServerUrl);
    try {
      const [health, gas, sensor] = await Promise.all([
        api.checkHealth(),
        api.getGas(),
        api.getSensor().catch(() => null),
      ]);
      setBackendStatus('online');
      setCurrentPpm(gas.ppm);
      setSyncStatus(
        `Cloud sync · ${gas.ppm} ppm (${gas.status})`
        + (sensor ? ` · sensor ${sensorPpm(sensor)} ppm` : ''),
      );
      Alert.alert(
        'Sync successful',
        `Health: ${health.status}\nGas: ${gas.ppm} ppm (${gas.status})\nThreshold: ${gas.threshold} ppm`,
      );
    } catch {
      setBackendStatus('offline');
      setSyncStatus('Connection failed');
      Alert.alert('Sync failed', 'Could not reach the cloud server. Check URL and network.');
    } finally {
      setSyncing(false);
    }
  };

  const handleFactoryReset = () => {
    Alert.alert(
      'Factory reset?',
      'This clears all saved settings on this device and restores defaults. Cloud data is not deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await AsyncStorage.removeItem(SETTINGS_KEY);
              setSettings(DEFAULT_SETTINGS);
              setSafeMax(String(DEFAULT_THRESHOLDS.safeMax));
              setWarningMax(String(DEFAULT_THRESHOLDS.warningMax));
              setDangerMin(String(DEFAULT_THRESHOLDS.dangerMin));
              setSyncStatus(null);
              Alert.alert('Reset complete', 'Settings restored to factory defaults.');
            } catch {
              Alert.alert('Error', 'Could not reset settings.');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  };

  const selectedInterval = REPEAT_INTERVALS.find(i => i.seconds === settings.repeatIntervalSec)
    ?? REPEAT_INTERVALS[2];

  const safeNum = parseInt(safeMax, 10) || DEFAULT_THRESHOLDS.safeMax;
  const warningNum = parseInt(warningMax, 10) || DEFAULT_THRESHOLDS.warningMax;
  const bandMax = Math.max(warningNum + 200, 800);

  const batteryDisplay = batteryLevel !== null ? `${batteryLevel}%` : '—';
  const batteryIcon = batteryLevel === null
    ? 'battery-half-outline'
    : batteryLevel > 60
      ? 'battery-full'
      : batteryLevel > 25
        ? 'battery-half'
        : 'battery-dead';

  return (
    <ScreenShell title="Settings" subtitle="Thresholds, alerts, cloud sync">
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, {
          backgroundColor: backendStatus === 'online' ? THEME.primary
            : backendStatus === 'offline' ? THEME.danger : THEME.textMuted,
        }]} />
        <Text style={styles.statusText}>
          Backend {backendStatus}
          {currentPpm !== null ? ` · ${currentPpm} ppm` : ''}
        </Text>
        <TouchableOpacity onPress={checkBackend}>
          <Ionicons name="refresh" size={16} color={THEME.textMuted} />
        </TouchableOpacity>
      </View>

      {/* 1. Gas Threshold Configuration — green */}
      <ColorSection
        title="Gas threshold configuration"
        icon="warning-outline"
        accent={THEME.primary}
        accentBg={THEME.primaryGlow}
        accentBorder={THEME.successBorder}
      >
        <Text style={styles.hint}>
          Safe: 0–{safeNum} ppm · Warning: {safeNum + 1}–{warningNum} ppm · Danger: &gt;{warningNum} ppm
        </Text>

        <ThresholdBand safeMax={safeNum} warningMax={warningNum} bandMax={bandMax} />

        <ThresholdInput label="Safe max (ppm)" value={safeMax} onChangeText={setSafeMax} color={THEME.primary} />
        <ThresholdInput label="Warning max (ppm)" value={warningMax} onChangeText={setWarningMax} color={THEME.warning} />
        <ThresholdInput label="Danger starts at (ppm)" value={dangerMin} onChangeText={setDangerMin} color={THEME.danger} />

        <ActionButton
          label="Apply thresholds"
          icon="checkmark-circle-outline"
          color={THEME.primary}
          textColor={THEME.bg}
          loading={applyingThresholds}
          onPress={handleApplyThresholds}
        />
      </ColorSection>

      {/* 2. Alert Channels — red */}
      <ColorSection
        title="Alert channels"
        icon="notifications-outline"
        accent={THEME.danger}
        accentBg={THEME.dangerBg}
        accentBorder={THEME.dangerBorder}
      >
        <ToggleRow
          icon="phone-portrait-outline"
          label="Mobile app notifications"
          value={settings.pushEnabled}
          onChange={(v) => patchSettings({ pushEnabled: v })}
        />
        <Divider accent={THEME.dangerBorder} />
        <ToggleRow
          icon="keypad-outline"
          label={`USSD alerts (${USSD_CODE})`}
          value={settings.ussdEnabled}
          onChange={(v) => patchSettings({ ussdEnabled: v })}
        />
        <Divider accent={THEME.dangerBorder} />
        <ToggleRow
          icon="call-outline"
          label="Voice call alerts"
          value={settings.voiceEnabled}
          onChange={(v) => patchSettings({ voiceEnabled: v })}
        />
        <Divider accent={THEME.dangerBorder} />
        <TouchableOpacity style={styles.dropdownRow} onPress={() => setIntervalModalVisible(true)}>
          <Ionicons name="time-outline" size={18} color={THEME.danger} />
          <View style={styles.dropdownContent}>
            <Text style={styles.dropdownLabel}>Alert repeat interval</Text>
            <Text style={styles.dropdownValue}>{selectedInterval.label}</Text>
          </View>
          <Ionicons name="chevron-down" size={18} color={THEME.textMuted} />
        </TouchableOpacity>
      </ColorSection>

      {/* 3. Emergency Contacts */}
      <ColorSection
        title="Emergency contacts"
        icon="call-outline"
        accent={THEME.danger}
        accentBg={THEME.dangerBg}
        accentBorder={THEME.dangerBorder}
      >
        <ContactField
          label="Primary contact number"
          value={settings.primaryNumber}
          onChangeText={(v) => patchSettings({ primaryNumber: v })}
        />
        <Divider accent={THEME.dangerBorder} />
        <ContactField
          label="Secondary contact number"
          value={settings.secondaryNumber}
          onChangeText={(v) => patchSettings({ secondaryNumber: v })}
        />
        <ActionButton
          label="Test call (dialer)"
          icon="call"
          color={THEME.dangerDark}
          loading={testingCall}
          onPress={handleTestCall}
        />
        <ActionButton
          label="Test voice + SMS"
          icon="megaphone-outline"
          color={THEME.danger}
          loading={testingAlert}
          onPress={handleTestBackendAlert}
        />
        <ActionButton
          label="Test safe SMS"
          icon="checkmark-circle-outline"
          color={THEME.primaryDark}
          loading={testingSafeAlert}
          onPress={handleTestSafeAlert}
        />
      </ColorSection>

      {/* 4. Cloud & Network — blue */}
      <ColorSection
        title="Cloud & network settings"
        icon="cloud-outline"
        accent={THEME.info}
        accentBg={THEME.infoBg}
        accentBorder="rgba(56, 189, 248, 0.35)"
      >
        <NetworkField
          label="Wi-Fi SSID"
          value={settings.wifiSsid}
          onChangeText={(v) => patchSettings({ wifiSsid: v })}
          autoCapitalize="none"
        />
        <Divider accent="rgba(56, 189, 248, 0.2)" />
        <NetworkField
          label="Wi-Fi password"
          value={settings.wifiPassword}
          onChangeText={(v) => patchSettings({ wifiPassword: v })}
          secureTextEntry
        />
        <Divider accent="rgba(56, 189, 248, 0.2)" />
        <NetworkField
          label="Cloud server URL"
          value={settings.cloudServerUrl}
          onChangeText={(v) => patchSettings({ cloudServerUrl: v })}
          autoCapitalize="none"
        />
        <Divider accent="rgba(56, 189, 248, 0.2)" />
        <NetworkField
          label="API key"
          value={settings.apiKey}
          onChangeText={(v) => patchSettings({ apiKey: v })}
          secureTextEntry
          autoCapitalize="none"
        />
        {syncStatus ? <Text style={styles.syncHint}>{syncStatus}</Text> : null}
        <ActionButton
          label="Sync now"
          icon="sync-outline"
          color={THEME.info}
          textColor={THEME.bg}
          loading={syncing}
          onPress={handleSyncNow}
        />
      </ColorSection>

      {/* 5. System Controls */}
      <ColorSection
        title="System controls"
        icon="construct-outline"
        accent={THEME.warning}
        accentBg="rgba(251, 191, 36, 0.12)"
        accentBorder="rgba(251, 191, 36, 0.35)"
      >
        <View style={styles.batteryRow}>
          <Ionicons
            name={batteryIcon as any}
            size={28}
            color={batteryLevel !== null && batteryLevel <= 25 ? THEME.danger : THEME.warning}
          />
          <View style={styles.batteryContent}>
            <Text style={styles.batteryLabel}>Battery status</Text>
            <Text style={styles.batteryValue}>
              {batteryDisplay}
              {batteryCharging ? ' · Charging' : ''}
            </Text>
            <View style={styles.batteryTrack}>
              <View style={[
                styles.batteryFill,
                {
                  width: `${batteryLevel ?? 50}%`,
                  backgroundColor: batteryLevel !== null && batteryLevel <= 25
                    ? THEME.danger : THEME.warning,
                },
              ]} />
            </View>
          </View>
        </View>
        <Divider accent="rgba(251, 191, 36, 0.25)" />
        <ToggleRow
          icon="refresh-circle-outline"
          label="Auto-reset after safe levels return"
          value={settings.autoReset}
          onChange={(v) => patchSettings({ autoReset: v })}
          accent={THEME.warning}
        />
        <ActionButton
          label="Factory reset"
          icon="trash-outline"
          color={THEME.surfaceElevated}
          textColor={THEME.danger}
          borderColor={THEME.dangerBorder}
          loading={resetting}
          onPress={handleFactoryReset}
        />
      </ColorSection>

      <Modal visible={intervalModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIntervalModalVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Alert repeat interval</Text>
            <Text style={styles.modalSub}>Repeat voice/SMS until acknowledged</Text>
            {REPEAT_INTERVALS.map((opt) => (
              <TouchableOpacity
                key={opt.seconds}
                style={[
                  styles.modalOption,
                  settings.repeatIntervalSec === opt.seconds && styles.modalOptionActive,
                ]}
                onPress={async () => {
                  await patchSettings({ repeatIntervalSec: opt.seconds });
                  setIntervalModalVisible(false);
                }}
              >
                <Text style={styles.modalOptionText}>{opt.label}</Text>
                {settings.repeatIntervalSec === opt.seconds && (
                  <Ionicons name="checkmark" size={18} color={THEME.danger} />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

function ColorSection({
  title, icon, accent, accentBg, accentBorder, children,
}: {
  title: string;
  icon: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { borderColor: accentBorder, backgroundColor: accentBg }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: accentBg, borderColor: accent }]}>
          <Ionicons name={icon as any} size={18} color={accent} />
        </View>
        <Text style={[styles.sectionTitle, { color: accent }]}>{title.toUpperCase()}</Text>
      </View>
      <View style={[styles.sectionBody, { borderColor: accentBorder }]}>{children}</View>
    </View>
  );
}

function ThresholdBand({
  safeMax, warningMax, bandMax,
}: { safeMax: number; warningMax: number; bandMax: number }) {
  const safePct = (safeMax / bandMax) * 100;
  const warnPct = ((warningMax - safeMax) / bandMax) * 100;
  const dangerPct = 100 - safePct - warnPct;

  return (
    <View style={styles.bandWrap}>
      <View style={styles.bandTrack}>
        <View style={[styles.bandSeg, { flex: safePct, backgroundColor: THEME.primary }]} />
        <View style={[styles.bandSeg, { flex: warnPct, backgroundColor: THEME.warning }]} />
        <View style={[styles.bandSeg, { flex: dangerPct, backgroundColor: THEME.danger }]} />
      </View>
      <View style={styles.bandLegend}>
        <LegendDot color={THEME.primary} label="Safe" />
        <LegendDot color={THEME.warning} label="Warning" />
        <LegendDot color={THEME.danger} label="Danger" />
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function ThresholdInput({
  label, value, onChangeText, color,
}: {
  label: string; value: string; onChangeText: (v: string) => void; color: string;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        style={[styles.fieldInput, { borderColor: color }]}
        placeholderTextColor={THEME.textMuted}
      />
    </View>
  );
}

function ContactField({
  label, value, onChangeText,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="phone-pad"
        style={styles.fieldInput}
        placeholderTextColor={THEME.textMuted}
      />
    </View>
  );
}

function NetworkField({
  label, value, onChangeText, secureTextEntry, autoCapitalize,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.fieldInput}
        placeholderTextColor={THEME.textMuted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

function ToggleRow({
  icon, label, value, onChange, accent = THEME.danger,
}: {
  icon: string; label: string; value: boolean;
  onChange: (v: boolean) => void; accent?: string;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={18} color={accent} />
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: THEME.border, true: accent + '55' }}
        thumbColor={value ? accent : THEME.textMuted}
      />
    </View>
  );
}

function Divider({ accent }: { accent: string }) {
  return <View style={[styles.divider, { backgroundColor: accent }]} />;
}

function ActionButton({
  label, icon, color, textColor = '#fff', borderColor, loading, onPress,
}: {
  label: string; icon: string; color: string; textColor?: string;
  borderColor?: string; loading?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        { backgroundColor: color, borderColor: borderColor ?? color },
        loading && styles.btnDisabled,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          <Ionicons name={icon as any} size={18} color={textColor} />
          <Text style={[styles.actionBtnText, { color: textColor }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: THEME.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: THEME.border,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { flex: 1, fontSize: 12, color: THEME.textSecondary },

  section: {
    borderRadius: 16, borderWidth: 1, marginTop: 16, overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8,
  },
  sectionIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
  },
  sectionBody: {
    backgroundColor: THEME.surface,
    borderTopWidth: 1, padding: 14, gap: 12,
  },

  hint: { fontSize: 12, color: THEME.textSecondary, lineHeight: 18 },

  bandWrap: { gap: 8 },
  bandTrack: {
    flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden',
    backgroundColor: THEME.border,
  },
  bandSeg: { height: '100%' },
  bandLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: THEME.textMuted },

  fieldRow: { gap: 6 },
  fieldLabel: { fontSize: 11, color: THEME.textMuted },
  fieldInput: {
    backgroundColor: THEME.bgSecondary, borderRadius: 10,
    borderWidth: 1, borderColor: THEME.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: THEME.text,
  },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 14, color: THEME.text },
  divider: { height: 1, opacity: 0.5 },

  dropdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4,
  },
  dropdownContent: { flex: 1 },
  dropdownLabel: { fontSize: 11, color: THEME.textMuted },
  dropdownValue: { fontSize: 14, color: THEME.text, marginTop: 2 },

  syncHint: { fontSize: 11, color: THEME.info, marginTop: -4 },

  batteryRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  batteryContent: { flex: 1, gap: 4 },
  batteryLabel: { fontSize: 11, color: THEME.textMuted },
  batteryValue: { fontSize: 16, fontWeight: '600', color: THEME.text },
  batteryTrack: {
    height: 6, borderRadius: 3, backgroundColor: THEME.border, overflow: 'hidden',
  },
  batteryFill: { height: '100%', borderRadius: 3 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 14, marginTop: 4, borderWidth: 1,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: THEME.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
    borderWidth: 1, borderColor: THEME.dangerBorder,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: THEME.text },
  modalSub: { fontSize: 12, color: THEME.textMuted, marginTop: 4, marginBottom: 16 },
  modalOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  modalOptionActive: { backgroundColor: THEME.dangerBg, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  modalOptionText: { fontSize: 15, color: THEME.text },

  appInfo: { fontSize: 11, color: THEME.textMuted, textAlign: 'center', marginTop: 10 },
});
