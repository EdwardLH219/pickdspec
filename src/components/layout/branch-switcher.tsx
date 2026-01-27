"use client";

import { useBranch } from "@/hooks/use-branch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

export function BranchSwitcher() {
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();

  return (
    <Select
      value={selectedBranchId ?? "all"}
      onValueChange={(value) =>
        setSelectedBranchId(value === "all" ? null : value)
      }
    >
      <SelectTrigger className="w-[200px]">
        <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Branches</SelectItem>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
