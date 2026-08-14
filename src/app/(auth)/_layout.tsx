import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" options={{ headerShown: true, title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ headerShown: true, title: 'Sign up' }} />
    </Stack>
  );
}
