/**
 * Push Notifications Service
 * Local alerts shown on the phone when the app is open.
 * Remote alerts (calls + SMS) are handled by the backend server.
 *
 * expo-notifications is native-only; on web we use the browser Notification API.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function sendWebNotification(title: string, body: string): Promise<void> {
  if (typeof globalThis === 'undefined' || !('Notification' in globalThis)) return;

  const NotificationCtor = globalThis.Notification as typeof Notification;
  if (NotificationCtor.permission === 'default') {
    await NotificationCtor.requestPermission();
  }
  if (NotificationCtor.permission === 'granted') {
    new NotificationCtor(title, { body });
  }
}

export const requestPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    if (typeof globalThis === 'undefined' || !('Notification' in globalThis)) {
      return false;
    }
    const result = await (globalThis.Notification as typeof Notification).requestPermission();
    return result === 'granted';
  }

  if (!Device.isDevice) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const sendLocalLeakAlert = async (ppm: number) => {
  const title = '⚠ Gas Leak Detected!';
  const body = `Gas level is ${ppm} ppm. Evacuate immediately.`;

  if (!isNative) {
    await sendWebNotification(title, body);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      color: '#E24B4A',
    },
    trigger: null,
  });
};

export const sendLocalSafeAlert = async (ppm: number) => {
  const title = '✓ Gas Level Normal';
  const body = `Gas concentration is ${ppm} ppm — within safe limits.`;

  if (!isNative) {
    await sendWebNotification(title, body);
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
};
