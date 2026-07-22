import { router, useLocalSearchParams } from 'expo-router';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { useAuth } from '@/context/auth';
import { api, ApiError, type Meal } from '@/lib/api';
import { todayKey } from '@/lib/dates';

// Add food's barcode scan: a match opens the food quantity screen; a miss
// opens "Create custom food" pre-filled with the barcode, so a manual entry
// is still recognised on the next scan. See foods.ts's GET /foods/barcode/:code.
export default function BarcodeScanScreen() {
  const { token } = useAuth();
  const params = useLocalSearchParams<{ meal?: Meal; date?: string }>();
  const meal: Meal = params.meal ?? 'snacks';
  const date = params.date ?? todayKey();

  const onScanned = async (code: string) => {
    if (!token) return;
    try {
      const res = await api.lookupFoodBarcode(token, code);
      // Replace (not push) — going back from the quantity screen should
      // return to search, not to the camera.
      router.replace({ pathname: '/food/[id]', params: { id: res.food.id, meal, date } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        router.replace({ pathname: '/create-food', params: { meal, date, barcode: code } });
        return;
      }
      throw new Error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  };

  return <BarcodeScanner onScanned={onScanned} />;
}
