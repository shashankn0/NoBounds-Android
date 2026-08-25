import { Stack } from 'expo-router';

// sign in / sign up get a visible header, welcome doesn't
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" options={{ headerShown: true, title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ headerShown: true, title: 'Sign up' }} />
    </Stack>
  );
}
