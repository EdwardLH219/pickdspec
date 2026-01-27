"use client";

import { useBranch } from "@/hooks/use-branch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { DateRangePreset } from "@/lib/types";

const dateRangeOptions: { value: DateRangePreset; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 365 days" },
  { value: "custom", label: "Custom range" },
];

export function DateRangePicker() {
  const { dateRange, setDateRange } = useBranch();

  return (
    <Select
      value={dateRange}
      onValueChange={(value) => setDateRange(value as DateRangePreset)}
    >
      <SelectTrigger className="w-[160px]">
        <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {dateRangeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
