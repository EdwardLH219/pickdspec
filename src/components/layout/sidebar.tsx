"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "./date-range-picker";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Lightbulb,
  CheckSquare,
  FileText,
  Settings,
  LogOut,
  Shield,
  Database,
  Sparkles,
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
    title: "Activations",
    href: "/activations",
    icon: Sparkles,
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

// Owner/Manager nav items
const ownerNavItems = [
  {
    title: "Data Sources",
    href: "/data-sources",
    icon: Database,
  },
];

// Admin-only nav items
const adminNavItems = [
  {
    title: "Admin Console",
    href: "/admin",
    icon: Shield,
  },
];

interface SidebarProps {
  onNavigate?: () => void;
  showDatePicker?: boolean;
}

/**
 * Get a human-readable role label
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    PICKD_ADMIN: 'Admin',
    PICKD_SUPPORT: 'Support',
    OWNER: 'Owner',
    MANAGER: 'Manager',
    STAFF: 'Staff',
  };
  return labels[role] || role;
}

/**
 * Get role badge variant
 */
function getRoleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'PICKD_ADMIN' || role === 'PICKD_SUPPORT') {
    return 'default';
  }
  if (role === 'OWNER') {
    return 'secondary';
  }
  return 'outline';
}

export function Sidebar({ onNavigate, showDatePicker = false }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate?.();
  };

  // Combine nav items based on user role
  const allNavItems = (() => {
    let items = [...navItems];
    
    // Add owner/manager items
    if (user?.role === 'OWNER' || user?.role === 'MANAGER' || user?.isPickdStaff) {
      items = [...items, ...ownerNavItems];
    }
    
    // Add admin items
    if (user?.isPickdStaff) {
      items = [...items, ...adminNavItems];
    }
    
    return items;
  })();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            P
          </div>
          <span className="font-semibold text-lg">Pick&apos;t</span>
        </Link>
      </div>

      {/* User Info */}
      {user && (
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium truncate">
              {user.firstName} {user.lastName}
            </p>
            <Badge variant={getRoleBadgeVariant(user.role)} className="text-[10px] px-1.5">
              {getRoleLabel(user.role)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {user.email}
          </p>
          {user.isPickdStaff && (
            <p className="text-xs text-primary font-medium mt-1">
              Pick&apos;t Staff
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {allNavItems.map((item) => {
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
      <div className="border-t p-4 space-y-3">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
        <p className="text-xs text-muted-foreground">
          Review Intelligence v1.0
        </p>
      </div>
    </div>
  );
}
