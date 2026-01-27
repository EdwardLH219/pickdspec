"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { Branch, DateRangePreset } from "@/lib/types";
import { getBranches, getBranchById } from "@/lib/data";

interface BranchContextType {
  branches: Branch[];
  selectedBranchId: string | null; // null = all branches
  selectedBranch: Branch | null;
  setSelectedBranchId: (id: string | null) => void;
  dateRange: DateRangePreset;
  setDateRange: (range: DateRangePreset) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangePreset>("30d");

  const branches = getBranches();
  const selectedBranch = selectedBranchId
    ? getBranchById(selectedBranchId) ?? null
    : null;

  return (
    <BranchContext.Provider
      value={{
        branches,
        selectedBranchId,
        selectedBranch,
        setSelectedBranchId,
        dateRange,
        setDateRange,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error("useBranch must be used within a BranchProvider");
  }
  return context;
}
