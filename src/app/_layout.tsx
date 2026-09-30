import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SiteOnlineProvider } from '@/hooks/usePresence';
import { colors, fonts } from '@/lib/theme';

export default function RootLayout() {
  return (
    <SiteOnlineProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts?.brand, fontSize: 21 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: '담벼락' }} />
        <Stack.Screen name="board/[tag]" options={{ title: '' }} />
        <Stack.Screen name="room/[code]" options={{ title: '' }} />
        <Stack.Screen name="wifi" options={{ title: '📶 이 와이파이' }} />
        <Stack.Screen name="about" options={{ title: '운영정책 · 개인정보' }} />
      </Stack>
    </SiteOnlineProvider>
  );
}
