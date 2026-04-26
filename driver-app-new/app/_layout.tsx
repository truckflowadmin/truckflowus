import 'react-native-reanimated';
import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '@/lib/auth-context';

// Prevent unhandled promise rejections from crashing the app
LogBox.ignoreLogs(['Possible Unhandled Promise Rejection']);

// Global catch for unhandled errors
if (typeof ErrorUtils !== 'undefined') {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    console.warn('[Global Error]', error?.message || error);
    if (!isFatal && defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthProvider>
  );
}
