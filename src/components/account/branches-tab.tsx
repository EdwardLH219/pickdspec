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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Branch } from "@/lib/types";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Building,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface BranchesTabProps {
  initialBranches: Branch[];
}

interface BranchFormData {
  id: string;
  name: string;
  address: string;
  city: string;
  googlePlaceId: string;
  helloPeterId: string;
  facebookPageId: string;
  tripAdvisorId: string;
}

const emptyFormData: BranchFormData = {
  id: "",
  name: "",
  address: "",
  city: "",
  googlePlaceId: "",
  helloPeterId: "",
  facebookPageId: "",
  tripAdvisorId: "",
};

export function BranchesTab({ initialBranches }: BranchesTabProps) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<BranchFormData>(emptyFormData);

  const handleAdd = () => {
    setFormData(emptyFormData);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = (branch: Branch) => {
    setFormData({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      googlePlaceId: "ChIJ" + branch.id.slice(-8),
      helloPeterId: "hp-" + branch.id,
      facebookPageId: "fb-" + branch.id,
      tripAdvisorId: "ta-" + branch.id,
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = (branchId: string) => {
    if (confirm("Are you sure you want to delete this branch?")) {
      setBranches((prev) => prev.filter((b) => b.id !== branchId));
      toast.success("Branch deleted", {
        description: "The branch has been removed from your organization.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 800));

    if (isEditing) {
      setBranches((prev) =>
        prev.map((b) =>
          b.id === formData.id
            ? {
                ...b,
                name: formData.name,
                address: formData.address,
                city: formData.city,
              }
            : b
        )
      );
    } else {
      const newBranch: Branch = {
        id: `branch-${Date.now()}`,
        organizationId: "org-1",
        name: formData.name,
        address: formData.address,
        city: formData.city,
        isActive: true,
      };
      setBranches((prev) => [...prev, newBranch]);
    }

    setIsSaving(false);
    setIsModalOpen(false);
    setFormData(emptyFormData);
    
    toast.success(isEditing ? "Branch updated" : "Branch created", {
      description: isEditing 
        ? "Branch details have been saved." 
        : `"${formData.name}" has been added to your organization.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Branch Locations
              </CardTitle>
              <CardDescription>
                Manage your business locations and their review source connections
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.length > 0 ? (
                  branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">
                        {branch.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {branch.address}
                        </div>
                      </TableCell>
                      <TableCell>{branch.city}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            branch.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-700"
                          }
                        >
                          {branch.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(branch)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(branch.id)}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No branches configured. Add your first branch to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Branch Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit Branch" : "Add New Branch"}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Update the branch details and review source connections."
                  : "Add a new branch location and configure its review sources."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Branch Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g., Downtown Location"
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="e.g., 123 Main Street"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, city: e.target.value }))
                    }
                    placeholder="e.g., Cape Town"
                  />
                </div>
              </div>

              <Separator className="my-2" />

              {/* Review Source IDs */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Review Source Connections
                </Label>
                <p className="text-xs text-muted-foreground">
                  Connect review platforms to automatically sync reviews for this branch.
                </p>

                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center">🔍</span>
                    <Input
                      placeholder="Google Place ID"
                      value={formData.googlePlaceId}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          googlePlaceId: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <Button type="button" variant="ghost" size="icon" asChild>
                      <a
                        href="https://developers.google.com/maps/documentation/places/web-service/place-id"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center">👋</span>
                    <Input
                      placeholder="HelloPeter Business ID"
                      value={formData.helloPeterId}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          helloPeterId: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <div className="w-9" />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center">📘</span>
                    <Input
                      placeholder="Facebook Page ID"
                      value={formData.facebookPageId}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          facebookPageId: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <div className="w-9" />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center">🦉</span>
                    <Input
                      placeholder="TripAdvisor Location ID"
                      value={formData.tripAdvisorId}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          tripAdvisorId: e.target.value,
                        }))
                      }
                      className="flex-1"
                    />
                    <div className="w-9" />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !formData.name.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : isEditing ? (
                  "Update Branch"
                ) : (
                  "Create Branch"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
