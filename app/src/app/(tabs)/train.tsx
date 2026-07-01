import { ScreenScaffold } from '@/components/screen-scaffold';

// Tab 4 — Train: workout logging and history ("Burn it").
export default function TrainScreen() {
  return (
    <ScreenScaffold
      title="Train"
      icon="barbell-outline"
      message="Log your workouts here — sets, reps and weight. Start your first workout."
    />
  );
}
