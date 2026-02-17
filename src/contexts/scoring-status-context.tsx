'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ScoringStatus = 'idle' | 'running' | 'complete' | 'error';

interface ScoringState {
  status: ScoringStatus;
  lastSyncTime: Date | null;
  isMinimized: boolean;
  reviewsProcessed: number;
  message: string;
}

interface ScoringStatusContextType {
  state: ScoringState;
  setStatus: (status: ScoringStatus) => void;
  setMinimized: (minimized: boolean) => void;
  setLastSync: (time: Date) => void;
  setReviewsProcessed: (count: number) => void;
  setMessage: (message: string) => void;
  expandLog: () => void;
}

const ScoringStatusContext = createContext<ScoringStatusContextType | null>(null);

export function ScoringStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScoringState>({
    status: 'idle',
    lastSyncTime: null,
    isMinimized: false,
    reviewsProcessed: 0,
    message: '',
  });

  const setStatus = useCallback((status: ScoringStatus) => {
    setState(prev => ({ ...prev, status }));
  }, []);

  const setMinimized = useCallback((isMinimized: boolean) => {
    setState(prev => ({ ...prev, isMinimized }));
  }, []);

  const setLastSync = useCallback((lastSyncTime: Date) => {
    setState(prev => ({ ...prev, lastSyncTime }));
  }, []);

  const setReviewsProcessed = useCallback((reviewsProcessed: number) => {
    setState(prev => ({ ...prev, reviewsProcessed }));
  }, []);

  const setMessage = useCallback((message: string) => {
    setState(prev => ({ ...prev, message }));
  }, []);

  const expandLog = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: false }));
  }, []);

  return (
    <ScoringStatusContext.Provider
      value={{
        state,
        setStatus,
        setMinimized,
        setLastSync,
        setReviewsProcessed,
        setMessage,
        expandLog,
      }}
    >
      {children}
    </ScoringStatusContext.Provider>
  );
}

export function useScoringStatus() {
  const context = useContext(ScoringStatusContext);
  if (!context) {
    throw new Error('useScoringStatus must be used within a ScoringStatusProvider');
  }
  return context;
}

// Safe hook that returns null if not in provider (for optional usage)
export function useScoringStatusOptional() {
  return useContext(ScoringStatusContext);
}
