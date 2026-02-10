"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { User, UserRole, Branch } from "@/lib/types";
import { toast } from "sonner";
import {
  Plus,
  Users,
  Mail,
  Loader2,
  Shield,
  Eye,
  UserCog,
  Trash2,
} from "lucide-react";

interface UsersTabProps {
  initialUsers: User[];
  branches: Branch[];
  currentUserId?: string;
}

interface InviteFormData {
  email: string;
  name: string;
  role: UserRole;
  branchIds: string[];
}

// Map database roles to display config
const roleConfig: Record<string, { label: string; icon: React.ReactNode; description: string; color: string }> = {
  owner: {
    label: "Owner",
    icon: <Shield className="h-4 w-4" />,
    description: "Organization owner with full control",
    color: "bg-amber-100 text-amber-700",
  },
  admin: {
    label: "Admin",
    icon: <Shield className="h-4 w-4" />,
    description: "Full access to all features and settings",
    color: "bg-purple-100 text-purple-700",
  },
  manager: {
    label: "Manager",
    icon: <UserCog className="h-4 w-4" />,
    description: "Can manage assigned branches and view reports",
    color: "bg-blue-100 text-blue-700",
  },
  staff: {
    label: "Staff",
    icon: <Eye className="h-4 w-4" />,
    description: "Read-only access to dashboards and reports",
    color: "bg-gray-100 text-gray-700",
  },
  viewer: {
    label: "Viewer",
    icon: <Eye className="h-4 w-4" />,
    description: "Read-only access to dashboards and reports",
    color: "bg-gray-100 text-gray-700",
  },
};

// Roles available for selection (excludes system roles)
const selectableRoles = ["admin", "manager", "viewer"] as const;

export function UsersTab({ initialUsers, branches, currentUserId }: UsersTabProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [formData, setFormData] = useState<InviteFormData>({
    email: "",
    name: "",
    role: "viewer",
    branchIds: [],
  });

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    const user = users.find((u) => u.id === userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );
    toast.success("Role updated", {
      description: `${user?.name}'s role changed to ${newRole}.`,
    });
  };

  const handleRemoveUser = (userId: string) => {
    if (confirm("Are you sure you want to remove this user?")) {
      const user = users.find((u) => u.id === userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User removed", {
        description: `${user?.name} has been removed from your organization.`,
      });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newUser: User = {
      id: `user-${Date.now()}`,
      organizationId: "org-1",
      name: formData.name,
      email: formData.email,
      role: formData.role,
      branchIds: formData.branchIds,
      isActive: true,
    };

    setUsers((prev) => [...prev, newUser]);
    setIsSending(false);
    setIsInviteModalOpen(false);
    setFormData({ email: "", name: "", role: "viewer", branchIds: [] });
    
    toast.success("Invitation sent", {
      description: `An invitation has been sent to ${formData.email}.`,
    });
  };

  const toggleBranch = (branchId: string) => {
    setFormData((prev) => ({
      ...prev,
      branchIds: prev.branchIds.includes(branchId)
        ? prev.branchIds.filter((id) => id !== branchId)
        : [...prev.branchIds, branchId],
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                Manage who has access to your Pick&apos;d dashboard
              </CardDescription>
            </div>
            <Button onClick={() => setIsInviteModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Branch Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const userRole = user.role?.toLowerCase() || 'viewer';
                  const role = roleConfig[userRole] || roleConfig.viewer;
                  const isCurrentUser = currentUserId ? user.id === currentUserId : false;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {user.name}
                              {isCurrentUser && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  You
                                </Badge>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {/* Show role badge for owner/special roles, select for others */}
                        {userRole === 'owner' ? (
                          <Badge className={role.color}>
                            <div className="flex items-center gap-1">
                              {role.icon}
                              {role.label}
                            </div>
                          </Badge>
                        ) : (
                          <Select
                            value={userRole}
                            onValueChange={(value) =>
                              handleRoleChange(user.id, value as UserRole)
                            }
                            disabled={isCurrentUser}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue>
                                <div className="flex items-center gap-2">
                                  {role.icon}
                                  {role.label}
                                </div>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {selectableRoles.map((key) => {
                                const config = roleConfig[key];
                                return (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-2">
                                      {config.icon}
                                      {config.label}
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.branchIds.length === 0 ? (
                          <Badge variant="secondary">All Branches</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {user.branchIds.slice(0, 2).map((branchId) => {
                              const branch = branches.find(
                                (b) => b.id === branchId
                              );
                              return (
                                <Badge key={branchId} variant="outline">
                                  {branch?.name || branchId}
                                </Badge>
                              );
                            })}
                            {user.branchIds.length > 2 && (
                              <Badge variant="outline">
                                +{user.branchIds.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }
                        >
                          {user.isActive ? "Active" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveUser(user.id)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {(['owner', ...selectableRoles] as const).map((key) => {
              const config = roleConfig[key];
              return (
                <div key={key} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className={`rounded-lg p-2 ${config.color}`}>
                    {config.icon}
                  </div>
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Invite User Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Invite Team Member
              </DialogTitle>
              <DialogDescription>
                Send an invitation to join your organization on Pick&apos;d.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inviteName">Full Name</Label>
                <Input
                  id="inviteName"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="John Smith"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteEmail">Email Address</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="john@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteRole">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, role: value as UserRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableRoles.map((key) => {
                      const config = roleConfig[key];
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {config.icon}
                            <span>{config.label}</span>
                            <span className="text-xs text-muted-foreground">
                              - {config.description}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Branch Access</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Leave unchecked for access to all branches
                </p>
                <div className="space-y-2 max-h-[150px] overflow-y-auto border rounded-md p-3">
                  {branches.map((branch) => (
                    <div key={branch.id} className="flex items-center gap-2">
                      <Checkbox
                        id={branch.id}
                        checked={formData.branchIds.includes(branch.id)}
                        onCheckedChange={() => toggleBranch(branch.id)}
                      />
                      <label
                        htmlFor={branch.id}
                        className="text-sm cursor-pointer"
                      >
                        {branch.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSending || !formData.email || !formData.name}
              >
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
