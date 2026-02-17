'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Loader2, CheckCircle2, AlertCircle, Terminal, Minimize2 } from 'lucide-react';
import { ScoringResultsModal } from './scoring-results-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useScoringStatusOptional } from '@/contexts/scoring-status-context';

interface RunScoringButtonProps {
  tenantId: string;
  tenantName: string;
}

interface ScoringResults {
  reviewsProcessed: number;
  themesProcessed: number;
  themesExtracted: number;
  durationMs: number;
}

interface LogEntry {
  type: string;
  message: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export function RunScoringButton({ tenantId }: RunScoringButtonProps) {
  const scoringContext = useScoringStatusOptional();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scoringResults, setScoringResults] = useState<ScoringResults | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showLiveLog, setShowLiveLog] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(0);

  // Sync with context for expand/minimize
  useEffect(() => {
    if (scoringContext && !scoringContext.state.isMinimized && scoringContext.state.status !== 'idle') {
      // Context says expand - only if we have logs
      if (logs.length > 0 || isRunning) {
        setShowLiveLog(true);
      }
    }
  }, [scoringContext?.state.isMinimized, scoringContext?.state.status, logs.length, isRunning]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRunScoringWithLiveLog = async () => {
    setIsRunning(true);
    setResult(null);
    setScoringResults(null);
    setLogs([]);
    setShowLiveLog(true);
    startTimeRef.current = Date.now();

    // Update context
    scoringContext?.setStatus('running');
    scoringContext?.setMinimized(false);

    try {
      const response = await fetch('/api/portal/score/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start scoring');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setLogs(prev => [...prev, { 
                type: data.type, 
                message: data.message, 
                timestamp: new Date(),
                data 
              }]);

              if (data.type === 'complete' && data.results) {
                const durationMs = Date.now() - startTimeRef.current;
                setResult({
                  success: true,
                  message: `Processed ${data.results.reviewsProcessed} reviews`,
                });
                setScoringResults({
                  reviewsProcessed: data.results.reviewsProcessed,
                  themesProcessed: data.results.themesProcessed,
                  themesExtracted: data.results.themesExtracted,
                  durationMs,
                });
                // Update context
                scoringContext?.setStatus('complete');
                scoringContext?.setLastSync(new Date());
                scoringContext?.setReviewsProcessed(data.results.reviewsProcessed);
              }

              if (data.type === 'error') {
                setResult({ success: false, message: data.message });
                scoringContext?.setStatus('error');
                scoringContext?.setMessage(data.message);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      setResult({
        success: false,
        message: errorMsg,
      });
      setLogs(prev => [...prev, { 
        type: 'error', 
        message: `❌ ${errorMsg}`,
        timestamp: new Date()
      }]);
      // Update context
      scoringContext?.setStatus('error');
      scoringContext?.setMessage(errorMsg);
    } finally {
      setIsRunning(false);
    }
  };

  const handleMinimize = () => {
    setShowLiveLog(false);
    scoringContext?.setMinimized(true);
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'start':
      case 'phase':
        return 'text-blue-400';
      case 'complete':
      case 'phase_complete':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'calculation':
      case 'theme_score':
        return 'text-yellow-300';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Button
          onClick={handleRunScoringWithLiveLog}
          disabled={isRunning}
          variant="default"
          size="sm"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Scoring
            </>
          )}
        </Button>
        
        {result && !showLiveLog && (
          <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
            {result.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span>{result.message}</span>
          </div>
        )}
        
        {result?.success && !showLiveLog && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowModal(true)}
            className="text-muted-foreground"
          >
            View Formula Details
          </Button>
        )}
      </div>

      {/* Live Log Modal */}
      <Dialog open={showLiveLog} onOpenChange={(open) => {
        if (!open && isRunning) {
          // If closing while running, minimize instead
          handleMinimize();
        } else if (!open) {
          setShowLiveLog(false);
          scoringContext?.setMinimized(false);
          scoringContext?.setStatus('idle');
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 bg-zinc-950 border-zinc-800">
          <DialogHeader className="px-4 py-3 border-b border-zinc-800 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-mono text-zinc-300 flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              Live Scoring Log
              {isRunning && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
            </DialogTitle>
            {isRunning && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMinimize}
                className="h-7 w-7 p-0 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                title="Minimize to header"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            )}
          </DialogHeader>
          
          <div className="h-80 overflow-y-auto font-mono text-xs p-4 space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={`${getLogColor(log.type)} leading-relaxed`}>
                <span className="text-zinc-600 mr-2">
                  {log.timestamp.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                {log.message}
              </div>
            ))}
            {logs.length === 0 && isRunning && (
              <div className="text-zinc-500">Connecting to scoring pipeline...</div>
            )}
            <div ref={logEndRef} />
          </div>
          
          {result && (
            <div className="border-t border-zinc-800 p-3 flex items-center justify-between bg-zinc-900/50">
              {result.success ? (
                <>
                  <span className="text-xs text-green-400">
                    ✅ Complete in {((scoringResults?.durationMs ?? 0) / 1000).toFixed(1)}s
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowLiveLog(false); setShowModal(true); }}
                    className="h-7 text-xs"
                  >
                    View Formula Breakdown
                  </Button>
                </>
              ) : (
                <span className="text-xs text-red-400">{result.message}</span>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScoringResultsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        results={scoringResults}
      />
    </>
  );
}
