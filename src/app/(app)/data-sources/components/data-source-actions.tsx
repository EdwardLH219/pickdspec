'use client';

/**
 * Data Source Actions Component
 * 
 * Client-side component for connector actions (upload, run).
 */

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, RefreshCw, Play, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Connector {
  id: string;
  name: string;
  sourceType: string;
  isActive: boolean;
}

interface DataSourceActionsProps {
  connector: Connector;
  isOwner: boolean;
}

interface UploadResult {
  success: boolean;
  message: string;
  run?: {
    reviewsCreated: number;
    reviewsUpdated: number;
    errorCount: number;
  };
  error?: string;
}

export function DataSourceActions({ connector, isOwner }: DataSourceActionsProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleRun() {
    setRunning(true);
    
    try {
      const response = await fetch('/api/ingestion/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId: connector.id,
          runType: 'MANUAL',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Import completed: ${result.message}`);
        window.location.reload();
      } else {
        alert(result.error || 'Import failed');
      }
    } catch (error) {
      console.error('Failed to run:', error);
      alert('Failed to start import');
    } finally {
      setRunning(false);
    }
  }

  function openUploadDialog() {
    setUploadFile(null);
    setUploadResult(null);
    setUploadDialogOpen(true);
  }

  async function handleUpload() {
    if (!uploadFile) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('connectorId', connector.id);

      // Add column mappings based on connector type
      if (connector.sourceType === 'WEBSITE') {
        // Default CSV mappings
        const mappings = {
          content: 'Review',
          reviewDate: 'Date',
          rating: 'Rating',
          authorName: 'Author',
          dateFormat: 'DD/MM/YYYY',
        };
        formData.append('columnMappings', JSON.stringify(mappings));
      }

      const response = await fetch('/api/ingestion/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setUploadResult(result);

      if (result.success) {
        // Refresh after short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadResult({
        success: false,
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={openUploadDialog}
        disabled={!connector.isActive}
      >
        <Upload className="h-4 w-4 mr-1" />
        Upload File
      </Button>

      {isOwner && (
        <Button
          size="sm"
          onClick={handleRun}
          disabled={!connector.isActive || running}
        >
          {running ? (
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          Run Import
        </Button>
      )}

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Review Data</DialogTitle>
            <DialogDescription>
              Upload a file to import reviews into {connector.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">Select File</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".csv,.json,.txt"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {connector.sourceType === 'GOOGLE' 
                  ? 'Upload your Google Takeout export (CSV or JSON)'
                  : 'CSV with columns: Review, Date, Rating, Author'
                }
              </p>
            </div>

            {/* Column mapping hint */}
            {connector.sourceType === 'WEBSITE' && uploadFile && (
              <div className="text-xs p-3 bg-muted rounded">
                <p className="font-medium mb-1">Expected columns:</p>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li><strong>Review</strong> - Review content (required)</li>
                  <li><strong>Date</strong> - Review date DD/MM/YYYY (required)</li>
                  <li><strong>Rating</strong> - Star rating 1-5 (optional)</li>
                  <li><strong>Author</strong> - Reviewer name (optional)</li>
                </ul>
              </div>
            )}

            {uploadResult && (
              <div className={`flex items-start gap-2 p-3 rounded-lg ${
                uploadResult.success 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {uploadResult.success ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    {uploadResult.success ? 'Import Successful' : 'Import Failed'}
                  </p>
                  <p className="text-sm">{uploadResult.message}</p>
                  {uploadResult.run && (
                    <p className="text-sm mt-1">
                      New: {uploadResult.run.reviewsCreated}, 
                      Updated: {uploadResult.run.reviewsUpdated}, 
                      Errors: {uploadResult.run.errorCount}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
