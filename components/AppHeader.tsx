import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from './Header';

type AppHeaderProps = {
  sensorOnline?: boolean;
};

export default function AppHeader({
  sensorOnline = true,
}: AppHeaderProps) {
  return (
    <>
      <Header
        showLogo
        showSettings
        showHistory
      />

      <View style={styles.systemStatusCard}>
        <View style={styles.systemStatusLeft}>
          <Ionicons
            name="shield-checkmark"
            size={22}
            color={sensorOnline ? '#22C55E' : '#EF4444'}
          />

          <View>
            <Text style={styles.systemTitle}>
              System Status
            </Text>

            <Text style={styles.systemSubtitle}>
              {sensorOnline
                ? 'Monitoring device connected'
                : 'Waiting for device connection'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.onlineDot,
            {
              backgroundColor: sensorOnline
                ? '#22C55E'
                : '#EF4444',
            },
          ]}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  systemStatusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  systemStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  systemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
  },

  systemSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 10,
    marginTop: 2,
  },

  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});