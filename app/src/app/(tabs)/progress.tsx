import { ScreenScaffold } from '@/components/screen-scaffold';

// Tab 5 — Progress: bodyweight trend, stats, and the gateway to Settings.
export default function ProgressScreen() {
  return (
    <ScreenScaffold
      title="Progress"
      icon="trending-up-outline"
      message="Log your weight to see your trend take shape over time."
    />
  );
}
