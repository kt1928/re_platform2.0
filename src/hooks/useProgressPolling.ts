'use client';

import { useEffect, useRef, useState } from 'react';
import { ProgressState } from '@/components/ProgressBar';

interface ProgressPollingOptions {
  endpoint: string;
  interval?: number;
  maxRetries?: number;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

interface ProgressResponse {
  success: boolean;
  data: {
    progress: ProgressState;
    completed: boolean;
    result?: any;
  };
  error?: {
    message: string;
  };
}

export function useProgressPolling({
  endpoint,
  interval = 1000,
  maxRetries = 3,
  onComplete,
  onError,
  enabled = true
}: ProgressPollingOptions) {
  const [progress, setProgress] = useState<ProgressState>({
    percentage: 0,
    current: 0
  });
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  };

  const startPolling = () => {
    if (!enabled || isPolling) return;
    
    setIsPolling(true);
    setError(null);
    retryCountRef.current = 0;

    const poll = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: ProgressResponse = await response.json();
        
        if (!data.success) {
          throw new Error(data.error?.message || 'Unknown error');
        }

        // Update progress
        setProgress(data.data.progress);
        retryCountRef.current = 0; // Reset retry counter on success

        // Check if completed
        if (data.data.completed || data.data.progress.percentage >= 100) {
          stopPolling();
          onComplete?.(data.data.result);
        }

      } catch (err) {
        retryCountRef.current++;
        
        if (retryCountRef.current >= maxRetries) {
          stopPolling();
          const error = err instanceof Error ? err : new Error('Unknown error');
          setError(error.message);
          onError?.(error);
        }
        // If under max retries, continue polling
      }
    };

    // Initial poll
    poll();
    
    // Set up interval
    intervalRef.current = setInterval(poll, interval);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Auto-start when enabled changes
  useEffect(() => {
    if (enabled && !isPolling) {
      startPolling();
    } else if (!enabled && isPolling) {
      stopPolling();
    }
  }, [enabled]);

  return {
    progress,
    isPolling,
    error,
    startPolling,
    stopPolling
  };
}

// Enhanced hook that estimates completion time
export function useProgressWithEstimates(options: ProgressPollingOptions) {
  const { progress, isPolling, error, startPolling, stopPolling } = useProgressPolling(options);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [progressHistory, setProgressHistory] = useState<Array<{ time: Date; progress: number }>>([]);

  // Track start time
  useEffect(() => {
    if (isPolling && !startTime) {
      setStartTime(new Date());
      setProgressHistory([]);
    } else if (!isPolling) {
      setStartTime(null);
    }
  }, [isPolling]);

  // Track progress history for speed calculation
  useEffect(() => {
    if (isPolling && progress.percentage > 0) {
      setProgressHistory(prev => {
        const newEntry = { time: new Date(), progress: progress.percentage };
        // Keep only last 10 entries for calculation
        return [...prev.slice(-9), newEntry];
      });
    }
  }, [progress.percentage, isPolling]);

  // Calculate estimates
  const estimates = (() => {
    if (!startTime || progressHistory.length < 2) {
      return {
        estimatedTimeRemaining: undefined,
        speed: undefined
      };
    }

    const now = new Date();
    const elapsedMs = now.getTime() - startTime.getTime();
    const elapsedSeconds = elapsedMs / 1000;

    // Calculate speed (progress per second)
    const recentHistory = progressHistory.slice(-5); // Last 5 data points
    if (recentHistory.length >= 2) {
      const firstPoint = recentHistory[0];
      const lastPoint = recentHistory[recentHistory.length - 1];
      const timeDiff = (lastPoint.time.getTime() - firstPoint.time.getTime()) / 1000;
      const progressDiff = lastPoint.progress - firstPoint.progress;
      
      if (timeDiff > 0 && progressDiff > 0) {
        const progressPerSecond = progressDiff / timeDiff;
        const remainingProgress = 100 - progress.percentage;
        const estimatedSecondsRemaining = remainingProgress / progressPerSecond;

        // Format time remaining
        let timeRemaining = '';
        if (estimatedSecondsRemaining < 60) {
          timeRemaining = `${Math.round(estimatedSecondsRemaining)}s`;
        } else if (estimatedSecondsRemaining < 3600) {
          const minutes = Math.round(estimatedSecondsRemaining / 60);
          timeRemaining = `${minutes}m`;
        } else {
          const hours = Math.floor(estimatedSecondsRemaining / 3600);
          const minutes = Math.round((estimatedSecondsRemaining % 3600) / 60);
          timeRemaining = `${hours}h ${minutes}m`;
        }

        // Format speed
        let speed = '';
        if (progress.current && progress.total) {
          const recordsPerSecond = (progress.current / elapsedSeconds);
          if (recordsPerSecond >= 1) {
            speed = `${Math.round(recordsPerSecond)} records/sec`;
          } else {
            speed = `${Math.round(recordsPerSecond * 60)} records/min`;
          }
        }

        return {
          estimatedTimeRemaining: timeRemaining,
          speed
        };
      }
    }

    return {
      estimatedTimeRemaining: undefined,
      speed: undefined
    };
  })();

  const enhancedProgress: ProgressState = {
    ...progress,
    ...estimates
  };

  return {
    progress: enhancedProgress,
    isPolling,
    error,
    startPolling,
    stopPolling
  };
}