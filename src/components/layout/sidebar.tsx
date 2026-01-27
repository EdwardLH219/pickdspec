"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./date-range-picker";
import { DocLinks } from "./doc-modal";
import {
  LayoutDashboard,
  Lightbulb,
  CheckSquare,
  FileText,
  Settings,
} from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Recommendations",
    href: "/recommendations",
    icon: Lightbulb,
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    title: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    title: "Account",
    href: "/account",
    icon: Settings,
  },
];

interface SidebarProps {
  onNavigate?: () => void;
  showDatePicker?: boolean;
}

export function Sidebar({ onNavigate, showDatePicker = false }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            P
          </div>
          <span className="font-semibold text-lg">Pick&apos;d</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: Date Range Picker */}
      {showDatePicker && (
        <div className="border-t p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Date Range</p>
          <DateRangePicker />
        </div>
      )}

      {/* Footer */}
      <div className="border-t p-4 space-y-2">
        <DocLinks />
        <p className="text-xs text-muted-foreground">
          Review Intelligence v0.1
        </p>
      </div>
    </div>
  );
}
