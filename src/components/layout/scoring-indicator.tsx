'use client';

import { useScoringStatusOptional } from '@/contexts/scoring-status-context';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function ScoringIndicator() {
  const scoringStatus = useScoringStatusOptional();

  // Don't render if not in provider or nothing to show
  if (!scoringStatus) return null;
  
  const { state, expandLog } = scoringStatus;
  const { status, isMinimized, lastSyncTime, reviewsProcessed, message } = state;

  // Only show when minimized and either running or recently completed
  const shouldShow = isMinimized && (status === 'running' || status === 'complete' || status === 'error');
  
  if (!shouldShow) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={expandLog}
            className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-muted transition-colors cursor-pointer"
            aria-label="Scoring status"
          >
            <AnimatePresence mode="wait">
              {status === 'running' && (
                <motion.div
                  key="running"
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="h-5 w-5 text-blue-500" />
                </motion.div>
              )}
              
              {status === 'complete' && (
                <motion.div
                  key="complete"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </motion.div>
              )}
              
              {status === 'error' && (
                <motion.div
                  key="error"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </TooltipTrigger>
        
        <TooltipContent side="bottom" align="end" className="max-w-xs">
          <div className="text-xs space-y-1">
            {status === 'running' && (
              <p className="font-medium text-blue-600">Scoring in progress...</p>
            )}
            
            {status === 'complete' && (
              <>
                <p className="font-medium text-green-600">Scoring complete</p>
                <p className="text-muted-foreground">
                  {reviewsProcessed} reviews processed
                </p>
              </>
            )}
            
            {status === 'error' && (
              <>
                <p className="font-medium text-red-600">Scoring failed</p>
                {message && <p className="text-muted-foreground">{message}</p>}
              </>
            )}
            
            {lastSyncTime && (
              <p className="text-muted-foreground text-[10px] pt-1 border-t">
                Last sync: {formatRelativeTime(lastSyncTime)}
              </p>
            )}
            
            <p className="text-muted-foreground text-[10px] italic">
              Click to expand
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
