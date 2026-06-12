import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, type ScrollViewProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import { THEME, APP_NAME } from '../constants';

type ScreenShellProps = {
  title: string;
  subtitle?: string;
  sensorOnline?: boolean;
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
};

export default function ScreenShell({
  title,
  subtitle,
  sensorOnline,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  contentContainerStyle,
}: ScreenShellProps) {
  const navigation = useNavigation();

  const header = (
    <>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        >
          <Ionicons name="menu" size={24} color={THEME.text} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topBrand}>{APP_NAME}</Text>
          {sensorOnline !== undefined && (
            <View style={styles.onlineRow}>
              <View style={[
                styles.onlineDot,
                { backgroundColor: sensorOnline ? THEME.primary : THEME.danger },
              ]} />
              <Text style={styles.onlineText}>
                {sensorOnline ? 'Sensor online' : 'Connecting…'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.menuBtn} />
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </>
  );

  if (!scroll) {
    return (
      <View style={styles.container}>
        {header}
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.primary}
            colors={[THEME.primary]}
          />
        ) : undefined
      }
    >
      {header}
      {children}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { paddingHorizontal: 16 },
  content: { flex: 1, paddingHorizontal: 16 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  menuBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  topBarCenter: { flex: 1, alignItems: 'center' },
  topBrand: { fontSize: 13, fontWeight: '600', color: THEME.textMuted, letterSpacing: 1 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  onlineDot: { width: 6, height: 6, borderRadius: 3 },
  onlineText: { fontSize: 11, color: THEME.textMuted },
  titleBlock: { marginBottom: 20, paddingHorizontal: 4 },
  title: { fontSize: 28, fontWeight: '700', color: THEME.text },
  subtitle: { fontSize: 13, color: THEME.textMuted, marginTop: 6 },
});
