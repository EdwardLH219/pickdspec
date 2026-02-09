'use client';

/**
 * Rules Client Component
 * 
 * Interactive UI for managing rule set versions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Play,
  Eye,
  Edit,
  Trash2,
  Copy,
  Check,
  GitCompare,
  AlertCircle,
  Shield,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';

export interface RuleSetVersion {
  id: string;
  versionNumber: number;
  name: string;
  description: string | null;
  rules: {
    confidenceRules?: Array<{
      id: string;
      name: string;
      conditions: unknown[];
      outcome: { confidence: number; reasonCode: string };
      priority: number;
    }>;
    sufficiencyRules?: Array<{
      id: string;
      name: string;
      conditions: unknown[];
      outcome: { level: string; reasonCode: string };
      priority: number;
    }>;
  };
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  activatedAt: string | null;
  createdAt: string;
  ruleSet: { id: string; name: string; isSystem: boolean; createdAt: string; updatedAt: string };
  createdBy: { id: string; email: string; firstName: string | null; lastName: string | null };
  activatedBy: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
}

interface Props {
  initialVersions: RuleSetVersion[];
}

export function RulesClient({ initialVersions }: Props) {
  const [versions, setVersions] = useState<RuleSetVersion[]>(initialVersions);
  const [selectedVersion, setSelectedVersion] = useState<RuleSetVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<RuleSetVersion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [editedRules, setEditedRules] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);

  const activeVersion = versions.find(v => v.status === 'ACTIVE');
  const draftVersions = versions.filter(v => v.status === 'DRAFT');
  const archivedVersions = versions.filter(v => v.status === 'ARCHIVED');

  const refreshVersions = async () => {
    try {
      const res = await fetch('/api/admin/rules');
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions);
      }
    } catch (error) {
      console.error('Failed to refresh versions:', error);
    }
  };

  const createVersion = async (baseVersionId?: string) => {
    if (!newVersionName.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVersionName,
          description: newVersionDesc,
          baseOnVersionId: baseVersionId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Draft version created', {
          description: `${data.ruleCount.confidence} confidence rules, ${data.ruleCount.sufficiency} sufficiency rules`,
        });
        setNewVersionName('');
        setNewVersionDesc('');
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

  const formatUser = (user: { firstName: string | null; lastName: string | null; email: string }) =>
    user.firstName ? `${user.firstName} ${user.lastName}` : user.email;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'default';
      case 'DRAFT': return 'secondary';
      case 'ARCHIVED': return 'outline';
      default: return 'outline';
    }
  };

  const countRules = (rules: RuleSetVersion['rules']) => ({
    confidence: rules.confidenceRules?.length ?? 0,
    sufficiency: rules.sufficiencyRules?.length ?? 0,
  });

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Draft
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Rule Set Version</DialogTitle>
              <DialogDescription>
                Create a new draft based on the active version or start fresh.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Version Name</Label>
                <Input
                  id="name"
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                  placeholder="e.g., Q2 2024 Rule Updates"
                />
              </div>
              <div>
                <Label htmlFor="desc">Description</Label>
                <Input
                  id="desc"
                  value={newVersionDesc}
                  onChange={(e) => setNewVersionDesc(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => createVersion()}
                disabled={isCreating}
              >
                Start from Defaults
              </Button>
              <Button
                onClick={() => createVersion(activeVersion?.id)}
                disabled={isCreating || !activeVersion}
              >
                {isCreating ? 'Creating...' : 'Clone Active Version'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Version Card */}
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
                  Version {activeVersion.versionNumber} • {activeVersion.ruleSet.name}
                </CardDescription>
              </div>
              <Badge variant="default">ACTIVE</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>{countRules(activeVersion.rules).confidence} confidence rules</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <span>{countRules(activeVersion.rules).sufficiency} sufficiency rules</span>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Activated: {activeVersion.activatedAt ? formatDate(activeVersion.activatedAt) : 'N/A'}</p>
              <p>By: {activeVersion.activatedBy ? formatUser(activeVersion.activatedBy) : 'System'}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedVersion(activeVersion);
                  setEditedRules(JSON.stringify(activeVersion.rules, null, 2));
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Rules
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!activeVersion && (
        <Card className="border-yellow-500">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">No active rule set version. Create and activate one to enable scoring.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version Lists */}
      <Tabs defaultValue="drafts">
        <TabsList>
          <TabsTrigger value="drafts">
            Drafts ({draftVersions.length})
          </TabsTrigger>
          <TabsTrigger value="archived">
            Archived ({archivedVersions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drafts" className="space-y-4">
          {draftVersions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No draft versions. Create one to start editing rules.
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
                  <div className="flex gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span>{countRules(version.rules).confidence} confidence rules</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Scale className="h-4 w-4 text-muted-foreground" />
                      <span>{countRules(version.rules).sufficiency} sufficiency rules</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    {version.description || 'No description'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVersion(version);
                        setEditedRules(JSON.stringify(version.rules, null, 2));
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCompareVersion(version);
                        if (activeVersion) {
                          setSelectedVersion(activeVersion);
                          setShowDiff(true);
                        }
                      }}
                    >
                      <GitCompare className="h-4 w-4 mr-2" />
                      Diff
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          {archivedVersions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No archived versions yet.
              </CardContent>
            </Card>
          ) : (
            archivedVersions.map((version) => (
              <Card key={version.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{version.name}</CardTitle>
                      <CardDescription>
                        Version {version.versionNumber}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">ARCHIVED</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedVersion(version);
                        setEditedRules(JSON.stringify(version.rules, null, 2));
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewVersionName(`${version.name} (Copy)`);
                        createVersion(version.id);
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Clone to Draft
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Version Detail Dialog */}
      <Dialog open={!!selectedVersion && !showDiff} onOpenChange={() => setSelectedVersion(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedVersion?.name}
              <Badge variant={getStatusColor(selectedVersion?.status || '') as 'default' | 'secondary' | 'outline'} className="ml-2">
                {selectedVersion?.status}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Version {selectedVersion?.versionNumber}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="confidence">
            <TabsList>
              <TabsTrigger value="confidence">
                Confidence Rules ({selectedVersion?.rules.confidenceRules?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="sufficiency">
                Sufficiency Rules ({selectedVersion?.rules.sufficiencyRules?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="json">
                Raw JSON
              </TabsTrigger>
            </TabsList>

            <TabsContent value="confidence">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {selectedVersion?.rules.confidenceRules?.map((rule) => (
                    <Card key={rule.id}>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          {rule.name}
                          <Badge variant="outline">Priority {rule.priority}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-muted-foreground">Conditions</Label>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs">
                              {JSON.stringify(rule.conditions, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Outcome</Label>
                            <div className="mt-1 p-2 bg-muted rounded">
                              <div>Confidence: <strong>{rule.outcome.confidence}</strong></div>
                              <div>Reason: <Badge variant="outline">{rule.outcome.reasonCode}</Badge></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="sufficiency">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {selectedVersion?.rules.sufficiencyRules?.map((rule) => (
                    <Card key={rule.id}>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          {rule.name}
                          <Badge variant="outline">Priority {rule.priority}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <Label className="text-muted-foreground">Conditions</Label>
                            <pre className="mt-1 p-2 bg-muted rounded text-xs">
                              {JSON.stringify(rule.conditions, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Outcome</Label>
                            <div className="mt-1 p-2 bg-muted rounded">
                              <div>Level: <Badge>{rule.outcome.level}</Badge></div>
                              <div>Reason: <Badge variant="outline">{rule.outcome.reasonCode}</Badge></div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="json">
              <ScrollArea className="h-[400px]">
                {selectedVersion?.status === 'DRAFT' ? (
                  <textarea
                    className="w-full h-96 font-mono text-sm p-4 rounded-md border bg-muted"
                    value={editedRules}
                    onChange={(e) => setEditedRules(e.target.value)}
                  />
                ) : (
                  <pre className="p-4 rounded-md bg-muted overflow-auto text-sm">
                    {JSON.stringify(selectedVersion?.rules, null, 2)}
                  </pre>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Diff Dialog */}
      <Dialog open={showDiff} onOpenChange={() => setShowDiff(false)}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              <GitCompare className="h-5 w-5 inline mr-2" />
              Compare Versions
            </DialogTitle>
            <DialogDescription>
              {selectedVersion?.name} vs {compareVersion?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">
                {selectedVersion?.name}
                <Badge variant={getStatusColor(selectedVersion?.status || '') as 'default' | 'secondary' | 'outline'} className="ml-2">
                  {selectedVersion?.status}
                </Badge>
              </h4>
              <ScrollArea className="h-[400px]">
                <pre className="p-4 rounded-md bg-muted text-sm">
                  {JSON.stringify(selectedVersion?.rules, null, 2)}
                </pre>
              </ScrollArea>
            </div>
            <div>
              <h4 className="font-medium mb-2">
                {compareVersion?.name}
                <Badge variant={getStatusColor(compareVersion?.status || '') as 'default' | 'secondary' | 'outline'} className="ml-2">
                  {compareVersion?.status}
                </Badge>
              </h4>
              <ScrollArea className="h-[400px]">
                <pre className="p-4 rounded-md bg-muted text-sm">
                  {JSON.stringify(compareVersion?.rules, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
