import { User } from "@/lib/types";

export const mockUsers: User[] = [
  {
    id: "user-1",
    organizationId: "org-1",
    name: "John Doe",
    email: "john.doe@coastaleats.com",
    role: "admin",
    branchIds: [],
    isActive: true,
  },
  {
    id: "user-2",
    organizationId: "org-1",
    name: "Sarah Johnson",
    email: "sarah.johnson@coastaleats.com",
    role: "manager",
    branchIds: [],
    isActive: true,
  },
  {
    id: "user-3",
    organizationId: "org-1",
    name: "Mike Chen",
    email: "mike.chen@coastaleats.com",
    role: "manager",
    branchIds: ["branch-1"],
    isActive: true,
  },
  {
    id: "user-4",
    organizationId: "org-1",
    name: "Lisa Martinez",
    email: "lisa.martinez@coastaleats.com",
    role: "manager",
    branchIds: ["branch-2"],
    isActive: true,
  },
  {
    id: "user-5",
    organizationId: "org-1",
    name: "David Wilson",
    email: "david.wilson@coastaleats.com",
    role: "viewer",
    branchIds: ["branch-1"],
    isActive: true,
  },
  {
    id: "user-6",
    organizationId: "org-1",
    name: "Emma Thompson",
    email: "emma.thompson@coastaleats.com",
    role: "viewer",
    branchIds: [],
    isActive: true,
  },
];

export const currentUser = mockUsers[0]; // John Doe - admin
