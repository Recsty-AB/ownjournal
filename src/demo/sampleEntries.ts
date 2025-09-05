import { JournalEntryData } from "@/components/journal/JournalEntry";

// Generate dates relative to today for realistic demo
const today = new Date();
const daysAgo = (days: number): Date => {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
};

export const sampleEntries: JournalEntryData[] = [
  {
    id: "demo-1",
    date: daysAgo(0),
    title: "Morning Meditation & New Beginnings",
    body: `Started the day with a peaceful 20-minute meditation session. The house was quiet, and I could hear birds chirping outside.

## Key Insights
- Noticed how much calmer I feel when I start the day mindfully
- Set an intention to be **more present** in conversations today
- Grateful for this moment of stillness before the day begins

> "The present moment is filled with joy and happiness. If you are attentive, you will see it." — Thích Nhất Hạnh

Planning to make this a daily habit. Even just 10 minutes makes a difference.`,
    mood: "great",
    tags: ["mindfulness", "morning routine", "meditation", "gratitude"],
    createdAt: daysAgo(0),
    updatedAt: daysAgo(0)
  },
  {
    id: "demo-2",
    date: daysAgo(1),
    title: "Project Launch Success! 🎉",
    body: `Today we finally launched the new feature we've been working on for months! The team worked incredibly hard, and seeing it go live was such a rewarding moment.

### Highlights
1. Zero critical bugs at launch
2. Positive feedback from early users
3. Team celebration dinner planned for Friday

The best part was watching the real-time analytics as users started exploring the new functionality. All those late nights and iterations paid off.

**Lessons learned:**
- Early user testing saved us from several UX issues
- Clear communication between teams was crucial
- Celebrating small wins along the way kept morale high`,
    mood: "great",
    tags: ["work", "milestone", "celebration", "teamwork"],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1)
  },
  {
    id: "demo-3",
    date: daysAgo(2),
    title: "Rainy Sunday Reflections",
    body: `Spent the afternoon curled up with a good book while rain pattered against the windows. There's something deeply comforting about rainy days that invite introspection.

Finished reading "Atomic Habits" — so many practical takeaways:
- Focus on systems, not goals
- Make good habits obvious and easy
- The 2-minute rule for starting new habits

Made a list of small habits I want to build:
- [ ] Read for 15 minutes before bed
- [ ] Morning stretches
- [ ] Weekly meal planning

Sometimes the best days are the quiet ones.`,
    mood: "good",
    tags: ["reading", "self-improvement", "reflection", "cozy"],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2)
  },
  {
    id: "demo-4",
    date: daysAgo(3),
    title: "Family Dinner & Childhood Memories",
    body: `Had dinner at my parents' house tonight. Mom made her famous lasagna — the recipe she's been perfecting for 30 years.

We looked through old photo albums and laughed at pictures from family vacations. Dad told stories I'd never heard before about his first job and how he met mom.

These moments are precious. Note to self: **call them more often**, not just on special occasions.

Also realized how much I've grown since those childhood photos. Life has a funny way of moving forward while we're busy living it.`,
    mood: "great",
    tags: ["family", "gratitude", "memories", "dinner"],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3)
  },
  {
    id: "demo-5",
    date: daysAgo(5),
    title: "Hiking Adventure: Mountain Trail",
    body: `Finally completed the mountain trail I've been wanting to hike for months! 12 kilometers, 800 meters elevation gain.

## The Journey
The first hour was tough — my legs were protesting every steep section. But once I reached the halfway viewpoint, everything changed. The view was absolutely breathtaking.

### Stats
| Metric | Value |
|--------|-------|
| Distance | 12 km |
| Elevation | 800 m |
| Time | 4.5 hours |
| Steps | 18,432 |

Met a fellow hiker at the summit who shared her trail mix. We talked about favorite hiking spots and exchanged recommendations.

Physical exhaustion + mental clarity = perfect combination.`,
    mood: "great",
    tags: ["hiking", "nature", "fitness", "adventure", "outdoors"],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5)
  },
  {
    id: "demo-6",
    date: daysAgo(6),
    title: "Creative Block & Breakthrough",
    body: `Been struggling with a creative block on the design project for days. Tried forcing ideas, but nothing felt right.

Today I decided to step away completely. Went for a walk, listened to music, and let my mind wander.

Then it happened — the breakthrough idea came while I was making coffee. Isn't that always how it works? The solution appears when you stop searching so hard.

*"Creativity is allowing yourself to make mistakes. Design is knowing which ones to keep."* — Scott Adams

Sketched out the new concept and it feels right. Sometimes the best thing you can do is give yourself permission to pause.`,
    mood: "good",
    tags: ["creativity", "work", "design", "breakthrough"],
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6)
  },
  {
    id: "demo-7",
    date: daysAgo(8),
    title: "Learning Japanese: Week 4",
    body: `Four weeks into learning Japanese! Progress is slow but steady.

### This Week's Achievements
- Learned 50 new kanji characters
- Can now read simple children's books
- Had my first conversation exchange online

The language learning app says I'm 3% fluent, which sounds discouraging, but I choose to see it as 3% more than I knew a month ago!

**Favorite new words:**
- 木漏れ日 (komorebi) — sunlight filtering through leaves
- 積ん読 (tsundoku) — buying books and letting them pile up unread (so relatable!)

Goal for next week: Watch an anime episode without subtitles and see how much I understand.`,
    mood: "good",
    tags: ["learning", "japanese", "languages", "goals", "progress"],
    createdAt: daysAgo(8),
    updatedAt: daysAgo(8)
  },
  {
    id: "demo-8",
    date: daysAgo(10),
    title: "Quarterly Goals Review",
    body: `Sat down to review my quarterly goals. Mixed results, but that's okay — the point is progress, not perfection.

## Goal Status

### ✅ Completed
- Read 3 books (actually read 4!)
- Establish morning routine
- Launch side project

### 🔄 In Progress
- Save emergency fund (75% there)
- Learn basic cooking skills (getting better!)

### ❌ Needs Work
- Exercise 3x per week (averaged 1.5x)
- Daily journaling (sporadic at best)

The fitness goal is the hardest. Need to find activities I actually enjoy rather than forcing gym sessions.

**Next quarter focus:** Quality over quantity. Fewer goals, deeper commitment.`,
    mood: "okay",
    tags: ["goals", "review", "planning", "self-improvement", "reflection"],
    createdAt: daysAgo(10),
    updatedAt: daysAgo(10)
  },
  {
    id: "demo-9",
    date: daysAgo(12),
    title: "Coffee Shop Discovery",
    body: `Found the most charming little coffee shop tucked away on a side street I'd never explored before. 

The barista remembered regulars by name and order. Exposed brick walls, mismatched vintage furniture, and the smell of freshly roasted beans. They even had a resident cat sleeping in a sunny window spot!

Spent three hours there working on personal projects. The ambient noise was perfect for concentration.

New favorite spot unlocked. 📍

*Note: Try their lavender latte next time — saw three people order it and they all looked happy about their choice.*`,
    mood: "great",
    tags: ["coffee", "discovery", "cozy", "productivity", "local"],
    createdAt: daysAgo(12),
    updatedAt: daysAgo(12)
  },
  {
    id: "demo-10",
    date: daysAgo(14),
    title: "Difficult Conversation, Important Growth",
    body: `Had a conversation I'd been avoiding for weeks. It was uncomfortable, but necessary.

The outcome wasn't exactly what I hoped for, but there's relief in finally addressing something that's been weighing on me. Can't control how others respond, only how I show up.

### What I Learned
- Avoiding difficult conversations doesn't make them easier
- Being honest (kindly) is a form of respect
- Some discomfort is the price of growth

Feeling a mix of emotions tonight, but mostly proud of myself for not running from the hard thing.

Tomorrow is a new day.`,
    mood: "okay",
    tags: ["growth", "communication", "courage", "relationships", "reflection"],
    createdAt: daysAgo(14),
    updatedAt: daysAgo(14)
  }
];

export const getDemoEntriesForLocale = (locale: string): JournalEntryData[] => {
  // For now, return English entries. In the future, could add localized sample entries
  return sampleEntries;
};
