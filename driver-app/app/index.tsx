import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/colors';

export default function Index() {
  const { isLoading, isLoggedIn } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.navy[800] }}>
        <ActivityIndicator size="large" color={colors.safety[500]} />
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href="/(tabs)/jobs" />;
  }

  return <Redirect href="/auth/login" />;
}
