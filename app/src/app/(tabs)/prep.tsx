import { ScreenScaffold } from '@/components/screen-scaffold';

// Tab 3 — Prep ⭐: the batch-cooking differentiator (recipes, batches, inventory).
export default function PrepScreen() {
  return (
    <ScreenScaffold
      title="Prep"
      icon="restaurant-outline"
      message="Cook once, eat all week. Prep your first batch and we'll work out the macros per portion."
    />
  );
}
