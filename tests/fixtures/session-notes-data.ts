import type { NoteEntry, VideoReference } from "../../src/notes/contracts";
import type { TrainingItem } from "../../src/training/contracts";
export const previewBookingId = "15000000-0000-4000-8000-000000000001";
export const previewIds = {
  coach: "15000000-0000-4000-8000-000000000002",
  athlete: "15000000-0000-4000-8000-000000000003",
};
export const previewVideos: readonly VideoReference[] = [
  {
    label: "Footwork & distance — practice reference",
    url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  },
];
export const previewPlan: NoteEntry = {
  id: previewBookingId,
  authorId: previewIds.coach,
  authorName: "Alex · Coach",
  body: "Footwork & distance\n\nStart with a light warm-up, then work on keeping a comfortable distance after the jab. Finish with three relaxed rounds of shadowboxing.",
  videos: previewVideos,
  revision: 1,
  createdAt: "2026-10-31T09:00:00Z",
  updatedAt: "2026-10-31T09:00:00Z",
};
export const previewEntries: NoteEntry[] = [
  {
    id: "15000000-0000-4000-8000-000000000004",
    authorId: previewIds.coach,
    authorName: "Alex · Coach",
    body: "Good progress with your balance today. Keep your shoulders relaxed and let the feet lead the movement.",
    videos: [
      {
        label: "A drill to try before our next session",
        url: "https://www.instagram.com/reel/ExampleDrill/",
      },
    ],
    revision: 1,
    createdAt: "2026-10-31T11:05:00Z",
    updatedAt: "2026-10-31T11:05:00Z",
  },
  {
    id: "15000000-0000-4000-8000-000000000005",
    authorId: previewIds.athlete,
    authorName: "Sam",
    body: "The shorter steps made a real difference. I want to practise moving back after the cross without leaning.",
    videos: [],
    revision: 1,
    createdAt: "2026-10-31T11:12:00Z",
    updatedAt: "2026-10-31T11:12:00Z",
  },
];
export const previewPrivate: NoteEntry = {
  id: "15000000-0000-4000-8000-000000000006",
  authorId: previewIds.coach,
  authorName: "Alex · Coach",
  body: "Next session: start with the distance drill before adding combinations. Keep the pace comfortable and leave time for questions.",
  videos: [],
  revision: 1,
  createdAt: "2026-10-31T11:18:00Z",
  updatedAt: "2026-10-31T11:18:00Z",
};
export const previewWorkout: TrainingItem = {
  key: "manual:15000000-0000-4000-8000-000000000007",
  source: "personal",
  title: "Morning boxing practice",
  startsAt: "2026-10-31T08:00:00Z",
  endsAt: "2026-10-31T08:45:00Z",
  timezone: "UTC",
  state: "planned",
  attendance: "attended",
  notes:
    "Three rounds of shadowboxing and ten minutes of footwork.\n\nRemember: smaller steps, relaxed shoulders.",
  videos: previewVideos,
  intensity: "Moderate",
  actualMinutes: 40,
  revision: 1,
  seriesId: null,
  planRevision: null,
  href: null,
  location: null,
};
