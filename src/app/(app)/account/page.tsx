"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileTab, BranchesTab, UsersTab, SubscriptionTab } from "@/components/account";
import { mockOrganization, mockBranches, mockUsers } from "@/lib/mock";
import {
  Building2,
  MapPin,
  Users,
  CreditCard,
} from "lucide-react";

export default function AccountPage() {
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
          <ProfileTab organization={mockOrganization} />
        </TabsContent>

        <TabsContent value="branches">
          <BranchesTab initialBranches={mockBranches} />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab initialUsers={mockUsers} branches={mockBranches} />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
