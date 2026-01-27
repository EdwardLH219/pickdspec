import { ReviewSource, ReviewSourceType } from "@/lib/types";

export const reviewSources: ReviewSource[] = [
  {
    id: "google",
    name: "Google",
    icon: "🔍",
    color: "#4285F4",
  },
  {
    id: "hellopeter",
    name: "HelloPeter",
    icon: "👋",
    color: "#00A86B",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "📘",
    color: "#1877F2",
  },
  {
    id: "tripadvisor",
    name: "TripAdvisor",
    icon: "🦉",
    color: "#00AF87",
  },
];

export const getSourceById = (id: ReviewSourceType): ReviewSource => {
  return reviewSources.find((s) => s.id === id) ?? reviewSources[0];
};
