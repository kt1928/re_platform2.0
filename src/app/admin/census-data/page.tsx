'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CensusDataStatus {
  available_years: number[];
  state_codes: Record<string, string>;
  data_counts: Record<number, number>;
  last_syncs: Record<number, string | null>;
  total_zip_codes: number;
  api_connection_required: boolean;
  status: string;
}

interface SyncResult {
  datasetType: string;
  year: number;
  geography: string;
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  recordsFailed: number;
  startTime: string;
  endTime: string;
  status: string;
  errorMessage: string | null;
}

interface SyncLog {
  id: string;
  datasetType: string;
  year: number;
  geography: string;
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  recordsFailed: number;
  startTime: string;
  endTime: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export default function CensusDataPage() {
  const [status, setStatus] = useState<CensusDataStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedState, setSelectedState] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (showLogs) {
      fetchSyncLogs();
    }
  }, [showLogs]);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/census-data', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Census data status');
      }

      const data = await response.json();
      setStatus(data.data);
      
      // Set default selected year to most recent with data or latest available
      if (data.data.available_years.length > 0) {
        const yearsWithData = Object.keys(data.data.data_counts).map(Number);
        const defaultYear = yearsWithData.length > 0 
          ? Math.max(...yearsWithData)
          : data.data.available_years[data.data.available_years.length - 1];
        setSelectedYear(defaultYear);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSyncLogs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/census-data?action=get_sync_logs&limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sync logs');
      }

      const data = await response.json();
      setSyncLogs(data.data.logs);
    } catch (err) {
      console.error('Error fetching sync logs:', err);
    }
  };

  const testConnection = async () => {
    setTestingConnection(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/census-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'test_connection' })
      });

      const data = await response.json();
      if (data.success) {
        alert(data.data.message);
      } else {
        alert('Connection test failed: ' + data.error.message);
      }
    } catch (err) {
      alert('Connection test failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSync = async (testMode: boolean = false) => {
    if (!selectedYear) {
      alert('Please select a year');
      return;
    }

    const geography = selectedState || 'all_states';
    const confirmMessage = `Start Census data sync for ${selectedYear}${selectedState ? ` (${status?.state_codes[selectedState]})` : ' (all states)'}?${testMode ? ' (Test mode: limited records)' : ''}`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/census-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'ingest_zip_code_data',
          year: selectedYear,
          state: selectedState || undefined,
          options: testMode ? { maxRecords: 100 } : {}
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Sync failed');
      }

      const data = await response.json();
      setSyncResults(prev => [data.data, ...prev]);
      
      // Refresh status to update counts
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
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
      default:
        return 'bg-gray-900/30 text-gray-400 border-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,16%,22%)] text-[hsl(218,14%,71%)] p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading Census data status...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,16%,22%)] text-[hsl(218,14%,71%)]">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[hsl(193,43%,67%)]">Census Data Integration</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] transition-colors duration-200"
            >
              {showLogs ? 'Hide Logs' : 'View Sync Logs'}
            </button>
            <Link 
              href="/admin"
              className="px-4 py-2 bg-[hsl(229,17%,53%)] text-white rounded-md hover:bg-[hsl(229,17%,45%)] transition-colors duration-200"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-md">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {/* API Connection Status */}
        {status?.api_connection_required && (
          <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700 rounded-md">
            <p className="text-yellow-400">
              <strong>Note:</strong> Census API key not configured. Some features may be limited.
              Add CENSUS_API_KEY to your environment variables for full functionality.
            </p>
          </div>
        )}

        {/* Connection Test */}
        <div className="mb-6 p-4 bg-[hsl(220,16%,28%)] rounded-lg border border-[hsl(193,43%,67%)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[hsl(193,43%,67%)]">API Connection</h3>
            <button
              onClick={testConnection}
              disabled={testingConnection}
              className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {testingConnection ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
          <p className="text-sm text-[hsl(218,14%,71%)] mt-2">
            Test connection to the US Census Bureau API
          </p>
        </div>

        {/* Sync Controls */}
        <div className="mb-6 p-6 bg-[hsl(220,16%,28%)] rounded-lg border border-[hsl(193,43%,67%)]">
          <h3 className="text-lg font-semibold text-[hsl(193,43%,67%)] mb-4">Data Ingestion</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-[hsl(218,14%,71%)] mb-2">Year</label>
              <select
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 bg-[hsl(220,16%,36%)] border border-[hsl(220,16%,45%)] rounded-md text-white"
              >
                <option value="">Select Year</option>
                {status?.available_years.slice(-10).reverse().map(year => (
                  <option key={year} value={year}>
                    {year} {status.data_counts[year] ? `(${status.data_counts[year].toLocaleString()} records)` : '(no data)'}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[hsl(218,14%,71%)] mb-2">
                State (optional - leave empty for all states)
              </label>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full px-3 py-2 bg-[hsl(220,16%,36%)] border border-[hsl(220,16%,45%)] rounded-md text-white"
              >
                <option value="">All States</option>
                {status && Object.entries(status.state_codes).map(([code, name]) => (
                  <option key={code} value={code}>{name} ({code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleSync(true)}
              disabled={syncing || !selectedYear}
              className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {syncing ? 'Syncing...' : 'Test Sync (100 records)'}
            </button>
            <button
              onClick={() => handleSync(false)}
              disabled={syncing || !selectedYear}
              className="px-4 py-2 bg-[hsl(229,17%,53%)] text-white font-medium rounded-md hover:bg-[hsl(229,17%,45%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Full Sync
            </button>
          </div>
        </div>

        {/* Data Overview */}
        <div className="mb-6 bg-[hsl(220,16%,28%)] rounded-lg overflow-hidden">
          <div className="p-6 border-b border-[hsl(220,16%,36%)]">
            <h2 className="text-xl font-semibold text-white mb-2">Data Overview</h2>
            <p className="text-[hsl(218,14%,71%)]">
              Census ZIP Code Tabulation Area (ZCTA) data from the American Community Survey 5-Year estimates
            </p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-medium text-[hsl(218,14%,71%)] mb-2">Total ZIP Codes</h4>
                <div className="text-2xl font-bold text-white">{status?.total_zip_codes.toLocaleString()}</div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-[hsl(218,14%,71%)] mb-2">Available Years</h4>
                <div className="text-2xl font-bold text-white">{status?.available_years.length}</div>
                <div className="text-sm text-[hsl(218,14%,71%)]">
                  {status?.available_years.slice(-5).join(', ')}...
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-[hsl(218,14%,71%)] mb-2">Years with Data</h4>
                <div className="text-2xl font-bold text-white">
                  {status ? Object.keys(status.data_counts).length : 0}
                </div>
                <div className="text-sm text-[hsl(218,14%,71%)]">
                  {status ? Object.keys(status.data_counts).join(', ') : 'None'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Results */}
        {syncResults.length > 0 && (
          <div className="mb-6 space-y-4">
            <h3 className="text-lg font-semibold text-[hsl(193,43%,67%)]">Recent Sync Results</h3>
            {syncResults.map((result, index) => (
              <div key={index} className="p-4 bg-[hsl(193,43%,67%)]/10 border border-[hsl(193,43%,67%)] rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">
                    {result.year} - {result.geography === 'all_states' ? 'All States' : result.geography}
                  </h4>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(result.status)}`}>
                    {result.status.toUpperCase()}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-[hsl(218,14%,71%)]">Processed</div>
                    <div className="text-white font-semibold">{result.recordsProcessed.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[hsl(218,14%,71%)]">Added</div>
                    <div className="text-green-400 font-semibold">{result.recordsAdded.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[hsl(218,14%,71%)]">Failed</div>
                    <div className="text-red-400 font-semibold">{result.recordsFailed.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[hsl(218,14%,71%)]">Duration</div>
                    <div className="text-white font-semibold">
                      {formatDuration(result.startTime, result.endTime)}
                    </div>
                  </div>
                </div>
                
                {result.errorMessage && (
                  <div className="mt-2 text-red-400 text-sm">
                    Error: {result.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sync Logs */}
        {showLogs && (
          <div className="mb-6 bg-[hsl(220,16%,28%)] rounded-lg overflow-hidden">
            <div className="p-6 border-b border-[hsl(220,16%,36%)]">
              <h2 className="text-xl font-semibold text-white mb-2">Sync History</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[hsl(220,16%,36%)]">
                  <tr>
                    <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Year</th>
                    <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Geography</th>
                    <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Status</th>
                    <th className="text-right p-3 font-medium text-[hsl(218,14%,71%)]">Records</th>
                    <th className="text-right p-3 font-medium text-[hsl(218,14%,71%)]">Duration</th>
                    <th className="text-left p-3 font-medium text-[hsl(218,14%,71%)]">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log, index) => (
                    <tr key={log.id} className={index % 2 === 0 ? 'bg-[hsl(220,16%,25%)]' : 'bg-[hsl(220,16%,28%)]'}>
                      <td className="p-3 text-white font-medium">{log.year}</td>
                      <td className="p-3 text-[hsl(218,14%,71%)]">{log.geography}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(log.status)}`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-right text-white">{log.recordsAdded.toLocaleString()}</td>
                      <td className="p-3 text-right text-[hsl(218,14%,71%)]">
                        {formatDuration(log.startTime, log.endTime)}
                      </td>
                      <td className="p-3 text-[hsl(218,14%,71%)] text-sm">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="bg-[hsl(220,16%,28%)] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">About Census Data</h3>
          <div className="space-y-3 text-[hsl(218,14%,71%)]">
            <div>
              <p><strong className="text-white">Data Source:</strong> US Census Bureau American Community Survey (ACS) 5-Year Estimates</p>
              <p><strong className="text-white">Geography:</strong> ZIP Code Tabulation Areas (ZCTAs)</p>
              <p><strong className="text-white">Available Years:</strong> 2009-2019 (ZCTAs discontinued in newer releases)</p>
              <p><strong className="text-white">Update Frequency:</strong> Annual (typically released with 1-2 year lag)</p>
            </div>
            
            <div>
              <p><strong className="text-white">Included Variables:</strong></p>
              <ul className="ml-4 space-y-1 text-sm">
                <li>• Population and demographics by age and sex</li>
                <li>• Household and family income (median and distribution)</li>
                <li>• Employment status (employed, unemployed)</li>
                <li>• Housing tenure (owner vs renter occupied)</li>
                <li>• Housing units by structure type</li>
              </ul>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded">
              <p className="text-sm text-yellow-400"><strong>⚠️ Rate Limiting:</strong> The Census API has strict rate limits for ZIP code data. Test sync is recommended to verify connectivity before full sync.</p>
            </div>
            
            <div className="mt-2 p-3 bg-[hsl(193,43%,67%)]/10 border border-[hsl(193,43%,67%)] rounded">
              <p className="text-sm"><strong>💡 Tip:</strong> Census data is updated annually but doesn't change frequently. Run a full sync when new data becomes available for analysis.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}