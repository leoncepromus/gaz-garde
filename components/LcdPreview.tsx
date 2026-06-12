import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../constants';

type LcdPreviewProps = {
  gasLevel: number | null;
  status: 'safe' | 'danger';
  online?: boolean;
};

/** Mirrors physical 16x2 LCD — v2.1 firmware format */
export default function LcdPreview({ gasLevel, status, online = true }: LcdPreviewProps) {
  const leaking = status === 'danger';
  const gas = gasLevel ?? 0;

  const line1 = `Gas Level: ${gas}`.padEnd(16).slice(0, 16);
  const line2 = (leaking ? '!! GAS LEAK !!' : 'Status: Safe').padEnd(16).slice(0, 16);

  if (!online) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>DEVICE LCD (v2.1)</Text>
        <View style={styles.screen}>
          <Text style={styles.line}>WiFi reconnect..</Text>
          <Text style={styles.line}>                </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>DEVICE LCD (v2.1)</Text>
      <View style={[styles.screen, leaking && styles.screenDanger]}>
        <Text style={[styles.line, leaking && styles.lineDanger]}>{line1}</Text>
        <Text style={[styles.line, leaking && styles.lineDanger]}>{line2}</Text>
      </View>
      <Text style={styles.hint}>Fan & lamp controlled on device · lamp override via /gas/relay</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 11, color: THEME.textMuted, letterSpacing: 1, marginBottom: 8 },
  screen: {
    backgroundColor: '#1a2e1a',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: '#2d4a2d',
  },
  screenDanger: { borderColor: THEME.dangerBorder, backgroundColor: '#2e1a1a' },
  line: {
    fontFamily: 'monospace',
    fontSize: 15,
    color: '#7cfc7c',
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  lineDanger: { color: '#ff6b6b' },
  hint: { fontSize: 10, color: THEME.textMuted, marginTop: 6, textAlign: 'center' },
});
