"use client";

import { BranchSwitcher } from "./branch-switcher";
import { DateRangePicker } from "./date-range-picker";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { Separator } from "@/components/ui/separator";
import { ScoringIndicator } from "./scoring-indicator";

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Mobile menu button */}
      <MobileNav />

      {/* Filters */}
      <div className="flex flex-1 items-center gap-2">
        <div className="hidden sm:flex sm:items-center sm:gap-2">
          <BranchSwitcher />
          <Separator orientation="vertical" className="h-6" />
          <DateRangePicker />
        </div>
        {/* Mobile: show only branch switcher */}
        <div className="flex items-center gap-2 sm:hidden">
          <BranchSwitcher />
        </div>
      </div>

      {/* Scoring status indicator (shows when minimized) */}
      <ScoringIndicator />

      {/* User menu */}
      <UserMenu />
    </header>
  );
}
