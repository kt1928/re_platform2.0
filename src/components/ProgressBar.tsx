'use client';

import { useEffect, useState } from 'react';

export interface ProgressState {
  percentage: number;
  current: number;
  total?: number;
  message?: string;
  stage?: string;
  estimatedTimeRemaining?: string;
  speed?: string;
}

interface ProgressBarProps {
  progress: ProgressState;
  title?: string;
  showDetails?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  onCancel?: () => void;
}

export default function ProgressBar({ 
  progress, 
  title = 'Processing...', 
  showDetails = true,
  variant = 'default',
  onCancel
}: ProgressBarProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  // Animate progress bar smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(progress.percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [progress.percentage]);

  const getProgressColor = () => {
    if (progress.percentage >= 100) return 'bg-green-500';
    if (progress.percentage >= 75) return 'bg-blue-500';
    if (progress.percentage >= 50) return 'bg-yellow-500';
    return 'bg-[hsl(193,43%,67%)]';
  };

  const formatNumber = (num: number) => num.toLocaleString();

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 p-3 bg-[hsl(220,16%,28%)] rounded-lg">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">{title}</span>
            <span className="text-sm text-[hsl(218,14%,71%)]">{Math.round(progress.percentage)}%</span>
          </div>
          <div className="w-full bg-[hsl(220,16%,36%)] rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ease-out ${getProgressColor()}`}
              style={{ width: `${animatedPercentage}%` }}
            />
          </div>
        </div>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="text-red-400 hover:text-red-300 p-1"
            title="Cancel operation"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 bg-[hsl(220,16%,28%)] rounded-lg border border-[hsl(193,43%,67%)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[hsl(193,43%,67%)]">{title}</h3>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold text-white">{Math.round(progress.percentage)}%</span>
          {onCancel && (
            <button 
              onClick={onCancel}
              className="px-3 py-1 bg-red-900/30 text-red-400 border border-red-700 rounded-md hover:bg-red-900/50 transition-colors duration-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="w-full bg-[hsl(220,16%,36%)] rounded-full h-3 overflow-hidden">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ease-out ${getProgressColor()} relative`}
            style={{ width: `${animatedPercentage}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="space-y-3">
          {/* Current Status */}
          {progress.message && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(218,14%,71%)]">Status:</span>
              <span className="text-sm text-white">{progress.message}</span>
            </div>
          )}

          {/* Stage */}
          {progress.stage && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(218,14%,71%)]">Stage:</span>
              <span className="text-sm text-white">{progress.stage}</span>
            </div>
          )}

          {/* Records Progress */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-[hsl(218,14%,71%)]">Progress:</span>
            <span className="text-sm text-white">
              {formatNumber(progress.current)}
              {progress.total && ` / ${formatNumber(progress.total)}`}
              {!progress.total && ' records'}
            </span>
          </div>

          {/* Time Remaining */}
          {progress.estimatedTimeRemaining && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(218,14%,71%)]">Time Remaining:</span>
              <span className="text-sm text-white">{progress.estimatedTimeRemaining}</span>
            </div>
          )}

          {/* Processing Speed */}
          {progress.speed && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(218,14%,71%)]">Speed:</span>
              <span className="text-sm text-white">{progress.speed}</span>
            </div>
          )}
        </div>
      )}

      {/* Completion Status */}
      {progress.percentage >= 100 && (
        <div className="mt-4 p-3 bg-green-900/30 border border-green-700 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span className="text-green-400 font-medium">Operation completed successfully!</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for managing progress state
export function useProgress(initialState?: Partial<ProgressState>) {
  const [progress, setProgress] = useState<ProgressState>({
    percentage: 0,
    current: 0,
    total: undefined,
    message: undefined,
    stage: undefined,
    estimatedTimeRemaining: undefined,
    speed: undefined,
    ...initialState
  });

  const updateProgress = (update: Partial<ProgressState>) => {
    setProgress(prev => ({
      ...prev,
      ...update,
      // Auto-calculate percentage if current and total are provided
      percentage: update.current !== undefined && update.total !== undefined
        ? Math.round((update.current / update.total) * 100)
        : update.percentage ?? prev.percentage
    }));
  };

  const resetProgress = () => {
    setProgress({
      percentage: 0,
      current: 0,
      total: undefined,
      message: undefined,
      stage: undefined,
      estimatedTimeRemaining: undefined,
      speed: undefined
    });
  };

  return { progress, updateProgress, resetProgress };
}