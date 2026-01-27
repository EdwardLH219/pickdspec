import { Theme } from "@/lib/types";

export const mockThemes: Theme[] = [
  // Global themes (apply to all branches)
  {
    id: "theme-1",
    branchId: null,
    name: "Food Quality",
    category: "product",
    description: "Quality, taste, freshness, and presentation of food",
  },
  {
    id: "theme-2",
    branchId: null,
    name: "Service Speed",
    category: "service",
    description: "Time taken to serve, responsiveness of staff",
  },
  {
    id: "theme-3",
    branchId: null,
    name: "Staff Friendliness",
    category: "service",
    description: "Attitude, helpfulness, and professionalism of staff",
  },
  {
    id: "theme-4",
    branchId: null,
    name: "Value for Money",
    category: "value",
    description: "Perception of pricing relative to quality",
  },
  {
    id: "theme-5",
    branchId: null,
    name: "Cleanliness",
    category: "cleanliness",
    description: "Cleanliness of premises, tables, restrooms",
  },
  {
    id: "theme-6",
    branchId: null,
    name: "Ambiance",
    category: "ambiance",
    description: "Atmosphere, decor, music, lighting",
  },
  {
    id: "theme-7",
    branchId: null,
    name: "Menu Variety",
    category: "product",
    description: "Range of options, dietary accommodations",
  },
  {
    id: "theme-8",
    branchId: null,
    name: "Reservation & Booking",
    category: "service",
    description: "Ease of booking, wait times, table availability",
  },
  // Branch-specific themes
  {
    id: "theme-9",
    branchId: "branch-1",
    name: "Ocean View",
    category: "ambiance",
    description: "Quality of waterfront views and seating",
  },
  {
    id: "theme-10",
    branchId: "branch-1",
    name: "Seafood Freshness",
    category: "product",
    description: "Freshness and quality of seafood dishes",
  },
  {
    id: "theme-11",
    branchId: "branch-2",
    name: "Outdoor Seating",
    category: "ambiance",
    description: "Garden and patio dining experience",
  },
  {
    id: "theme-12",
    branchId: "branch-2",
    name: "Local Ingredients",
    category: "product",
    description: "Use of locally sourced produce and meats",
  },
];
