'use client';

import { useState, useEffect } from 'react';

interface SyncLog {
  id: string;
  datasetId: string;
  datasetName: string;
  syncType: string;
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  recordsFailed: number;
  startTime: string;
  endTime: string;
  status: string;
  errorMessage: string | null;
  lastRecordDate: string | null;
}

interface LogStats {
  datasetId: string;
  status: string;
  _count: number;
  _sum: {
    recordsProcessed: number | null;
    recordsAdded: number | null;
    recordsUpdated: number | null;
    recordsFailed: number | null;
  };
}

interface NYCDataLogsProps {
  onClose: () => void;
}

export default function NYCDataLogs({ onClose }: NYCDataLogsProps) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [stats, setStats] = useState<LogStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLogs();
  }, [selectedDataset, selectedStatus, limit, offset]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      
      if (selectedDataset) {
        params.append('datasetId', selectedDataset);
      }
      if (selectedStatus) {
        params.append('status', selectedStatus);
      }

      const response = await fetch(`/api/v1/nyc-data/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          throw new Error('Authentication expired. Please refresh the page and log in again.');
        }
        
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to fetch logs`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Invalid response from server');
      }
      
      setLogs(data.data?.logs || []);
      setStats(data.data?.stats || []);
      setTotal(data.data?.total || 0);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Set empty data on error
      setLogs([]);
      setStats([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (start: string, end: string) => {
    const duration = new Date(end).getTime() - new Date(start).getTime();
    if (duration < 60000) {
      return `${Math.round(duration / 1000)}s`;
    } else if (duration < 3600000) {
      return `${Math.round(duration / 60000)}m`;
    } else {
      return `${Math.round(duration / 3600000)}h ${Math.round((duration % 3600000) / 60000)}m`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-900/30 text-green-400 border-green-700';
      case 'partial':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-700';
      case 'failed':
        return 'bg-red-900/30 text-red-400 border-red-700';
      case 'in_progress':
        return 'bg-blue-900/30 text-blue-400 border-blue-700';
      default:
        return 'bg-gray-900/30 text-gray-400 border-gray-700';
    }
  };

  const uniqueDatasets = Array.from(new Set(stats.map(s => s.datasetId)));
  const uniqueStatuses = Array.from(new Set(stats.map(s => s.status)));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(220,16%,22%)] rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[hsl(220,16%,36%)] flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">NYC Data Sync Logs</h2>
          <button
            onClick={onClose}
            className="text-[hsl(218,14%,71%)] hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-[hsl(220,16%,36%)] bg-[hsl(220,16%,25%)]">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-[hsl(218,14%,71%)] mb-1">Dataset</label>
              <select
                value={selectedDataset}
                onChange={(e) => {
                  setSelectedDataset(e.target.value);
                  setOffset(0);
                }}
                className="w-full px-3 py-2 bg-[hsl(220,16%,28%)] border border-[hsl(220,16%,36%)] rounded-md text-white"
              >
                <option value="">All Datasets</option>
                {uniqueDatasets.map(datasetId => (
                  <option key={datasetId} value={datasetId}>{datasetId}</option>
                ))}
              </select>
            </div>
            
            <div className="flex-1">
              <label className="block text-sm font-medium text-[hsl(218,14%,71%)] mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setOffset(0);
                }}
                className="w-full px-3 py-2 bg-[hsl(220,16%,28%)] border border-[hsl(220,16%,36%)] rounded-md text-white"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[hsl(218,14%,71%)] mb-1">Limit</label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="px-3 py-2 bg-[hsl(220,16%,28%)] border border-[hsl(220,16%,36%)] rounded-md text-white"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-[hsl(218,14%,71%)]">Loading logs...</div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-400">Error: {error}</div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg text-[hsl(218,14%,71%)]">No logs found</div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-[hsl(220,16%,36%)]">
                <tr>
                  <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Dataset</th>
                  <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Type</th>
                  <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Status</th>
                  <th className="text-right p-3 font-medium text-[hsl(218,14%,71%)]">Processed</th>
                  <th className="text-right p-3 font-medium text-[hsl(218,14%,71%)]">Added</th>
                  <th className="text-right p-3 font-medium text-[hsl(218,14%,71%)]">Failed</th>
                  <th className="text-right p-3 font-medium text-[hsl(218,14%,71%)]">Duration</th>
                  <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Start Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={log.id} className={index % 2 === 0 ? 'bg-[hsl(220,16%,25%)]' : 'bg-[hsl(220,16%,28%)]'}>
                    <td className="p-3">
                      <div className="text-white font-medium">{log.datasetName}</div>
                      <div className="text-xs text-[hsl(218,14%,71%)]">{log.datasetId}</div>
                    </td>
                    <td className="p-3 text-[hsl(218,14%,71%)]">{log.syncType}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(log.status)}`}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right text-white">{log.recordsProcessed.toLocaleString()}</td>
                    <td className="p-3 text-right text-green-400">{log.recordsAdded.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-400">{log.recordsFailed.toLocaleString()}</td>
                    <td className="p-3 text-right text-[hsl(218,14%,71%)]">
                      {formatDuration(log.startTime, log.endTime)}
                    </td>
                    <td className="p-3 text-[hsl(218,14%,71%)] text-sm">
                      {new Date(log.startTime).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && logs.length > 0 && (
          <div className="p-4 border-t border-[hsl(220,16%,36%)] flex justify-between items-center">
            <div className="text-sm text-[hsl(218,14%,71%)]">
              Showing {offset + 1} - {Math.min(offset + limit, total)} of {total} logs
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 bg-[hsl(229,17%,53%)] text-white rounded-md hover:bg-[hsl(229,17%,45%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1 bg-[hsl(229,17%,53%)] text-white rounded-md hover:bg-[hsl(229,17%,45%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}