import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useRouter, usePathname } from 'expo-router';
import { THEME, APP_NAME, USSD_CODE } from '../constants';

type DrawerProps = React.ComponentProps<typeof DrawerContentScrollView> & {
  state: { routes: { name: string; key: string }[]; index: number };
  navigation: { closeDrawer: () => void };
};

const MENU = [
  { name: 'index', label: 'Dashboard', icon: 'speedometer-outline' as const },
  { name: 'history', label: 'History', icon: 'bar-chart-outline' as const },
  { name: 'incidents', label: 'Incidents', icon: 'alert-circle-outline' as const },
  { name: 'relays', label: 'Relay Control', icon: 'flash-outline' as const },
  { name: 'emergency', label: 'USSD & Emergency', icon: 'call-outline' as const },
  { name: 'settings', label: 'Settings', icon: 'settings-outline' as const },
];

export default function DrawerContent(props: DrawerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeRoute = props.state.routes[props.state.index]?.name ?? 'index';

  const navigate = (name: string) => {
    router.push(name === 'index' ? '/' : `/${name}`);
    props.navigation.closeDrawer();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Ionicons name="shield-checkmark" size={28} color={THEME.primary} />
        </View>
        <Text style={styles.appName}>{APP_NAME}</Text>
        <Text style={styles.tagline}>Gas leak safety monitor</Text>
        <View style={styles.ussdBadge}>
          <Ionicons name="keypad" size={12} color={THEME.primary} />
          <Text style={styles.ussdText}>  USSD {USSD_CODE}</Text>
        </View>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={styles.menu}>
        {MENU.map((item) => {
          const active = activeRoute === item.name
            || (item.name === 'index' && (pathname === '/' || pathname.endsWith('/index')));
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.menuItem, active && styles.menuItemActive]}
              onPress={() => navigate(item.name)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? THEME.primary : THEME.textMuted}
              />
              <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                {item.label}
              </Text>
              {active && <View style={styles.activeBar} />}
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>

      <View style={styles.footer}>
        <View style={styles.safeBadge}>
          <View style={styles.safeDot} />
          <Text style={styles.footerText}>Safety monitoring active</Text>
        </View>
        <Text style={styles.footerSub}>University of Rwanda · 2025–2026</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bgSecondary },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: THEME.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.primaryMuted,
  },
  appName: { fontSize: 22, fontWeight: '700', color: THEME.text },
  tagline: { fontSize: 13, color: THEME.textMuted, marginTop: 4 },
  ussdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: THEME.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  ussdText: { fontSize: 11, color: THEME.textSecondary, fontWeight: '500' },
  menu: { paddingTop: 12, paddingHorizontal: 12 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 4,
    gap: 14,
  },
  menuItemActive: {
    backgroundColor: THEME.drawerActive,
    borderWidth: 1,
    borderColor: THEME.drawerActiveBorder,
  },
  menuLabel: { flex: 1, fontSize: 15, color: THEME.textMuted, fontWeight: '500' },
  menuLabelActive: { color: THEME.text, fontWeight: '600' },
  activeBar: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: THEME.primary,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  safeBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME.primary,
  },
  footerText: { fontSize: 12, color: THEME.textSecondary },
  footerSub: { fontSize: 10, color: THEME.textMuted, marginTop: 6 },
});
