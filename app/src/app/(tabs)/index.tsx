import { ScreenScaffold } from '@/components/screen-scaffold';

// Tab 1 — Today: the daily command centre (targets vs. intake, quick actions).
export default function TodayScreen() {
  return (
    <ScreenScaffold
      title="Today"
      icon="today-outline"
      message="Your daily budget and quick actions will live here. Log your first meal to get going."
    />
  );
}
