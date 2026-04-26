import 'react-native-reanimated';
import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/lib/auth-context';

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

/** Watches auth state and redirects between auth and tabs screens */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isLoggedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isLoggedIn && !inAuthGroup) {
      // Not logged in and not on the auth screen — redirect to login
      router.replace('/auth/login');
    } else if (isLoggedIn && inAuthGroup) {
      // Logged in but still on auth screen — redirect to tabs
      router.replace('/(tabs)/jobs');
    }
  }, [isLoading, isLoggedIn, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <AuthGuard>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="auth" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGuard>
    </AuthProvider>
  );
}
