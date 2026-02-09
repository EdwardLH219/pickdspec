"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { DateRangePreset } from "@/lib/types";

// Tenant type for real data
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  organizationName?: string;
}

interface BranchContextType {
  // Real tenant data
  tenants: Tenant[];
  selectedTenantId: string | null;
  selectedTenant: Tenant | null;
  setSelectedTenantId: (id: string | null) => void;
  isLoading: boolean;
  
  // Legacy support (maps to tenant)
  branches: Tenant[];
  selectedBranchId: string | null;
  selectedBranch: Tenant | null;
  setSelectedBranchId: (id: string | null) => void;
  
  // Date range
  dateRange: DateRangePreset;
  setDateRange: (range: DateRangePreset) => void;
  
  // Date range helpers
  getDateRange: () => { start: Date; end: Date };
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangePreset>("30d");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch tenants the user has access to
  useEffect(() => {
    async function fetchTenants() {
      if (!session?.user) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/portal/tenants');
        if (res.ok) {
          const data = await res.json();
          setTenants(data.tenants || []);
          
          // Auto-select first tenant if none selected
          if (data.tenants?.length > 0 && !selectedTenantId) {
            setSelectedTenantId(data.tenants[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTenants();
  }, [session?.user]);

  const selectedTenant = tenants.find(t => t.id === selectedTenantId) ?? null;

  // Date range calculation
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      case "365d":
        start.setFullYear(end.getFullYear() - 1);
        break;
      case "custom":
        // Default to 30 days for custom when no specific range set
        start.setDate(end.getDate() - 30);
        break;
      default:
        start.setDate(end.getDate() - 30);
    }
    
    return { start, end };
  };

  return (
    <BranchContext.Provider
      value={{
        // Real tenant data
        tenants,
        selectedTenantId,
        selectedTenant,
        setSelectedTenantId,
        isLoading,
        
        // Legacy support (maps to tenant for existing components)
        branches: tenants,
        selectedBranchId: selectedTenantId,
        selectedBranch: selectedTenant,
        setSelectedBranchId: setSelectedTenantId,
        
        // Date range
        dateRange,
        setDateRange,
        getDateRange,
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
