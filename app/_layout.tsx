import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureApiBaseUrl } from '../services/api';
import React from 'react';

export default function RootLayout() {
  useEffect(() => {
    AsyncStorage.getItem('gasSettings')
      .then((saved) => {
        if (!saved) return;
        const parsed = JSON.parse(saved) as { cloudServerUrl?: string };
        configureApiBaseUrl(parsed.cloudServerUrl);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
        <Stack.Screen
          name="alert"
          options={{ headerShown: false, presentation: 'modal' }}
        />
      </Stack>
    </>
  );
}
