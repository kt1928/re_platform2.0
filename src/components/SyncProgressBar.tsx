'use client';

import { useState, useEffect, useRef } from 'react';

interface SyncProgress {
  sessionId: string;
  datasetId: string;
  datasetName: string;
  status: 'starting' | 'fetching' | 'processing' | 'completed' | 'failed';
  estimatedTotal: number;
  processedRecords: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  lastUpdateTime: Date;
  errors: string[];
  percentage: number;
}

interface SyncProgressBarProps {
  sessionId: string;
  datasetId: string;
  datasetName: string;
  isActive: boolean;
  onComplete?: (success: boolean) => void;
  onCancel?: () => void;
}

export default function SyncProgressBar({ 
  sessionId, 
  datasetName, 
  isActive, 
  onComplete, 
  onCancel 
}: SyncProgressBarProps) {
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isActive) {
      // Cleanup when not active
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setProgress(null);
      setConnected(false);
      return;
    }

    // Set up SSE connection
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('No authentication token found');
      return;
    }

    const eventSource = new EventSource(
      `/api/v1/nyc-data/sync-progress?sessionId=${sessionId}&token=${encodeURIComponent(token)}`
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('SSE connected for session:', data.sessionId);
            break;
            
          case 'progress':
            setProgress(data.data);
            break;
            
          case 'heartbeat':
            // Keep connection alive
            break;
            
          default:
            console.log('Unknown SSE message type:', data.type);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (event) => {
      console.error('SSE error:', event);
      setConnected(false);
      setError('Connection lost. Attempting to reconnect...');
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (isActive && !eventSource.readyState) {
          eventSource.close();
          // The effect will run again and create a new connection
        }
      }, 3000);
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId, isActive]);

  // Handle completion/failure
  useEffect(() => {
    if (progress) {
      if (progress.status === 'completed') {
        console.log('Sync completed, calling onComplete in 2 seconds...');
        setTimeout(() => {
          console.log('Calling onComplete(true)');
          onComplete?.(true);
        }, 2000); // Give user time to see the completion message
      } else if (progress.status === 'failed') {
        console.log('Sync failed, calling onComplete in 2 seconds...');
        setTimeout(() => {
          console.log('Calling onComplete(false)');
          onComplete?.(false);
        }, 2000);
      }
    }
  }, [progress, onComplete]);

  const formatRecords = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatTimeRemaining = (startTime: Date, processed: number, total: number) => {
    if (processed === 0 || total === 0) return 'Calculating...';
    
    const elapsed = Date.now() - new Date(startTime).getTime();
    const rate = processed / elapsed; // records per ms
    const remaining = (total - processed) / rate;
    
    const seconds = Math.round(remaining / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const getStatusDisplay = () => {
    if (!connected) return 'Connecting...';
    if (!progress) return 'Starting...';
    
    switch (progress.status) {
      case 'starting': return 'Initializing sync...';
      case 'fetching': return 'Fetching data from NYC Open Data...';
      case 'processing': return 'Processing and storing records...';
      case 'completed': return '✅ Sync completed successfully!';
      case 'failed': return '❌ Sync failed';
      default: return 'Syncing...';
    }
  };

  const getStatusColor = () => {
    if (!connected) return 'text-yellow-400';
    if (!progress) return 'text-blue-400';
    
    switch (progress.status) {
      case 'starting': case 'fetching': case 'processing': return 'text-blue-400';
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      default: return 'text-blue-400';
    }
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(220,16%,28%)] rounded-lg shadow-xl w-full max-w-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Syncing {datasetName}</h3>
            <p className={`text-sm ${getStatusColor()}`}>{getStatusDisplay()}</p>
          </div>
          {progress?.status === 'processing' && onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1 text-sm bg-red-700 text-white rounded hover:bg-red-600 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress Bar */}
        {progress && progress.estimatedTotal > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-[hsl(218,14%,71%)] mb-2">
              <span>{formatRecords(progress.processedRecords)} / {formatRecords(progress.estimatedTotal)} records</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="w-full bg-[hsl(220,16%,36%)] rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-[hsl(193,43%,67%)] to-[hsl(193,43%,77%)] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(progress.percentage, 100)}%` }}
              >
                {/* Animated shimmer effect */}
                <div className="h-full w-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Info */}
        {progress && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[hsl(218,14%,71%)]">Batch:</span>
              <span className="text-white ml-2">
                {progress.currentBatch} / {progress.totalBatches || '?'}
              </span>
            </div>
            <div>
              <span className="text-[hsl(218,14%,71%)]">Time Remaining:</span>
              <span className="text-white ml-2">
                {progress.estimatedTotal > 0 && progress.processedRecords > 0 ? 
                  formatTimeRemaining(progress.startTime, progress.processedRecords, progress.estimatedTotal) : 
                  'Calculating...'
                }
              </span>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Progress Errors */}
        {progress?.errors && progress.errors.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
            <p className="text-yellow-400 text-sm font-medium mb-1">Warnings:</p>
            {progress.errors.slice(-3).map((err, idx) => (
              <p key={idx} className="text-yellow-300 text-xs">{err}</p>
            ))}
            {progress.errors.length > 3 && (
              <p className="text-yellow-400 text-xs mt-1">... and {progress.errors.length - 3} more</p>
            )}
          </div>
        )}

        {/* Loading Spinner for initial states */}
        {(!progress || progress.status === 'starting') && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-[hsl(193,43%,67%)] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-[hsl(218,14%,71%)]">
                {!connected ? 'Connecting to sync service...' : 'Preparing sync...'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}