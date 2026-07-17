import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { api, type Units } from '@/lib/api';

// Settings home (wireframe 1aa): rows into Goals & targets / Profile, an inline
// units preference, the Phase-3 sync hook, About, and Sign out (moved here from
// its temporary spot on the Progress tab).
export default function SettingsScreen() {
  const theme = useTheme();
  const { token, user, updateUser, signOut } = useAuth();
  const [unitsError, setUnitsError] = useState(false);

  const setUnits = async (units: Units) => {
    if (!token || !user || units === user.units) return;
    setUnitsError(false);
    // Optimistic — the segmented flips immediately; revert on failure.
    updateUser({ ...user, units });
    try {
      const res = await api.patchProfile(token, { units });
      updateUser(res.user);
    } catch {
      updateUser(user);
      setUnitsError(true);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Settings</ThemedText>
          <View style={styles.headerButton} />
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <SettingsRow
            label="Goals & targets"
            onPress={() => router.push('/settings/targets')}
          />
          <SettingsRow label="Profile" onPress={() => router.push('/settings/profile')} />
          <SettingsRow
            label="Recalculate targets"
            onPress={() => router.push('/settings/tdee')}
          />

          <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <ThemedText style={styles.rowLabel}>Units</ThemedText>
            <View style={styles.unitsToggle}>
              <Segmented
                options={[
                  { label: 'Metric', value: 'metric' },
                  { label: 'Imperial', value: 'imperial' },
                ]}
                value={(user?.units as Units) ?? 'metric'}
                onChange={(value) => void setUnits(value)}
              />
            </View>
          </View>
          {unitsError && (
            <ThemedText type="small" themeColor="danger" style={styles.errorText}>
              Couldn’t save that just now — try again.
            </ThemedText>
          )}

          {/* Phase-3 hook: reserved, not functional (see roadmap "out of scope"). */}
          <View style={[styles.row, styles.dashedRow, { borderColor: theme.border }]}>
            <ThemedText style={[styles.rowLabel, { color: theme.textSecondary }]}>
              Account & cloud sync
            </ThemedText>
            <ThemedText style={[styles.phaseTag, { color: theme.textMuted }]}>Phase 3</ThemedText>
          </View>

          <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <ThemedText style={styles.rowLabel}>About</ThemedText>
            <ThemedText style={[styles.aboutText, { color: theme.textMuted }]}>
              BatchFit · Plan it. Batch it. Burn it.
            </ThemedText>
          </View>

          <View style={styles.accountSection}>
            <ThemedText style={[styles.accountEmail, { color: theme.textMuted }]}>
              {user?.email}
            </ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void signOut()}
              style={({ pressed }) => [
                styles.signOutRow,
                { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.signOutLabel, { color: theme.danger }]}>Sign out</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SettingsRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={15} color={theme.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
  },
  body: {
    paddingHorizontal: 22,
    paddingBottom: Spacing.three,
    gap: 9,
  },
  row: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dashedRow: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  rowLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  unitsToggle: {
    width: 168,
  },
  phaseTag: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 12,
    lineHeight: 16,
  },
  aboutText: {
    fontFamily: Fonts.body,
    fontSize: 11.5,
    lineHeight: 15,
    flexShrink: 1,
    textAlign: 'right',
  },
  errorText: {
    textAlign: 'center',
  },
  accountSection: {
    marginTop: Spacing.three,
    gap: 8,
  },
  accountEmail: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  signOutRow: {
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  signOutLabel: {
    fontFamily: Fonts.bodyBold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.6,
  },
});
