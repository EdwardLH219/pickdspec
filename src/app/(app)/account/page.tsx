"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab, BranchesTab, UsersTab, SubscriptionTab } from "@/components/account";
import {
  Building2,
  MapPin,
  Users,
  CreditCard,
  Loader2,
} from "lucide-react";

interface AccountData {
  organization: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier: string;
    subscriptionStatus: string;
    settings: unknown;
  } | null;
  tenants: Array<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
  }>;
  teamMembers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }>;
  currentUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export default function AccountPage() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccount() {
      try {
        const res = await fetch('/api/portal/account');
        if (res.ok) {
          const accountData = await res.json();
          setData(accountData);
        }
      } catch (err) {
        console.error('Failed to fetch account data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAccount();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Format data for components
  const organization = data?.organization ? {
    id: data.organization.id,
    name: data.organization.name,
    industry: 'Restaurant', // Default
    createdAt: new Date().toISOString(),
  } : {
    id: '',
    name: 'Unknown Organization',
    industry: 'Restaurant',
    createdAt: new Date().toISOString(),
  };

  const branches = data?.tenants.map(t => ({
    id: t.id,
    name: t.name,
    address: '',
    city: '',
    isActive: t.isActive,
  })) || [];

  // Map database roles to UI roles
  const mapRole = (dbRole: string): string => {
    const roleMap: Record<string, string> = {
      'OWNER': 'owner',
      'MANAGER': 'manager',
      'STAFF': 'staff',
      'PICKD_ADMIN': 'admin',
      'PICKD_SUPPORT': 'admin',
    };
    return roleMap[dbRole] || 'viewer';
  };

  const users = data?.teamMembers.map(u => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    role: mapRole(u.role),
    branchIds: [],
    status: u.isActive ? 'active' : 'inactive',
    lastActive: u.createdAt,
    avatar: undefined,
    isActive: u.isActive,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization, team, and subscription settings.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Organization</span>
            <span className="sm:hidden">Org</span>
          </TabsTrigger>
          <TabsTrigger value="branches" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Branches</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="subscription" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Subscription</span>
            <span className="sm:hidden">Plan</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab organization={organization} />
        </TabsContent>

        <TabsContent value="branches">
          <BranchesTab initialBranches={branches} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab initialUsers={users} branches={branches} currentUserId={data?.currentUser?.id} />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
