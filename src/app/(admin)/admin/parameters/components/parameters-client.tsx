'use client';

/**
 * Parameters Client Component
 * 
 * Interactive UI for managing parameter versions
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  AlertCircle,
  History,
  GitCompare,
} from 'lucide-react';
import { toast } from 'sonner';

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
}

export function ParametersClient({ initialVersions }: Props) {
  const [versions, setVersions] = useState<ParameterVersion[]>(initialVersions);
  const [selectedVersion, setSelectedVersion] = useState<ParameterVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<ParameterVersion | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionDesc, setNewVersionDesc] = useState('');
  const [editedParams, setEditedParams] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);

  const activeVersion = versions.find(v => v.status === 'ACTIVE');
  const draftVersions = versions.filter(v => v.status === 'DRAFT');
  const archivedVersions = versions.filter(v => v.status === 'ARCHIVED');

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

  const createVersion = async (baseVersionId?: string) => {
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
          baseOnVersionId: baseVersionId,
        }),
      });

      if (res.ok) {
        toast.success('Draft version created');
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

  const activateVersion = async (versionId: string) => {
    setIsActivating(true);
    try {
      const res = await fetch(`/api/admin/parameters/${versionId}/activate`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Version activated', {
          description: `${data.changelog?.length || 0} changes applied`,
        });
        await refreshVersions();
        setSelectedVersion(null);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to activate version');
      }
    } catch (error) {
      toast.error('Failed to activate version');
    } finally {
      setIsActivating(false);
    }
  };

  const updateVersion = async (versionId: string) => {
    try {
      let params;
      try {
        params = JSON.parse(editedParams);
      } catch {
        toast.error('Invalid JSON');
        return;
      }

      const res = await fetch(`/api/admin/parameters/${versionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parameters: params }),
      });

      if (res.ok) {
        toast.success('Parameters updated');
        await refreshVersions();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update');
      }
    } catch (error) {
      toast.error('Failed to update version');
    }
  };

  const deleteVersion = async (versionId: string) => {
    try {
      const res = await fetch(`/api/admin/parameters/${versionId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        toast.success('Version deleted');
        await refreshVersions();
        setSelectedVersion(null);
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete version');
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
              <DialogTitle>Create New Parameter Version</DialogTitle>
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
                  placeholder="e.g., Q2 2024 Adjustments"
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

        {selectedVersion && compareVersion && (
          <Button variant="outline" onClick={() => setShowDiff(true)}>
            <GitCompare className="h-4 w-4 mr-2" />
            Compare Selected
          </Button>
        )}
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
                  Version {activeVersion.versionNumber} • {activeVersion._count.scoreRuns} score runs
                </CardDescription>
              </div>
              <Badge variant="default">ACTIVE</Badge>
            </div>
          </CardHeader>
          <CardContent>
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
                  setEditedParams(JSON.stringify(activeVersion.parameters, null, 2));
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
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
                No draft versions. Create one to start editing.
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
                        setEditedParams(JSON.stringify(version.parameters, null, 2));
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteVersion(version.id)}
                    >
                      <Trash2 className="h-4 w-4" />
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
                        Version {version.versionNumber} • {version._count.scoreRuns} score runs
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
                        setEditedParams(JSON.stringify(version.parameters, null, 2));
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
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedVersion?.name}
              <Badge variant={getStatusColor(selectedVersion?.status || '')} className="ml-2">
                {selectedVersion?.status}
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Version {selectedVersion?.versionNumber}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px]">
            <div className="space-y-4">
              {selectedVersion?.status === 'DRAFT' ? (
                <div className="space-y-2">
                  <Label>Parameters (JSON)</Label>
                  <textarea
                    className="w-full h-96 font-mono text-sm p-4 rounded-md border bg-muted"
                    value={editedParams}
                    onChange={(e) => setEditedParams(e.target.value)}
                  />
                </div>
              ) : (
                <pre className="p-4 rounded-md bg-muted overflow-auto text-sm">
                  {JSON.stringify(selectedVersion?.parameters, null, 2)}
                </pre>
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            {selectedVersion?.status === 'DRAFT' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => updateVersion(selectedVersion.id)}
                >
                  Save Changes
                </Button>
                <Button onClick={() => activateVersion(selectedVersion.id)} disabled={isActivating}>
                  {isActivating ? 'Publishing...' : 'Publish'}
                </Button>
              </>
            )}
          </DialogFooter>
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
                <Badge variant={getStatusColor(selectedVersion?.status || '')} className="ml-2">
                  {selectedVersion?.status}
                </Badge>
              </h4>
              <ScrollArea className="h-[400px]">
                <pre className="p-4 rounded-md bg-muted text-sm">
                  {JSON.stringify(selectedVersion?.parameters, null, 2)}
                </pre>
              </ScrollArea>
            </div>
            <div>
              <h4 className="font-medium mb-2">
                {compareVersion?.name}
                <Badge variant={getStatusColor(compareVersion?.status || '')} className="ml-2">
                  {compareVersion?.status}
                </Badge>
              </h4>
              <ScrollArea className="h-[400px]">
                <pre className="p-4 rounded-md bg-muted text-sm">
                  {JSON.stringify(compareVersion?.parameters, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
