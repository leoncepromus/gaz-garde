import { Drawer } from 'expo-router/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawerContent from '../../components/DrawerContent';
import { THEME } from '../../constants';
import React from 'react';

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <DrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerType: 'front',
          drawerStyle: {
            backgroundColor: THEME.bgSecondary,
            width: 280,
          },
          overlayColor: 'rgba(0,0,0,0.65)',
          sceneContainerStyle: { backgroundColor: THEME.bg },
        }}
      >
        <Drawer.Screen name="index" options={{ title: 'Dashboard' }} />
        <Drawer.Screen name="history" options={{ title: 'History' }} />
        <Drawer.Screen name="incidents" options={{ title: 'Incidents' }} />
        <Drawer.Screen name="relays" options={{ title: 'Relay Control' }} />
        <Drawer.Screen name="emergency" options={{ title: 'USSD & Emergency' }} />
        <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}
