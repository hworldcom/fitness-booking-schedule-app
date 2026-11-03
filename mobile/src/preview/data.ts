// Entirely fictional presentation fixtures. These are not application identities.
export const coaches = [
  {
    id: "nia",
    name: "Nia Winter",
    initials: "NW",
    discipline: "Boxing",
    area: "Mitte",
    focus: "Build confidence, one round at a time.",
    bio: "A calm, focused approach to boxing. Work on your stance, footwork and technique at a pace that feels right for you.",
    duration: "75 min",
    color: "purple",
  },
  {
    id: "leo",
    name: "Leo Anders",
    initials: "LA",
    discipline: "Fitness",
    area: "Prenzlauer Berg",
    focus: "Strength that fits your everyday life.",
    bio: "Thoughtful strength training with simple, purposeful movement. Make room for progress without losing your balance.",
    duration: "60 min",
    color: "mint",
  },
  {
    id: "maya",
    name: "Maya Novak",
    initials: "MN",
    discipline: "BJJ",
    area: "Friedrichshain",
    focus: "Find your flow on the mat.",
    bio: "Explore movement, control and the small details that bring your jiu-jitsu together. All experience levels are welcome.",
    duration: "90 min",
    color: "purple",
  },
] as const;

export const sessions = [
  {
    id: "boxing",
    title: "Boxing fundamentals",
    coachId: "nia",
    date: "Thu, 5 Nov",
    time: "18:00–19:15",
    venue: "Sample studio · Mitte",
    status: "Confirmed",
    upcoming: true,
    plan: "A relaxed warm-up, footwork practice and three rounds working on the jab. Finish with a short cooldown.",
    noteId: "session-boxing",
  },
  {
    id: "past-boxing",
    title: "Footwork & balance",
    coachId: "nia",
    date: "Thu, 29 Oct",
    time: "18:00–19:15",
    venue: "Sample studio · Mitte",
    status: "Completed",
    upcoming: false,
    plan: "Focus on moving lightly and keeping a comfortable stance.",
    noteId: "session-past",
  },
] as const;

export const personalWorkouts = [
  {
    id: "personal-strength",
    title: "My strength session",
    date: "Wed, 4 Nov",
    subtitle: "Personal workout · 45 min",
    initial:
      "Keep it simple: squats, rows and a gentle cooldown. Notice how the last set feels.",
  },
  {
    id: "personal-run",
    title: "An easy evening run",
    date: "Sun, 1 Nov",
    subtitle: "Personal workout · 30 min",
    initial:
      "A comfortable pace and a little fresh air. Felt good to get outside.",
  },
] as const;

export const notes = [
  {
    id: "session-boxing",
    title: "Boxing fundamentals",
    date: "Thu, 5 Nov",
    kind: "shared",
    subtitle: "Visible to you and Nia",
    initial: "I'd like to spend a little more time on footwork this week.",
    readonly: false,
  },
  {
    id: "session-past",
    title: "Footwork & balance",
    date: "Thu, 29 Oct",
    kind: "shared",
    subtitle: "Visible to you and Nia",
    initial:
      "Slowing down helped me find my balance. Keep practising the first step.",
    readonly: false,
  },
  ...personalWorkouts.map((item) => ({
    ...item,
    kind: "personal" as const,
    subtitle: "Private · only you",
    readonly: false,
  })),
] as const;

export const initialMessages = [
  {
    id: "sample-1",
    sender: "coach",
    body: "Hi Alex! Looking forward to our session on Thursday. Is there anything you'd like to focus on?",
    time: "11:20",
  },
  {
    id: "sample-2",
    sender: "you",
    body: "Footwork would be great. I'd love to feel a bit more confident moving around.",
    time: "11:22",
  },
  {
    id: "sample-3",
    sender: "coach",
    body: "Absolutely. We'll take it step by step — see you there!",
    time: "11:24",
  },
] as const;
