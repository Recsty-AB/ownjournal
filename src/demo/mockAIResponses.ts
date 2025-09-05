// Mock AI responses for demo mode - no actual API calls needed

export interface MockAIAnalysis {
  mood: string;
  themes: string[];
  insights: string;
  suggestions: string[];
}

export interface MockTrendAnalysis {
  moodTrend: { date: string; score: number; label: string }[];
  topThemes: { theme: string; count: number }[];
  insights: string[];
  summary: string;
}

// Mock analysis results for individual entries
export const getMockAnalysis = (entryId: string): MockAIAnalysis => {
  const analyses: Record<string, MockAIAnalysis> = {
    "demo-1": {
      mood: "Peaceful and centered",
      themes: ["mindfulness", "self-care", "intention setting"],
      insights: "This entry reflects a strong commitment to mental wellness. The morning meditation practice shows self-awareness and a proactive approach to emotional regulation.",
      suggestions: [
        "Consider tracking your meditation duration over time",
        "Explore different meditation techniques",
        "Note how meditation affects your day"
      ]
    },
    "demo-2": {
      mood: "Triumphant and grateful",
      themes: ["achievement", "teamwork", "professional growth"],
      insights: "A significant milestone was reached through collaboration. The reflection on lessons learned shows mature professional development and leadership qualities.",
      suggestions: [
        "Document the specific strategies that led to success",
        "Acknowledge team members individually",
        "Set the next ambitious goal"
      ]
    },
    "demo-3": {
      mood: "Contemplative and cozy",
      themes: ["learning", "habit formation", "introspection"],
      insights: "Reading and rainy days are providing valuable reflection time. The actionable habit list shows a desire for positive change through small, consistent steps.",
      suggestions: [
        "Start with just one habit from your list",
        "Create a cozy reading nook",
        "Schedule weekly reflection time"
      ]
    },
    "demo-4": {
      mood: "Nostalgic and loving",
      themes: ["family bonds", "gratitude", "heritage"],
      insights: "Strong family connections provide emotional grounding. The awareness of time passing shows emotional maturity and appreciation for the present moment.",
      suggestions: [
        "Schedule regular family calls",
        "Start a family recipe collection",
        "Record family stories before they're forgotten"
      ]
    },
    "demo-5": {
      mood: "Accomplished and invigorated",
      themes: ["physical challenge", "nature connection", "perseverance"],
      insights: "Pushing through physical discomfort led to both achievement and meaningful connection. The detailed tracking shows goal-oriented mindset.",
      suggestions: [
        "Plan the next hiking adventure",
        "Consider joining a hiking group",
        "Document favorite trails and tips"
      ]
    }
  };

  // Return a default analysis for entries not in the map
  return analyses[entryId] || {
    mood: "Reflective and engaged",
    themes: ["personal growth", "daily life", "self-awareness"],
    insights: "This entry shows thoughtful reflection on daily experiences. Continuing to journal regularly will help identify patterns and support personal growth.",
    suggestions: [
      "Keep exploring these themes",
      "Consider what you'd like to do differently",
      "Celebrate your progress"
    ]
  };
};

// Mock trend analysis for the demo period
export const getMockTrendAnalysis = (): MockTrendAnalysis => {
  const today = new Date();
  const moodTrend = [];
  
  // Generate mood trend data for the past 14 days
  const moodPatterns = [
    { score: 0.7, label: "Calm" },
    { score: 0.9, label: "Excited" },
    { score: 0.6, label: "Thoughtful" },
    { score: 0.85, label: "Happy" },
    { score: 0.5, label: "Neutral" },
    { score: 0.8, label: "Excited" },
    { score: 0.65, label: "Thoughtful" },
    { score: 0.55, label: "Neutral" },
    { score: 0.75, label: "Happy" },
    { score: 0.6, label: "Thoughtful" },
    { score: 0.7, label: "Calm" },
    { score: 0.8, label: "Happy" },
    { score: 0.5, label: "Neutral" },
    { score: 0.75, label: "Calm" }
  ];

  for (let i = 13; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const pattern = moodPatterns[13 - i];
    moodTrend.push({
      date: date.toISOString().split('T')[0],
      score: pattern.score,
      label: pattern.label
    });
  }

  return {
    moodTrend,
    topThemes: [
      { theme: "Self-improvement", count: 8 },
      { theme: "Gratitude", count: 6 },
      { theme: "Creativity", count: 5 },
      { theme: "Relationships", count: 4 },
      { theme: "Nature & Adventure", count: 4 },
      { theme: "Professional Growth", count: 3 }
    ],
    insights: [
      "Your mood has been predominantly positive over the past two weeks, with peaks around achievement-related entries.",
      "You journal most frequently on weekends, suggesting this is when you have the most time for reflection.",
      "Themes of personal growth and learning appear consistently, indicating strong self-development focus.",
      "Entries mentioning nature or outdoor activities correlate with higher mood scores."
    ],
    summary: "Overall, your journal reflects a balanced life with meaningful focus on personal growth, relationships, and creative pursuits. Consider maintaining your meditation practice as it appears to positively influence your mood patterns."
  };
};

// Mock tag suggestions
export const getMockTagSuggestions = (content: string): string[] => {
  const suggestions = [
    "personal-growth",
    "daily-reflection",
    "mindfulness",
    "gratitude",
    "learning"
  ];
  return suggestions.slice(0, 3);
};

// Mock title suggestions
export const getMockTitleSuggestions = (content: string): string[] => {
  return [
    "Reflections on the Day",
    "Moments of Clarity",
    "Today's Journey"
  ];
};
