'use client';

/**
 * Activation Drafts Page
 * 
 * View and manage marketing activation drafts generated from completed tasks.
 */

import { useState, useEffect, useCallback } from 'react';
import { useBranch } from '@/hooks/use-branch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Megaphone,
  Star,
  Gift,
  Copy,
  Check,
  Archive,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

// Types
interface ActivationDraft {
  id: string;
  tenantId: string;
  taskId: string;
  themeId: string;
  draftType: 'GBP_POST' | 'REVIEW_PROMPT' | 'OFFER_SUGGESTION';
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  deltaS: number;
  fixScore: number;
  themeCategory: string;
  status: 'DRAFT' | 'MARKED_PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  publishedBy: string | null;
  publishNotes: string | null;
  createdAt: string;
  updatedAt: string;
  task: {
    id: string;
    title: string;
    status: string;
    completedAt: string | null;
  };
  theme: {
    id: string;
    name: string;
    category: string;
  };
}

interface StatusCounts {
  DRAFT: number;
  MARKED_PUBLISHED: number;
  ARCHIVED: number;
}

const DRAFT_TYPE_INFO = {
  GBP_POST: {
    label: 'Google Business Post',
    icon: Megaphone,
    color: 'bg-blue-100 text-blue-700',
    description: 'Post for Google Business Profile',
  },
  REVIEW_PROMPT: {
    label: 'Review Request',
    icon: Star,
    color: 'bg-amber-100 text-amber-700',
    description: 'Message template to request reviews',
  },
  OFFER_SUGGESTION: {
    label: 'Offer Suggestion',
    icon: Gift,
    color: 'bg-green-100 text-green-700',
    description: 'Promotional offer idea',
  },
};

const STATUS_INFO = {
  DRAFT: { label: 'Draft', color: 'default' as const },
  MARKED_PUBLISHED: { label: 'Published', color: 'default' as const },
  ARCHIVED: { label: 'Archived', color: 'secondary' as const },
};

export default function ActivationsPage() {
  const { selectedTenantId, isLoading: branchLoading } = useBranch();
  
  const [drafts, setDrafts] = useState<ActivationDraft[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ DRAFT: 0, MARKED_PUBLISHED: 0, ARCHIVED: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'DRAFT' | 'MARKED_PUBLISHED' | 'ARCHIVED'>('DRAFT');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  // Detail dialog state
  const [selectedDraft, setSelectedDraft] = useState<ActivationDraft | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [publishNotes, setPublishNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchDrafts = useCallback(async () => {
    if (!selectedTenantId) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId: selectedTenantId,
        status: activeTab,
        ...(typeFilter !== 'all' && { type: typeFilter }),
        limit: '100',
      });
      
      const res = await fetch(`/api/portal/activations?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.drafts);
        setStatusCounts(data.statusCounts);
      }
    } catch (error) {
      console.error('Failed to fetch activations:', error);
      toast.error('Failed to load activation drafts');
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, activeTab, typeFilter]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const updateDraftStatus = async (draftId: string, status: 'MARKED_PUBLISHED' | 'ARCHIVED') => {
    setIsSaving(true);
    try {
      const body: Record<string, unknown> = { status };
      if (status === 'MARKED_PUBLISHED' && publishNotes) {
        body.publishNotes = publishNotes;
      }
      if (editedContent && editedContent !== selectedDraft?.content) {
        body.content = editedContent;
      }

      const res = await fetch(`/api/portal/activations/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(status === 'MARKED_PUBLISHED' ? 'Marked as published' : 'Archived');
        setSelectedDraft(null);
        setPublishNotes('');
        fetchDrafts();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update');
      }
    } catch {
      toast.error('Failed to update draft');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const openDraftDetail = (draft: ActivationDraft) => {
    setSelectedDraft(draft);
    setEditedContent(draft.content);
    setPublishNotes(draft.publishNotes || '');
  };

  if (branchLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!selectedTenantId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Please select a branch to view activation drafts.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Activation Drafts</h1>
            <p className="text-muted-foreground">Marketing content generated from your improvements</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchDrafts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="DRAFT" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Drafts ({statusCounts.DRAFT})
            </TabsTrigger>
            <TabsTrigger value="MARKED_PUBLISHED" className="gap-2">
              <Check className="h-4 w-4" />
              Published ({statusCounts.MARKED_PUBLISHED})
            </TabsTrigger>
            <TabsTrigger value="ARCHIVED" className="gap-2">
              <Archive className="h-4 w-4" />
              Archived ({statusCounts.ARCHIVED})
            </TabsTrigger>
          </TabsList>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="GBP_POST">Google Posts</SelectItem>
              <SelectItem value="REVIEW_PROMPT">Review Requests</SelectItem>
              <SelectItem value="OFFER_SUGGESTION">Offer Suggestions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value={activeTab}>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-20 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No {activeTab === 'DRAFT' ? 'drafts' : activeTab === 'MARKED_PUBLISHED' ? 'published content' : 'archived content'} yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {activeTab === 'DRAFT'
                    ? 'When you complete tasks that improve sentiment, marketing content drafts will be automatically generated here.'
                    : 'Content you mark as published will appear here for reference.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {drafts.map((draft) => {
                const typeInfo = DRAFT_TYPE_INFO[draft.draftType];
                const Icon = typeInfo.icon;
                
                return (
                  <Card
                    key={draft.id}
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => openDraftDetail(draft)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${typeInfo.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{draft.title}</CardTitle>
                            <CardDescription className="text-xs">
                              {typeInfo.label} • {draft.theme.name}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge
                          variant={draft.status === 'MARKED_PUBLISHED' ? 'default' : 'secondary'}
                          className="shrink-0"
                        >
                          {STATUS_INFO[draft.status].label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                        {draft.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-green-500" />
                          <span>ΔS: +{draft.deltaS.toFixed(2)}</span>
                        </div>
                        <span>{formatDate(draft.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Draft Detail Dialog */}
      <Dialog open={!!selectedDraft} onOpenChange={() => setSelectedDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          {selectedDraft && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded ${DRAFT_TYPE_INFO[selectedDraft.draftType].color}`}>
                    {(() => {
                      const Icon = DRAFT_TYPE_INFO[selectedDraft.draftType].icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                  </div>
                  <div>
                    <DialogTitle>{selectedDraft.title}</DialogTitle>
                    <DialogDescription>
                      {DRAFT_TYPE_INFO[selectedDraft.draftType].description} • From task: {selectedDraft.task.title}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Content */}
                <div className="space-y-2">
                  <Label>Content</Label>
                  {selectedDraft.status === 'DRAFT' ? (
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="whitespace-pre-wrap text-sm">{selectedDraft.content}</p>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                {selectedDraft.metadata && Object.keys(selectedDraft.metadata).length > 0 && (
                  <div className="space-y-2">
                    <Label>Suggestions</Label>
                    <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                      {Object.entries(selectedDraft.metadata).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="text-muted-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}:
                          </span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance context */}
                <div className="flex gap-4 p-3 bg-green-50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">Sentiment Improvement</p>
                    <p className="font-mono text-green-600 font-medium">+{selectedDraft.deltaS.toFixed(3)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">FixScore</p>
                    <p className="font-mono font-medium">{selectedDraft.fixScore.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Theme</p>
                    <p className="font-medium">{selectedDraft.theme.name}</p>
                  </div>
                </div>

                {/* Publish notes (for published items) */}
                {selectedDraft.status === 'MARKED_PUBLISHED' && selectedDraft.publishNotes && (
                  <div className="space-y-2">
                    <Label>Publish Notes</Label>
                    <p className="text-sm text-muted-foreground">{selectedDraft.publishNotes}</p>
                  </div>
                )}

                {/* Notes input for drafts */}
                {selectedDraft.status === 'DRAFT' && (
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (optional)</Label>
                    <Input
                      id="notes"
                      value={publishNotes}
                      onChange={(e) => setPublishNotes(e.target.value)}
                      placeholder="e.g., Posted on Jan 15, scheduled for next week..."
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(editedContent || selectedDraft.content)}
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copied!' : 'Copy Content'}
                </Button>

                {selectedDraft.status === 'DRAFT' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => updateDraftStatus(selectedDraft.id, 'ARCHIVED')}
                      disabled={isSaving}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archive
                    </Button>
                    <Button
                      onClick={() => updateDraftStatus(selectedDraft.id, 'MARKED_PUBLISHED')}
                      disabled={isSaving}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Mark as Published'}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
