'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import NYCDataLogs from '@/components/NYCDataLogs';

interface Dataset {
  id: string;
  name: string;
  key: string;
  lastSync: string | null;
  implemented: boolean;
  dbCount?: number;
  nycCount?: number;
  percentageComplete?: number;
  syncStatus?: 'complete' | 'partial' | 'not_synced';
  missingRecords?: number;
}

interface SyncResult {
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

export default function NYCDataPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // Add cache busting and better headers
      const response = await fetch(`/api/v1/nyc-data?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('auth_token');
          throw new Error('Authentication expired. Please log in again.');
        }
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch datasets');
      }

      const data = await response.json();
      if (!data.success || !data.data?.available_datasets) {
        throw new Error('Invalid response format from server');
      }
      
      setDatasets(data.data.available_datasets);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching datasets:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (datasetKey: string, fullSync: boolean = false) => {
    if (!confirm(`Start ${fullSync ? 'full' : 'incremental'} sync for ${datasetKey}?`)) {
      return;
    }

    setSyncing(prev => new Set([...prev, datasetKey]));
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/nyc-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dataset: datasetKey,
          fullSync,
          limit: fullSync ? undefined : 1000 // Limit incremental syncs
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Sync failed');
      }

      const data = await response.json();
      setSyncResults(prev => [data.data, ...prev]);
      
      // Small delay to ensure database has updated, then refresh
      setTimeout(async () => {
        await fetchDatasets();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(prev => {
        const newSet = new Set(prev);
        newSet.delete(datasetKey);
        return newSet;
      });
    }
  };

  const handleMultipleSync = async (fullSync: boolean = false) => {
    const implementedSelected = Array.from(selectedDatasets).filter(key => 
      datasets.find(ds => ds.key === key)?.implemented
    );

    if (implementedSelected.length === 0) {
      alert('Please select at least one implemented dataset to sync');
      return;
    }

    const syncType = fullSync ? 'full' : 'incremental';
    if (!confirm(`Start ${syncType} sync for ${implementedSelected.length} selected datasets?`)) {
      return;
    }

    // Clear previous results
    setSyncResults([]);
    setError(null);

    // Start all syncs simultaneously
    const syncPromises = implementedSelected.map(async (datasetKey) => {
      setSyncing(prev => new Set([...prev, datasetKey]));

      try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/api/v1/nyc-data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            dataset: datasetKey,
            fullSync,
            limit: fullSync ? undefined : 1000
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Sync failed');
        }

        const data = await response.json();
        setSyncResults(prev => [data.data, ...prev]);
        return { success: true, datasetKey, result: data.data };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Sync failed';
        setSyncResults(prev => [{
          datasetId: datasetKey,
          datasetName: datasets.find(ds => ds.key === datasetKey)?.name || datasetKey,
          syncType,
          recordsProcessed: 0,
          recordsAdded: 0,
          recordsUpdated: 0,
          recordsFailed: 0,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          status: 'failed',
          errorMessage: errorMsg,
          lastRecordDate: null
        }, ...prev]);
        return { success: false, datasetKey, error: errorMsg };
      } finally {
        setSyncing(prev => {
          const newSet = new Set(prev);
          newSet.delete(datasetKey);
          return newSet;
        });
      }
    });

    // Wait for all syncs to complete
    const results = await Promise.all(syncPromises);
    
    // Refresh datasets to update last sync times
    await fetchDatasets();

    // Show summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (failed > 0) {
      setError(`${successful} syncs completed successfully, ${failed} failed`);
    }
  };

  const toggleDatasetSelection = (datasetKey: string) => {
    setSelectedDatasets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(datasetKey)) {
        newSet.delete(datasetKey);
      } else {
        newSet.add(datasetKey);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const implementedDatasets = datasets.filter(ds => ds.implemented).map(ds => ds.key);
    
    if (selectedDatasets.size === implementedDatasets.length) {
      // Deselect all
      setSelectedDatasets(new Set());
    } else {
      // Select all implemented
      setSelectedDatasets(new Set(implementedDatasets));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,16%,22%)] text-[hsl(218,14%,71%)] p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading NYC datasets...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,16%,22%)] text-[hsl(218,14%,71%)]">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[hsl(193,43%,67%)]">NYC Open Data Integration</h1>
          <div className="flex gap-3">
            <button
              onClick={fetchDatasets}
              disabled={loading}
              className="px-4 py-2 bg-[hsl(40,71%,73%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(40,71%,66%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
            <button
              onClick={() => setShowLogs(true)}
              className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] transition-colors duration-200"
            >
              View Sync Logs
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

        {/* Multi-Select Controls */}
        {datasets.filter(ds => ds.implemented).length > 0 && (
          <div className="mb-6 p-4 bg-[hsl(220,16%,28%)] rounded-lg border border-[hsl(193,43%,67%)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[hsl(193,43%,67%)]">Bulk Sync Operations</h3>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-[hsl(218,14%,71%)]">
                  <input
                    type="checkbox"
                    checked={selectedDatasets.size === datasets.filter(ds => ds.implemented).length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                  Select All Implemented ({datasets.filter(ds => ds.implemented).length})
                </label>
              </div>
            </div>
            
            {selectedDatasets.size > 0 && (
              <div className="flex gap-3">
                <button
                  onClick={() => handleMultipleSync(false)}
                  disabled={syncing.size > 0}
                  className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Incremental Sync ({selectedDatasets.size})
                </button>
                <button
                  onClick={() => handleMultipleSync(true)}
                  disabled={syncing.size > 0}
                  className="px-4 py-2 bg-[hsl(229,17%,53%)] text-white font-medium rounded-md hover:bg-[hsl(229,17%,45%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  Full Sync ({selectedDatasets.size})
                </button>
                <button
                  onClick={() => setSelectedDatasets(new Set())}
                  className="px-4 py-2 bg-transparent border border-[hsl(229,17%,53%)] text-[hsl(229,17%,53%)] hover:bg-[hsl(229,17%,53%)]/10 rounded-md transition-colors duration-200"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sync Results */}
        {syncResults.length > 0 && (
          <div className="mb-6 space-y-4">
            <h3 className="text-lg font-semibold text-[hsl(193,43%,67%)]">Sync Results</h3>
            {syncResults.map((result, index) => (
              <div key={index} className="p-4 bg-[hsl(193,43%,67%)]/10 border border-[hsl(193,43%,67%)] rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">{result.datasetName}</h4>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    result.status === 'success' ? 'bg-green-900/30 text-green-400 border border-green-700' :
                    result.status === 'partial' ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700' : 
                    'bg-red-900/30 text-red-400 border border-red-700'
                  }`}>
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
                      {Math.round((new Date(result.endTime).getTime() - new Date(result.startTime).getTime()) / 1000)}s
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
            
            <button
              onClick={() => setSyncResults([])}
              className="px-3 py-1 text-sm bg-transparent border border-[hsl(229,17%,53%)] text-[hsl(229,17%,53%)] hover:bg-[hsl(229,17%,53%)]/10 rounded-md transition-colors duration-200"
            >
              Clear Results
            </button>
          </div>
        )}

        {/* Datasets Table */}
        <div className="bg-[hsl(220,16%,28%)] rounded-lg overflow-hidden">
          <div className="p-6 border-b border-[hsl(220,16%,36%)]">
            <h2 className="text-xl font-semibold text-white mb-2">Available Datasets</h2>
            <p className="text-[hsl(218,14%,71%)]">
              NYC Open Data sources available for ingestion. Only implemented datasets can be synced.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[hsl(220,16%,36%)]">
                <tr>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">Select</th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">Dataset</th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">ID</th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">Status</th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">Last Sync</th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset, index) => (
                  <tr key={dataset.id} className={index % 2 === 0 ? 'bg-[hsl(220,16%,25%)]' : 'bg-[hsl(220,16%,28%)]'}>
                    <td className="p-4">
                      {dataset.implemented ? (
                        <input
                          type="checkbox"
                          checked={selectedDatasets.has(dataset.key)}
                          onChange={() => toggleDatasetSelection(dataset.key)}
                          className="rounded"
                        />
                      ) : (
                        <div className="w-4 h-4"></div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-white">{dataset.name}</div>
                        {syncing.has(dataset.key) && (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[hsl(193,43%,67%)] border-t-transparent"></div>
                        )}
                      </div>
                      <div className="text-sm text-[hsl(218,14%,71%)]">Key: {dataset.key}</div>
                    </td>
                    <td className="p-4 text-[hsl(218,14%,71%)] font-mono text-sm">{dataset.id}</td>
                    <td className="p-4">
                      {dataset.implemented ? (
                        <div className="relative group">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium cursor-help ${
                            dataset.syncStatus === 'complete' 
                              ? 'bg-green-900/30 text-green-400 border border-green-700'
                              : dataset.syncStatus === 'partial'
                              ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-700'
                              : 'bg-red-900/30 text-red-400 border border-red-700'
                          }`}>
                            {dataset.syncStatus === 'complete' ? 'Complete' : 
                             dataset.syncStatus === 'partial' ? 'Partial' : 'Not Synced'}
                          </span>
                          
                          {/* Hover tooltip */}
                          <div className="absolute z-10 invisible group-hover:visible bg-[hsl(220,16%,36%)] text-white p-3 rounded-lg shadow-lg -top-2 left-full ml-2 w-64">
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-[hsl(218,14%,71%)]">NYC Records:</span>
                                <span className="font-medium">{(dataset.nycCount || 0).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[hsl(218,14%,71%)]">Our Records:</span>
                                <span className="font-medium">{(dataset.dbCount || 0).toLocaleString()}</span>
                              </div>
                              {dataset.syncStatus === 'partial' && (
                                <div className="flex justify-between text-yellow-400">
                                  <span>Missing:</span>
                                  <span className="font-medium">{(dataset.missingRecords || 0).toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between pt-1 border-t border-[hsl(220,16%,45%)]">
                                <span className="text-[hsl(218,14%,71%)]">Coverage:</span>
                                <span className="font-medium">{dataset.percentageComplete || 0}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-900/30 text-gray-400 border border-gray-700">
                          Not Implemented
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-[hsl(218,14%,71%)]">
                      {dataset.lastSync 
                        ? new Date(dataset.lastSync).toLocaleString()
                        : 'Never'
                      }
                    </td>
                    <td className="p-4">
                      {dataset.implemented ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSync(dataset.key, false)}
                            disabled={syncing.has(dataset.key)}
                            className="px-3 py-1 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] text-sm font-medium rounded-md hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            {syncing.has(dataset.key) ? 'Syncing...' : 'Incremental'}
                          </button>
                          <button
                            onClick={() => handleSync(dataset.key, true)}
                            disabled={syncing.has(dataset.key)}
                            className="px-3 py-1 bg-[hsl(229,17%,53%)] text-white text-sm font-medium rounded-md hover:bg-[hsl(229,17%,45%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            Full Sync
                          </button>
                        </div>
                      ) : (
                        <span className="text-[hsl(218,14%,71%)] text-sm">Not Available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-8 bg-[hsl(220,16%,28%)] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Usage Instructions</h3>
          <div className="space-y-3 text-[hsl(218,14%,71%)]">
            <div>
              <p><strong className="text-white">Improved Large Dataset Handling:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• <strong>5K-10K batch sizes:</strong> Optimized for faster processing (up from 1K)</li>
                <li>• <strong>Progress tracking:</strong> Real-time progress updates with estimated completion</li>
                <li>• <strong>Retry logic:</strong> Automatic retry with exponential backoff for failed requests</li>
                <li>• <strong>Memory efficient:</strong> Streaming mode prevents memory overload on large datasets</li>
              </ul>
            </div>
            
            <div>
              <p><strong className="text-white">Single Dataset Sync:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• <strong>Incremental:</strong> Pulls only new records since the last sync. Recommended for regular updates.</li>
                <li>• <strong>Full Sync:</strong> Pulls all available data from the source. Use for initial import or data refresh.</li>
              </ul>
            </div>
            
            <div>
              <p><strong className="text-white">Bulk Sync Operations:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• Select multiple implemented datasets using checkboxes</li>
                <li>• Use "Select All" to quickly select all available datasets</li>
                <li>• Run incremental or full syncs on multiple datasets simultaneously</li>
                <li>• View individual sync results for each dataset</li>
              </ul>
            </div>
            
            <div>
              <p><strong className="text-white">Available Datasets:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• <strong>NYC Property Sales:</strong> Historical property sale records with prices and details</li>
                <li>• <strong>DOB Permits:</strong> Building permits, renovations, and construction approvals</li>
                <li>• <strong>DOB Violations:</strong> Active building code violations and enforcement actions</li>
              </ul>
            </div>
            
            <div className="mt-4 p-3 bg-[hsl(193,43%,67%)]/10 border border-[hsl(193,43%,67%)] rounded">
              <p className="text-sm"><strong>💡 Tip:</strong> For initial setup, use "Select All" + "Full Sync" to import all available data. For regular updates, use incremental syncs on individual datasets or selected subsets.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Logs Modal */}
      {showLogs && (
        <NYCDataLogs onClose={() => setShowLogs(false)} />
      )}
    </div>
  );
}