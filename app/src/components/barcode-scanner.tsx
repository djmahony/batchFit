import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

type Props = {
  /** Called with the scanned code. Resolve after navigating away on a match;
   *  throw an Error with a user-facing message to show it and allow retrying
   *  (the scanner stays mounted and re-arms itself). */
  onScanned: (code: string) => Promise<void>;
};

/**
 * The camera + viewfinder + permission handling shared by every barcode scan
 * entry point (Diary's Add food, the batch wizard's Add ingredient). Callers
 * own what a scan *means* (food lookup vs. batch ingredient) — this owns the
 * camera itself, the Open Food Facts attribution its license requires, and
 * showing/retrying whatever error the caller's lookup throws.
 */
export function BarcodeScanner({ onScanned }: Props) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (result: BarcodeScanningResult) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onScanned(result.data);
      // Success navigates away — this component is about to unmount.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.surface, borderColor: theme.surfaceBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="close" size={17} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Scan barcode</ThemedText>
          <View style={styles.headerButton} />
        </View>

        {!permission ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.tint} />
          </View>
        ) : !permission.granted ? (
          <View style={styles.centered}>
            <View style={[styles.iconCircle, { backgroundColor: theme.tintSoft }]}>
              <Ionicons name="camera-outline" size={32} color={theme.tint} />
            </View>
            <ThemedText style={styles.title}>Camera access needed</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
              We need your camera to scan a barcode.
            </ThemedText>
            {permission.canAskAgain ? (
              <Button label="Allow camera access" onPress={() => void requestPermission()} />
            ) : (
              <Button label="Open Settings" onPress={() => void Linking.openSettings()} />
            )}
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={busy ? undefined : (result) => void handle(result)}
            />

            <View pointerEvents="none" style={styles.frameWrap}>
              <View style={[styles.frame, { borderColor: theme.tint }]} />
              <ThemedText style={[styles.hint, { color: '#FFFFFF' }]}>
                Line up the barcode in the frame
              </ThemedText>
            </View>

            {busy && !error && (
              <View style={styles.lookupOverlay}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            )}

            {error && (
              <View style={[styles.errorCard, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
                  {error}
                </ThemedText>
                <Button label="Try again" onPress={() => setError(null)} />
              </View>
            )}

            <ThemedText style={styles.attribution}>Product data from Open Food Facts</ThemedText>
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
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
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 19,
    lineHeight: 24,
  },
  centeredText: {
    textAlign: 'center',
  },
  cameraWrap: {
    flex: 1,
    marginHorizontal: 22,
    marginBottom: Spacing.three,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  frameWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  frame: {
    width: '78%',
    height: 140,
    borderRadius: 16,
    borderWidth: 2.5,
  },
  hint: {
    fontFamily: Fonts.bodySemibold,
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  lookupOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.five,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  attribution: {
    position: 'absolute',
    bottom: Spacing.two,
    alignSelf: 'center',
    fontFamily: Fonts.body,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.75)',
  },
  pressed: {
    opacity: 0.6,
  },
});
