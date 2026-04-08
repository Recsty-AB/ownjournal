export interface PredefinedActivity {
  key: string;
  emoji: string;
}

export const PREDEFINED_ACTIVITIES: PredefinedActivity[] = [
  { key: 'exercise', emoji: '🏃' },
  { key: 'social', emoji: '👥' },
  { key: 'work', emoji: '💼' },
  { key: 'travel', emoji: '✈️' },
  { key: 'poor_sleep', emoji: '😴' },
  { key: 'good_sleep', emoji: '🌙' },
  { key: 'meditation', emoji: '🧘' },
  { key: 'nature', emoji: '🌿' },
  { key: 'reading', emoji: '📖' },
  { key: 'creative', emoji: '🎨' },
  { key: 'family', emoji: '👨‍👩‍👧' },
  { key: 'cooking', emoji: '🍳' },
  { key: 'music', emoji: '🎵' },
  { key: 'gaming', emoji: '🎮' },
  { key: 'learning', emoji: '📚' },
];

export function getActivityEmoji(activityKey: string): string {
  const found = PREDEFINED_ACTIVITIES.find(a => a.key === activityKey);
  return found?.emoji || '';
}
