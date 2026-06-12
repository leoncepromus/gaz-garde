// components/Header.tsx

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS } from '../constants';

type HeaderProps = {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  showHistory?: boolean;
  showSettings?: boolean;
};

export default function Header({
  title,
  showLogo = false,
  showBack = false,
  showHistory = false,
  showSettings = false,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      {/* Left */}
      <View style={styles.left}>
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        )}

        {showLogo ? (
          <View style={styles.logoContainer}>
            <Ionicons
              name="shield-checkmark"
              size={24}
              color={COLORS.primary}
            />
            <Text style={styles.logoText}>GasSafe Monitor</Text>
          </View>
        ) : (
          <Text style={styles.title}>{title}</Text>
        )}
      </View>

      {/* Right */}
      <View style={styles.right}>
        {showHistory && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/history')}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color="#374151"
            />
          </TouchableOpacity>
        )}

        {showSettings && (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/settings')}
          >
            <Ionicons
              name="settings-outline"
              size={22}
              color="#374151"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 88,
    paddingTop: 40,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconButton: {
    padding: 8,
    borderRadius: 10,
  },

  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  logoText: {
    marginLeft: 8,
    fontSize: 19,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: 0.2,
  },

  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
});