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
        if (!saved) {
          configureApiBaseUrl(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001');
          return;
        }
        const parsed = JSON.parse(saved) as { cloudServerUrl?: string };
        configureApiBaseUrl(
          process.env.EXPO_PUBLIC_API_URL
            ?? parsed.cloudServerUrl
            ?? 'http://localhost:3001',
        );
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
