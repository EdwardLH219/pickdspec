import { mockBranches } from "@/lib/mock";
import { Branch } from "@/lib/types";

export function getBranches(): Branch[] {
  return mockBranches;
}

export function getBranchById(id: string): Branch | undefined {
  return mockBranches.find((b) => b.id === id);
}

export function getBranchName(id: string | null): string {
  if (!id) return "All Branches";
  const branch = getBranchById(id);
  return branch?.name ?? "Unknown Branch";
}
