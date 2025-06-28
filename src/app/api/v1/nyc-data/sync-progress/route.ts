import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/jwt';

// In-memory store for sync progress (in production, use Redis)
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

class SyncProgressStore {
  private static instance: SyncProgressStore;
  private progressMap = new Map<string, SyncProgress>();
  private listeners = new Map<string, Set<(data: SyncProgress) => void>>();

  static getInstance(): SyncProgressStore {
    if (!SyncProgressStore.instance) {
      SyncProgressStore.instance = new SyncProgressStore();
    }
    return SyncProgressStore.instance;
  }

  updateProgress(sessionId: string, progress: Partial<SyncProgress>): void {
    const existing = this.progressMap.get(sessionId);
    if (existing) {
      const updated = {
        ...existing,
        ...progress,
        lastUpdateTime: new Date(),
        percentage: progress.estimatedTotal ? 
          Math.round((progress.processedRecords || existing.processedRecords) / progress.estimatedTotal * 100) :
          existing.percentage
      };
      
      this.progressMap.set(sessionId, updated);
      
      // Notify all listeners for this session
      const sessionListeners = this.listeners.get(sessionId);
      if (sessionListeners) {
        sessionListeners.forEach(listener => listener(updated));
      }
    }
  }

  getProgress(sessionId: string): SyncProgress | undefined {
    return this.progressMap.get(sessionId);
  }

  createSession(sessionId: string, datasetId: string, datasetName: string): SyncProgress {
    const progress: SyncProgress = {
      sessionId,
      datasetId,
      datasetName,
      status: 'starting',
      estimatedTotal: 0,
      processedRecords: 0,
      currentBatch: 0,
      totalBatches: 0,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      errors: [],
      percentage: 0
    };
    
    this.progressMap.set(sessionId, progress);
    return progress;
  }

  addListener(sessionId: string, callback: (data: SyncProgress) => void): void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(callback);
  }

  removeListener(sessionId: string, callback: (data: SyncProgress) => void): void {
    const sessionListeners = this.listeners.get(sessionId);
    if (sessionListeners) {
      sessionListeners.delete(callback);
      if (sessionListeners.size === 0) {
        this.listeners.delete(sessionId);
      }
    }
  }

  cleanupSession(sessionId: string): void {
    this.progressMap.delete(sessionId);
    this.listeners.delete(sessionId);
  }
}

export const progressStore = SyncProgressStore.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    // Verify authentication - check both header and query param for EventSource compatibility
    let token: string | null = null;
    
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else {
      // Fallback to query parameter for EventSource
      token = searchParams.get('token');
    }
    
    if (!token) {
      return new Response('Unauthorized - token required', { status: 401 });
    }

    const payload = verifyToken(token);
    
    if (!payload) {
      return new Response('Forbidden - invalid token', { status: 403 });
    }

    // Set up SSE headers
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    };

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`));

        // Check if session already exists and send current progress
        const existingProgress = progressStore.getProgress(sessionId);
        if (existingProgress) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'progress', data: existingProgress })}\n\n`));
        }

        // Set up progress listener
        const progressListener = (data: SyncProgress) => {
          try {
            const message = JSON.stringify({ type: 'progress', data });
            controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          } catch (error) {
            console.error('Error sending SSE message:', error);
          }
        };

        progressStore.addListener(sessionId, progressListener);

        // Set up heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`));
          } catch (error) {
            clearInterval(heartbeatInterval);
          }
        }, 30000); // 30 second heartbeat

        // Cleanup on close
        const cleanup = () => {
          clearInterval(heartbeatInterval);
          progressStore.removeListener(sessionId, progressListener);
        };

        // Handle client disconnect
        request.signal.addEventListener('abort', cleanup);
        
        // Store cleanup function for manual cleanup if needed
        (controller as any).cleanup = cleanup;
      },
      
      cancel() {
        // Cleanup when stream is cancelled
        if ((this as any).cleanup) {
          (this as any).cleanup();
        }
      }
    });

    return new Response(stream, { headers });
    
  } catch (error) {
    console.error('SSE endpoint error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Helper endpoint to manually trigger progress updates (for testing)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    
    if (!payload || payload.role !== 'ADMIN') {
      return Response.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { sessionId, action, data } = body;

    if (!sessionId) {
      return Response.json({ success: false, error: 'Session ID required' }, { status: 400 });
    }

    switch (action) {
      case 'create':
        const progress = progressStore.createSession(sessionId, data.datasetId, data.datasetName);
        return Response.json({ success: true, data: progress });

      case 'update':
        progressStore.updateProgress(sessionId, data);
        return Response.json({ success: true });

      case 'complete':
        progressStore.updateProgress(sessionId, { 
          status: 'completed', 
          percentage: 100,
          ...data 
        });
        return Response.json({ success: true });

      case 'error':
        progressStore.updateProgress(sessionId, { 
          status: 'failed', 
          errors: [...(progressStore.getProgress(sessionId)?.errors || []), data.error] 
        });
        return Response.json({ success: true });

      case 'cleanup':
        progressStore.cleanupSession(sessionId);
        return Response.json({ success: true });

      default:
        return Response.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Progress update error:', error);
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}