'use client';

/**
 * Economics Client Component
 * 
 * Interactive UI for managing economic parameters with visual controls
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Play,
  Eye,
  Save,
  GitCompare,
  Check,
  HelpCircle,
  TrendingUp,
  Users,
  Utensils,
  Sparkles,
  MapPin,
  Brush,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EconomicParameters, ThemeEconomicWeightMap } from '@/server/parameters/types';

interface ParameterVersion {
  id: string;
  versionNumber: number;
  name: string;
  description: string | null;
  parameters: Record<string, unknown>;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  activatedAt: string | null;
  createdAt: string;
  createdBy: { id: string; email: string; firstName: string | null; lastName: string | null };
  activatedBy: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  _count: { scoreRuns: number };
}

interface Props {
  initialVersions: ParameterVersion[];
  themeCategories: string[];
  defaultParams: EconomicParameters;
}

// Theme category display info
const CATEGORY_INFO: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = {
  PRODUCT: { label: 'Product (Food/Menu)', icon: Utensils, description: 'Food quality, menu variety, taste' },
  SERVICE: { label: 'Service', icon: Users, description: 'Staff friendliness, speed, attentiveness' },
  VALUE: { label: 'Value', icon: DollarSign, description: 'Price fairness, portion sizes' },
  AMBIANCE: { label: 'Ambiance', icon: Sparkles, description: 'Atmosphere, decor, music' },
  CLEANLINESS: { label: 'Cleanliness', icon: Brush, description: 'Hygiene, restrooms, table cleanliness' },
  LOCATION: { label: 'Location', icon: MapPin, description: 'Accessibility, parking, neighborhood' },
  OTHER: { label: 'Other', icon: HelpCircle, description: 'General feedback, miscellaneous' },
};

// Help text for parameters
const PARAM_HELP = {
  revenue_weight: 'How much this theme affects direct revenue. Higher = more impact on revenue projections.',
  footfall_weight: 'How much this theme affects customer volume. Higher = bigger footfall change estimates.',
  conversion_weight: 'How much this theme affects online-to-visit conversion. Higher = more impact on click-through.',
  rating_to_revenue_elasticity: 'Research shows 5-9% revenue change per star. Min is conservative, max is optimistic.',
  rating_to_click_elasticity: 'How much online engagement changes per rating point.',
  click_to_visit_conversion_rate: 'What % of clicks/directions convert to actual visits.',
  min_reviews: 'Minimum reviews needed before showing ROI estimates.',
  min_days: 'Minimum days of data needed for ROI claims.',
  min_themes: 'Minimum themes with data needed for ROI estimates.',
};

export function EconomicsClient({ initialVersions, themeCategories, defaultParams }: Props) {
  const [versions, setVersions] = useState<ParameterVersion[]>(initialVersions);
  const [selectedVersion, setSelectedVersion] = useState<ParameterVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<ParameterVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // New version dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  
  // Editing state - economic params only
  const [editingParams, setEditingParams] = useState<EconomicParameters | null>(null);
  const [changelogNote, setChangelogNote] = useState('');

  const activeVersion = versions.find(v => v.status === 'ACTIVE');
  const draftVersions = versions.filter(v => v.status === 'DRAFT');

  // Extract economic params from a version
  const getEconomicParams = (version: ParameterVersion | null): EconomicParameters => {
    if (!version?.parameters) return defaultParams;
    const params = version.parameters as { economic?: EconomicParameters };
    return params.economic || defaultParams;
  };

  const refreshVersions = async () => {
    try {
      const res = await fetch('/api/admin/parameters');
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Failed to refresh versions:', error);
    }
  };

  const createVersion = async () => {
    if (!newVersionName.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/parameters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVersionName,
          description: newVersionDesc,
          baseOnVersionId: activeVersion?.id,
        }),
      });

      if (res.ok) {
        toast.success('Draft version created');
        setNewVersionName('');
        setNewVersionDesc('');
        setShowNewDialog(false);
        await refreshVersions();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to create version');
      }
    } catch (error) {
      toast.error('Failed to create version');
    } finally {
      setIsCreating(false);
    }
  };

  const saveChanges = async () => {
    if (!selectedVersion || !editingParams) return;

    setIsSaving(true);
    try {
      // Merge economic params back into full parameters
      const fullParams = {
        ...selectedVersion.parameters,
        economic: editingParams,
      };

      const res = await fetch(`/api/admin/parameters/${selectedVersion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          parameters: fullParams,
          changelogNote,
        }),
      });

      if (res.ok) {
        toast.success('Changes saved');
        setChangelogNote('');
        await refreshVersions();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save');
      }
    } catch (error) {
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const activateVersion = async (versionId: string) => {
    setIsActivating(true);
    try {
      const res = await fetch(`/api/admin/parameters/${versionId}/activate`, {
        method: 'POST',
      });

      if (res.ok) {
        toast.success('Version published and activated');
        await refreshVersions();
        setSelectedVersion(null);
        setEditingParams(null);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to activate');
      }
    } catch (error) {
      toast.error('Failed to activate version');
    } finally {
      setIsActivating(false);
    }
  };

  const formatUser = (user: { firstName: string | null; lastName: string | null; email: string }) =>
    user.firstName ? `${user.firstName} ${user.lastName}` : user.email;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  // Update a theme weight
  const updateThemeWeight = (category: string, field: 'revenue_weight' | 'footfall_weight' | 'conversion_weight', value: number) => {
    if (!editingParams) return;
    setEditingParams({
      ...editingParams,
      theme_economic_weights: {
        ...editingParams.theme_economic_weights,
        [category]: {
          ...editingParams.theme_economic_weights[category],
          [field]: value,
        },
      },
    });
  };

  // Calculate changes between versions
  const calculateChanges = useMemo(() => {
    if (!selectedVersion || !activeVersion) return [];
    
    const current = getEconomicParams(selectedVersion);
    const active = getEconomicParams(activeVersion);
    const changes: Array<{ path: string; from: unknown; to: unknown }> = [];

    // Compare theme weights
    for (const category of themeCategories) {
      const currentWeights = current.theme_economic_weights[category];
      const activeWeights = active.theme_economic_weights[category];
      
      if (currentWeights?.revenue_weight !== activeWeights?.revenue_weight) {
        changes.push({
          path: `${category}.revenue_weight`,
          from: activeWeights?.revenue_weight ?? 'N/A',
          to: currentWeights?.revenue_weight ?? 'N/A',
        });
      }
      if (currentWeights?.footfall_weight !== activeWeights?.footfall_weight) {
        changes.push({
          path: `${category}.footfall_weight`,
          from: activeWeights?.footfall_weight ?? 'N/A',
          to: currentWeights?.footfall_weight ?? 'N/A',
        });
      }
      if (currentWeights?.conversion_weight !== activeWeights?.conversion_weight) {
        changes.push({
          path: `${category}.conversion_weight`,
          from: activeWeights?.conversion_weight ?? 'N/A',
          to: currentWeights?.conversion_weight ?? 'N/A',
        });
      }
    }

    // Compare elasticity ranges
    if (current.rating_to_revenue_elasticity.min !== active.rating_to_revenue_elasticity.min) {
      changes.push({ path: 'revenue_elasticity.min', from: active.rating_to_revenue_elasticity.min, to: current.rating_to_revenue_elasticity.min });
    }
    if (current.rating_to_revenue_elasticity.max !== active.rating_to_revenue_elasticity.max) {
      changes.push({ path: 'revenue_elasticity.max', from: active.rating_to_revenue_elasticity.max, to: current.rating_to_revenue_elasticity.max });
    }

    return changes;
  }, [selectedVersion, activeVersion, themeCategories]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={() => setShowNewDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Draft
          </Button>
          {activeVersion && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedVersion(activeVersion);
                setEditingParams(getEconomicParams(activeVersion));
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Active
            </Button>
          )}
        </div>

        {/* Active Version Summary */}
        {activeVersion && (
          <Card className="border-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    {activeVersion.name}
                  </CardTitle>
                  <CardDescription>
                    Version {activeVersion.versionNumber} • {activeVersion._count.scoreRuns} score runs
                  </CardDescription>
                </div>
                <Badge variant="default">ACTIVE</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Activated: {activeVersion.activatedAt ? formatDate(activeVersion.activatedAt) : 'N/A'} by {activeVersion.activatedBy ? formatUser(activeVersion.activatedBy) : 'System'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Draft Versions */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Draft Versions</h3>
          {draftVersions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No draft versions. Create one to start editing economic parameters.
              </CardContent>
            </Card>
          ) : (
            draftVersions.map((version) => (
              <Card key={version.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{version.name}</CardTitle>
                      <CardDescription>
                        Version {version.versionNumber} • Created {formatDate(version.createdAt)}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">DRAFT</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {version.description || 'No description'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVersion(version);
                        setEditingParams(getEconomicParams(version));
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => activateVersion(version.id)}
                      disabled={isActivating}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Publish
                    </Button>
                    {activeVersion && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedVersion(version);
                          setCompareVersion(activeVersion);
                          setShowDiff(true);
                        }}
                      >
                        <GitCompare className="h-4 w-4 mr-2" />
                        Diff
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* New Version Dialog */}
        <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Economic Parameter Version</DialogTitle>
              <DialogDescription>
                Create a draft based on the current active version.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Version Name</Label>
                <Input
                  id="name"
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                  placeholder="e.g., Q2 2024 Weight Adjustments"
                />
              </div>
              <div>
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  value={newVersionDesc}
                  onChange={(e) => setNewVersionDesc(e.target.value)}
                  placeholder="Optional description of changes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createVersion} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!selectedVersion && !!editingParams && !showDiff} onOpenChange={() => {
          setSelectedVersion(null);
          setEditingParams(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedVersion?.name}
                <Badge variant={selectedVersion?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                  {selectedVersion?.status}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Version {selectedVersion?.versionNumber} • Edit economic impact parameters
              </DialogDescription>
            </DialogHeader>

            <div className="overflow-y-auto max-h-[55vh] pr-2">
              {editingParams && (
                <Tabs defaultValue="weights" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="weights">Theme Weights</TabsTrigger>
                    <TabsTrigger value="elasticity">Elasticity Ranges</TabsTrigger>
                    <TabsTrigger value="thresholds">Data Thresholds</TabsTrigger>
                  </TabsList>

                  {/* Theme Weights Tab */}
                  <TabsContent value="weights" className="space-y-4">
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-muted-foreground">
                        Theme weights determine how much each category affects revenue, footfall, and conversion estimates. 
                        Values range from 0 to 2, where 1.0 is baseline impact.
                      </p>
                    </div>

                    <Accordion type="multiple" className="space-y-2">
                      {themeCategories.map((category) => {
                        const info = CATEGORY_INFO[category] || CATEGORY_INFO.OTHER;
                        const Icon = info.icon;
                        const weights = editingParams.theme_economic_weights[category] || {
                          revenue_weight: 1.0,
                          footfall_weight: 1.0,
                          conversion_weight: 1.0,
                        };

                        return (
                          <AccordionItem key={category} value={category} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-3">
                                <Icon className="h-5 w-5 text-muted-foreground" />
                                <div className="text-left">
                                  <p className="font-medium">{info.label}</p>
                                  <p className="text-xs text-muted-foreground">{info.description}</p>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-6 pt-4">
                              {/* Revenue Weight */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2">
                                    Revenue Impact
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        {PARAM_HELP.revenue_weight}
                                      </TooltipContent>
                                    </Tooltip>
                                  </Label>
                                  <span className="font-mono text-sm">{weights.revenue_weight.toFixed(2)}</span>
                                </div>
                                <Slider
                                  value={[weights.revenue_weight]}
                                  onValueChange={([v]) => updateThemeWeight(category, 'revenue_weight', v)}
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  disabled={selectedVersion?.status !== 'DRAFT'}
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Low (0)</span>
                                  <span>Baseline (1)</span>
                                  <span>High (2)</span>
                                </div>
                              </div>

                              {/* Footfall Weight */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2">
                                    Footfall Impact
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        {PARAM_HELP.footfall_weight}
                                      </TooltipContent>
                                    </Tooltip>
                                  </Label>
                                  <span className="font-mono text-sm">{weights.footfall_weight.toFixed(2)}</span>
                                </div>
                                <Slider
                                  value={[weights.footfall_weight]}
                                  onValueChange={([v]) => updateThemeWeight(category, 'footfall_weight', v)}
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  disabled={selectedVersion?.status !== 'DRAFT'}
                                />
                              </div>

                              {/* Conversion Weight */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="flex items-center gap-2">
                                    Conversion Impact
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        {PARAM_HELP.conversion_weight}
                                      </TooltipContent>
                                    </Tooltip>
                                  </Label>
                                  <span className="font-mono text-sm">{weights.conversion_weight.toFixed(2)}</span>
                                </div>
                                <Slider
                                  value={[weights.conversion_weight]}
                                  onValueChange={([v]) => updateThemeWeight(category, 'conversion_weight', v)}
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  disabled={selectedVersion?.status !== 'DRAFT'}
                                />
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </TabsContent>

                  {/* Elasticity Tab */}
                  <TabsContent value="elasticity" className="space-y-6">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        Elasticity ranges define how rating changes translate to business impact. 
                        Based on Harvard/Yelp research showing 5-9% revenue change per star.
                      </p>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Rating to Revenue Elasticity
                        </CardTitle>
                        <CardDescription>
                          How much revenue changes per point of rating change
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Minimum (Conservative)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="0.5"
                                value={editingParams.rating_to_revenue_elasticity.min}
                                onChange={(e) => setEditingParams({
                                  ...editingParams,
                                  rating_to_revenue_elasticity: {
                                    ...editingParams.rating_to_revenue_elasticity,
                                    min: parseFloat(e.target.value) || 0,
                                  },
                                })}
                                disabled={selectedVersion?.status !== 'DRAFT'}
                                className="font-mono"
                              />
                              <span className="text-sm text-muted-foreground">
                                = {(editingParams.rating_to_revenue_elasticity.min * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Maximum (Optimistic)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max="0.5"
                                value={editingParams.rating_to_revenue_elasticity.max}
                                onChange={(e) => setEditingParams({
                                  ...editingParams,
                                  rating_to_revenue_elasticity: {
                                    ...editingParams.rating_to_revenue_elasticity,
                                    max: parseFloat(e.target.value) || 0,
                                  },
                                })}
                                disabled={selectedVersion?.status !== 'DRAFT'}
                                className="font-mono"
                              />
                              <span className="text-sm text-muted-foreground">
                                = {(editingParams.rating_to_revenue_elasticity.max * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Rating to Click Elasticity</CardTitle>
                        <CardDescription>
                          How much online engagement changes per rating point
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Minimum</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="0.5"
                              value={editingParams.rating_to_click_elasticity.min}
                              onChange={(e) => setEditingParams({
                                ...editingParams,
                                rating_to_click_elasticity: {
                                  ...editingParams.rating_to_click_elasticity,
                                  min: parseFloat(e.target.value) || 0,
                                },
                              })}
                              disabled={selectedVersion?.status !== 'DRAFT'}
                              className="font-mono"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Maximum</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max="0.5"
                              value={editingParams.rating_to_click_elasticity.max}
                              onChange={(e) => setEditingParams({
                                ...editingParams,
                                rating_to_click_elasticity: {
                                  ...editingParams.rating_to_click_elasticity,
                                  max: parseFloat(e.target.value) || 0,
                                },
                              })}
                              disabled={selectedVersion?.status !== 'DRAFT'}
                              className="font-mono"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Click to Visit Conversion Rate</CardTitle>
                        <CardDescription>
                          What percentage of online actions convert to visits
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-4">
                          <Slider
                            value={[editingParams.click_to_visit_conversion_rate * 100]}
                            onValueChange={([v]) => setEditingParams({
                              ...editingParams,
                              click_to_visit_conversion_rate: v / 100,
                            })}
                            min={0}
                            max={50}
                            step={1}
                            disabled={selectedVersion?.status !== 'DRAFT'}
                            className="flex-1"
                          />
                          <span className="font-mono text-lg w-16 text-right">
                            {(editingParams.click_to_visit_conversion_rate * 100).toFixed(0)}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Thresholds Tab */}
                  <TabsContent value="thresholds" className="space-y-6">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">
                        Data thresholds ensure we only show ROI estimates when there&apos;s sufficient data to be meaningful.
                      </p>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Minimum Data for ROI Claims
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Min Reviews</Label>
                            <Input
                              type="number"
                              min="1"
                              max="1000"
                              value={editingParams.min_data_for_roi_claim.min_reviews}
                              onChange={(e) => setEditingParams({
                                ...editingParams,
                                min_data_for_roi_claim: {
                                  ...editingParams.min_data_for_roi_claim,
                                  min_reviews: parseInt(e.target.value) || 1,
                                },
                              })}
                              disabled={selectedVersion?.status !== 'DRAFT'}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Min Days</Label>
                            <Input
                              type="number"
                              min="1"
                              max="365"
                              value={editingParams.min_data_for_roi_claim.min_days}
                              onChange={(e) => setEditingParams({
                                ...editingParams,
                                min_data_for_roi_claim: {
                                  ...editingParams.min_data_for_roi_claim,
                                  min_days: parseInt(e.target.value) || 1,
                                },
                              })}
                              disabled={selectedVersion?.status !== 'DRAFT'}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Min Themes</Label>
                            <Input
                              type="number"
                              min="1"
                              max="20"
                              value={editingParams.min_data_for_roi_claim.min_themes}
                              onChange={(e) => setEditingParams({
                                ...editingParams,
                                min_data_for_roi_claim: {
                                  ...editingParams.min_data_for_roi_claim,
                                  min_themes: parseInt(e.target.value) || 1,
                                },
                              })}
                              disabled={selectedVersion?.status !== 'DRAFT'}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Economic Calculations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Enable Economic Impact Calculations</Label>
                            <p className="text-sm text-muted-foreground">
                              When disabled, no revenue/footfall estimates will be shown
                            </p>
                          </div>
                          <Checkbox
                            checked={editingParams.enabled}
                            onCheckedChange={(checked: boolean) => setEditingParams({
                              ...editingParams,
                              enabled: checked,
                            })}
                            disabled={selectedVersion?.status !== 'DRAFT'}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            {selectedVersion?.status === 'DRAFT' && (
              <>
                <div className="border-t pt-4 mt-4">
                  <Label htmlFor="changelog">Changelog Note (optional)</Label>
                  <Textarea
                    id="changelog"
                    value={changelogNote}
                    onChange={(e) => setChangelogNote(e.target.value)}
                    placeholder="Describe what changed and why..."
                    className="mt-1.5"
                    rows={2}
                  />
                </div>

                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={saveChanges} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button onClick={() => activateVersion(selectedVersion.id)} disabled={isActivating}>
                    <Play className="h-4 w-4 mr-2" />
                    {isActivating ? 'Publishing...' : 'Publish'}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Diff Dialog */}
        <Dialog open={showDiff} onOpenChange={() => {
          setShowDiff(false);
          setCompareVersion(null);
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitCompare className="h-5 w-5" />
                Compare Versions
              </DialogTitle>
              <DialogDescription>
                Showing differences in economic parameters
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center gap-4 py-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <Badge variant="default">ACTIVE</Badge>
                <p className="text-sm font-medium mt-1">{compareVersion?.name}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <Badge variant="secondary">DRAFT</Badge>
                <p className="text-sm font-medium mt-1">{selectedVersion?.name}</p>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              {calculateChanges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No differences in economic parameters
                </div>
              ) : (
                <div className="space-y-2">
                  {calculateChanges.map((change, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <span className="font-mono text-sm">{change.path}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-red-600 font-mono text-sm">{String(change.from)}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <span className="text-green-600 font-mono text-sm">{String(change.to)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
