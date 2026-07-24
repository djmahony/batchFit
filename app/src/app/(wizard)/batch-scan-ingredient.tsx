import { router } from 'expo-router';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { useAuth } from '@/context/auth';
import { useBatchDraft } from '@/context/batch-draft';
import { api, ApiError } from '@/lib/api';

// The batch wizard's barcode scan: a match adds the food straight to the
// batch draft and returns to the ingredients list (dismissing both this
// screen and the search screen it was opened from). A miss asks the user to
// search by name instead, rather than opening the full custom-food form —
// that flow logs straight to the diary, which doesn't fit an ingredient add.
export default function BatchScanIngredientScreen() {
  const { token } = useAuth();
  const { addIngredient } = useBatchDraft();

  const onScanned = async (code: string) => {
    if (!token) throw new Error('You need to be logged in to do this.');
    try {
      const res = await api.lookupFoodBarcode(token, code);
      addIngredient(res.food);
      router.dismissTo('/batch-ingredients');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        throw new Error('Not on Open Food Facts yet — try searching by name instead.');
      }
      throw new Error(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  };

  return <BarcodeScanner onScanned={onScanned} />;
}
