import { ScreenScaffold } from '@/components/screen-scaffold';

// Tab 2 — Diary: the full food log for a given day ("Batch it").
export default function DiaryScreen() {
  return (
    <ScreenScaffold
      title="Diary"
      icon="book-outline"
      message="Your food log, meal by meal, will show here. Nothing logged yet."
    />
  );
}
