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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DollarSign,
  Users,
  HelpCircle,
  QrCode,
} from "lucide-react";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BranchesTabProps {
  initialBranches: Branch[];
}

interface BaselineMetrics {
  coversPerMonth: number | null;
  averageSpendPerCover: number | null;
  seatCapacity: number | null;
  daysOpenPerWeek: number | null;
  servicesPerDay: number | null;
  averageTurnover: number | null;
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
  // Baseline metrics for economic calculations
  baseline: BaselineMetrics;
}

const emptyBaseline: BaselineMetrics = {
  coversPerMonth: null,
  averageSpendPerCover: null,
  seatCapacity: null,
  daysOpenPerWeek: null,
  servicesPerDay: null,
  averageTurnover: null,
};

const emptyFormData: BranchFormData = {
  id: "",
  name: "",
  address: "",
  city: "",
  googlePlaceId: "",
  helloPeterId: "",
  facebookPageId: "",
  tripAdvisorId: "",
  baseline: emptyBaseline,
};

export function BranchesTab({ initialBranches }: BranchesTabProps) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [formData, setFormData] = useState<BranchFormData>(emptyFormData);
  const [activeTab, setActiveTab] = useState("details");

  const handleAdd = () => {
    setFormData(emptyFormData);
    setIsEditing(false);
    setActiveTab("details");
    setIsModalOpen(true);
  };

  const handleEdit = async (branch: Branch) => {
    setFormData({
      id: branch.id,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      googlePlaceId: "",
      helloPeterId: "",
      facebookPageId: "",
      tripAdvisorId: "",
      baseline: emptyBaseline,
    });
    setIsEditing(true);
    setActiveTab("details");
    setIsModalOpen(true);

    // Fetch baseline metrics for this branch
    setIsLoadingMetrics(true);
    try {
      const res = await fetch(`/api/portal/tenants/${branch.id}/baseline`);
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          setFormData(prev => ({
            ...prev,
            baseline: {
              coversPerMonth: data.metrics.coversPerMonth,
              averageSpendPerCover: data.metrics.averageSpendPerCover,
              seatCapacity: data.metrics.seatCapacity,
              daysOpenPerWeek: data.metrics.daysOpenPerWeek,
              servicesPerDay: data.metrics.servicesPerDay,
              averageTurnover: data.metrics.averageTurnover,
            },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch baseline metrics:', error);
    } finally {
      setIsLoadingMetrics(false);
    }
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

    try {
      if (isEditing) {
        // Save baseline metrics if any values are set
        const hasBaseline = Object.values(formData.baseline).some(v => v !== null);
        if (hasBaseline) {
          const baselineRes = await fetch(`/api/portal/tenants/${formData.id}/baseline`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              coversPerMonth: formData.baseline.coversPerMonth,
              averageSpendPerCover: formData.baseline.averageSpendPerCover,
              seatCapacity: formData.baseline.seatCapacity,
              daysOpenPerWeek: formData.baseline.daysOpenPerWeek,
              servicesPerDay: formData.baseline.servicesPerDay,
              averageTurnover: formData.baseline.averageTurnover,
            }),
          });
          if (!baselineRes.ok) {
            const errorData = await baselineRes.json().catch(() => ({}));
            console.error('Baseline save error:', errorData);
            throw new Error(errorData.error || 'Failed to save baseline metrics');
          }
        }

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

      setIsModalOpen(false);
      setFormData(emptyFormData);
      
      toast.success(isEditing ? "Branch updated" : "Branch created", {
        description: isEditing 
          ? "Branch details and metrics saved. Economic impacts will be recalculated." 
          : `"${formData.name}" has been added to your organization.`,
      });
    } catch (error) {
      console.error('Error saving branch:', error);
      toast.error("Failed to save", {
        description: "There was an error saving the branch details.",
      });
    } finally {
      setIsSaving(false);
    }
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  asChild
                                >
                                  <Link href={`/branches/${branch.id}/till-reviews`}>
                                    <QrCode className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Receipt Feedback QR</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit Branch" : "Add New Branch"}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Update branch details, review connections, and business metrics."
                  : "Add a new branch location and configure its settings."}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="sources" className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Sources
                </TabsTrigger>
                <TabsTrigger value="metrics" className="flex items-center gap-2" disabled={!isEditing}>
                  <DollarSign className="h-4 w-4" />
                  Metrics
                </TabsTrigger>
              </TabsList>

              <div className="overflow-y-auto max-h-[50vh] pr-2 mt-4">
                {/* Details Tab */}
                <TabsContent value="details" className="space-y-4 mt-0">
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
                </TabsContent>

                {/* Sources Tab */}
                <TabsContent value="sources" className="space-y-4 mt-0">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
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
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics" className="space-y-4 mt-0">
                  {isLoadingMetrics ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-sm text-blue-800">
                          These metrics help calculate revenue impact estimates for recommendations. 
                          More accurate data leads to better insights.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Customer Volume
                        </h4>
                        
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TooltipProvider>
                            <div className="space-y-2">
                              <Label htmlFor="coversPerMonth" className="flex items-center gap-1">
                                Covers per Month
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Average number of customers served per month</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                              <Input
                                id="coversPerMonth"
                                type="number"
                                min={0}
                                value={formData.baseline.coversPerMonth ?? ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    baseline: {
                                      ...prev.baseline,
                                      coversPerMonth: e.target.value ? parseInt(e.target.value) : null,
                                    },
                                  }))
                                }
                                placeholder="e.g., 3000"
                              />
                            </div>
                          </TooltipProvider>

                          <TooltipProvider>
                            <div className="space-y-2">
                              <Label htmlFor="seatCapacity" className="flex items-center gap-1">
                                Seat Capacity
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Total number of seats available</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                              <Input
                                id="seatCapacity"
                                type="number"
                                min={0}
                                value={formData.baseline.seatCapacity ?? ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    baseline: {
                                      ...prev.baseline,
                                      seatCapacity: e.target.value ? parseInt(e.target.value) : null,
                                    },
                                  }))
                                }
                                placeholder="e.g., 60"
                              />
                            </div>
                          </TooltipProvider>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <TooltipProvider>
                            <div className="space-y-2">
                              <Label htmlFor="daysOpenPerWeek" className="flex items-center gap-1">
                                Days Open per Week
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Number of days the restaurant is open each week</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                              <Input
                                id="daysOpenPerWeek"
                                type="number"
                                min={1}
                                max={7}
                                value={formData.baseline.daysOpenPerWeek ?? ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    baseline: {
                                      ...prev.baseline,
                                      daysOpenPerWeek: e.target.value ? parseInt(e.target.value) : null,
                                    },
                                  }))
                                }
                                placeholder="e.g., 6"
                              />
                            </div>
                          </TooltipProvider>

                          <TooltipProvider>
                            <div className="space-y-2">
                              <Label htmlFor="servicesPerDay" className="flex items-center gap-1">
                                Services per Day
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Number of meal services per day (e.g., 2 for lunch + dinner)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                              <Input
                                id="servicesPerDay"
                                type="number"
                                min={1}
                                max={5}
                                value={formData.baseline.servicesPerDay ?? ""}
                                onChange={(e) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    baseline: {
                                      ...prev.baseline,
                                      servicesPerDay: e.target.value ? parseInt(e.target.value) : null,
                                    },
                                  }))
                                }
                                placeholder="e.g., 2"
                              />
                            </div>
                          </TooltipProvider>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Revenue Metrics
                        </h4>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <TooltipProvider>
                            <div className="space-y-2">
                              <Label htmlFor="averageSpendPerCover" className="flex items-center gap-1">
                                Average Spend per Cover
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Average amount spent per customer (in your local currency)</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R</span>
                                <Input
                                  id="averageSpendPerCover"
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={formData.baseline.averageSpendPerCover ?? ""}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      baseline: {
                                        ...prev.baseline,
                                        averageSpendPerCover: e.target.value ? parseFloat(e.target.value) : null,
                                      },
                                    }))
                                  }
                                  placeholder="e.g., 250"
                                  className="pl-7"
                                />
                              </div>
                            </div>
                          </TooltipProvider>

                          <TooltipProvider>
                            <div className="space-y-2">
                              <Label htmlFor="averageTurnover" className="flex items-center gap-1">
                                Monthly Turnover (Optional)
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="max-w-xs">Average monthly revenue. If not provided, calculated from covers x average spend.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R</span>
                                <Input
                                  id="averageTurnover"
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={formData.baseline.averageTurnover ?? ""}
                                  onChange={(e) =>
                                    setFormData((prev) => ({
                                      ...prev,
                                      baseline: {
                                        ...prev.baseline,
                                        averageTurnover: e.target.value ? parseFloat(e.target.value) : null,
                                      },
                                    }))
                                  }
                                  placeholder="e.g., 750000"
                                  className="pl-7"
                                />
                              </div>
                            </div>
                          </TooltipProvider>
                        </div>
                      </div>

                      {/* Calculated Preview */}
                      {(formData.baseline.coversPerMonth && formData.baseline.averageSpendPerCover) && (
                        <>
                          <Separator />
                          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                            <h4 className="font-medium text-sm">Calculated Estimates</h4>
                            <div className="grid gap-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Est. Monthly Revenue:</span>
                                <span className="font-medium">
                                  R {(formData.baseline.coversPerMonth * formData.baseline.averageSpendPerCover).toLocaleString()}
                                </span>
                              </div>
                              {formData.baseline.seatCapacity && formData.baseline.daysOpenPerWeek && formData.baseline.servicesPerDay && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Avg Covers per Service:</span>
                                  <span className="font-medium">
                                    {Math.round(formData.baseline.coversPerMonth / (formData.baseline.daysOpenPerWeek * 4.33 * formData.baseline.servicesPerDay))}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </TabsContent>
              </div>
            </Tabs>

            <DialogFooter className="mt-6">
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
