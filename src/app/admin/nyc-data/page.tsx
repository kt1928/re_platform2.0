'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import DatasetDiscoveryModal from '@/components/DatasetDiscoveryModal';
import SyncProgressBar from '@/components/SyncProgressBar';

interface DatasetFreshness {
  datasetId: string;
  datasetName: string;
  nycLastModified: string | null;
  nycRecordCount: number | null;
  ourLastSync: string | null;
  ourRecordCount: number | null;
  freshnessScore: number;
  isStale: boolean;
  staleSince: string | null;
  recommendSync: boolean;
  syncSuccessRate: number | null;
  priority: number;
}

interface FreshnessSummary {
  total: number;
  stale: number;
  needSync: number;
  avgFreshness: number;
}

interface FreshnessData {
  datasets: DatasetFreshness[];
  summary: FreshnessSummary;
}

// NYC Open Data portal URLs for each dataset (corrected URLs)
const NYC_OPEN_DATA_URLS: Record<string, string> = {
  'usep-8jbt': 'https://data.cityofnewyork.us/City-Government/Citywide-Rolling-Calendar-Sales/usep-8jbt',
  'w9ak-ipjd': 'https://data.cityofnewyork.us/Housing-Development/DOB-Job-Application-Filings/w9ak-ipjd',
  'wvxf-dwi5': 'https://data.cityofnewyork.us/Housing-Development/Housing-Maintenance-Code-Violations/wvxf-dwi5',
  'qgea-i56i': 'https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date/qgea-i56i',
  'dq6g-a4sc': 'https://data.cityofnewyork.us/Housing-Development/DOB-NOW-All-Approved-Permits/dq6g-a4sc',
  '9rz4-mjek': 'https://data.cityofnewyork.us/City-Government/Tax-Debt-Water-Debt/9rz4-mjek',
  'w7w3-xahh': 'https://data.cityofnewyork.us/Business/Legally-Operating-Businesses/w7w3-xahh',
  '3h2n-5cm9': 'https://data.cityofnewyork.us/Housing-Development/DOB-Violations/3h2n-5cm9',
  'tg4x-b46p': 'https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tg4x-b46p',
  'w9ak-ipjd': 'https://data.cityofnewyork.us/Housing-Development/DOB-Job-Application-Filings/w9ak-ipjd',
  '43nn-pn8j': 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j'
};

export default function NYCDataMaintenancePage() {
  const [freshnessData, setFreshnessData] = useState<FreshnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [syncing, setSyncing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [activeSyncSession, setActiveSyncSession] = useState<{
    sessionId: string;
    datasetId: string;
    datasetName: string;
  } | null>(null);

  useEffect(() => {
    fetchFreshnessData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchFreshnessData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchFreshnessData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await fetch('/api/v1/nyc-data/freshness?action=status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch freshness data');
      }

      const data = await response.json();
      if (data.success) {
        setFreshnessData(data.data);
        setLastCheck(new Date());
        setError(null);
      } else {
        throw new Error(data.error?.message || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching freshness data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const runFreshnessCheck = async (datasetId?: string) => {
    setChecking(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/nyc-data/freshness?action=check' + (datasetId ? `&dataset=${datasetId}` : ''), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to run freshness check');
      }

      const data = await response.json();
      if (data.success) {
        // Refresh data after check
        await fetchFreshnessData();
      } else {
        throw new Error(data.error?.message || 'Freshness check failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Freshness check failed');
    } finally {
      setChecking(false);
    }
  };

  const triggerSync = async (datasetKey: string, fullSync: boolean = false) => {
    // Find the dataset name for the progress display
    const datasetInfo = freshnessData?.datasets.find(d => 
      getDatasetKey(d.datasetId) === datasetKey
    );
    
    if (!datasetInfo) {
      setError('Dataset not found');
      return;
    }
    
    if (!confirm(`Start ${fullSync ? 'full' : 'incremental'} sync for ${datasetInfo.datasetName}?`)) {
      return;
    }

    // Generate session ID for progress tracking
    const sessionId = uuidv4();
    
    // Set up progress tracking
    setActiveSyncSession({
      sessionId,
      datasetId: datasetInfo.datasetId,
      datasetName: datasetInfo.datasetName
    });
    
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
          memoryOptimized: true,
          sessionId // Pass session ID for progress tracking
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Sync failed');
      }

      // Progress bar will handle completion and refresh

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setActiveSyncSession(null);
      setSyncing(prev => {
        const newSet = new Set(prev);
        newSet.delete(datasetKey);
        return newSet;
      });
    }
  };
  
  const handleSyncComplete = (success: boolean) => {
    if (activeSyncSession) {
      const datasetKey = getDatasetKey(activeSyncSession.datasetId);
      setSyncing(prev => {
        const newSet = new Set(prev);
        newSet.delete(datasetKey);
        return newSet;
      });
    }
    
    setActiveSyncSession(null);
    
    if (success) {
      // Refresh freshness data after successful sync
      setTimeout(() => {
        fetchFreshnessData();
      }, 1000);
    }
  };
  
  const handleSyncCancel = () => {
    // TODO: Implement actual sync cancellation
    if (activeSyncSession) {
      const datasetKey = getDatasetKey(activeSyncSession.datasetId);
      setSyncing(prev => {
        const newSet = new Set(prev);
        newSet.delete(datasetKey);
        return newSet;
      });
    }
    setActiveSyncSession(null);
  };

  const getFreshnessColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getFreshnessBadge = (score: number, isStale: boolean) => {
    if (isStale) {
      return 'bg-red-900/30 text-red-400 border border-red-700';
    }
    if (score >= 90) return 'bg-green-900/30 text-green-400 border border-green-700';
    if (score >= 70) return 'bg-yellow-900/30 text-yellow-400 border border-yellow-700';
    if (score >= 30) return 'bg-orange-900/30 text-orange-400 border border-orange-700';
    return 'bg-red-900/30 text-red-400 border border-red-700';
  };

  const calculateDaysBehind = (nycLastModified: string | null, ourLastSync: string | null) => {
    if (!nycLastModified || !ourLastSync) return null;
    
    const nycDate = new Date(nycLastModified);
    const ourDate = new Date(ourLastSync);
    const diffMs = nycDate.getTime() - ourDate.getTime();
    const daysBehind = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    return Math.max(0, daysBehind);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatDaysAgo = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const getDatasetKey = (datasetId: string): string => {
    const keyMap: Record<string, string> = {
      'usep-8jbt': 'property_sales',
      'w9ak-ipjd': 'build_job_filings',
      'wvxf-dwi5': 'housing_maintenance_violations',
      'qgea-i56i': 'complaint_data',
      'dq6g-a4sc': 'dob_permits',
      '9rz4-mjek': 'tax_debt_data',
      'w7w3-xahh': 'business_licenses',
      '3h2n-5cm9': 'dob_violations',
      'tg4x-b46p': 'event_permits',
      'w9ak-ipjd': 'build_job_filings',
      '43nn-pn8j': 'restaurant_inspections'
    };
    return keyMap[datasetId] || datasetId;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(220,16%,22%)] text-[hsl(218,14%,71%)] p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading data freshness monitoring...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(220,16%,22%)] text-[hsl(218,14%,71%)]">
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[hsl(193,43%,67%)]">NYC Data Maintenance Dashboard</h1>
            <p className="text-[hsl(218,14%,71%)] mt-1">Monitor and maintain freshness of NYC Open Data sources</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDiscoveryModal(true)}
              className="px-4 py-2 bg-green-700 text-white font-medium rounded-md hover:bg-green-600 transition-colors duration-200"
            >
              + Discover Datasets
            </button>
            <button
              onClick={() => runFreshnessCheck()}
              disabled={checking}
              className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              {checking ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[hsl(220,16%,22%)] border-t-transparent rounded-full animate-spin"></div>
                  Checking...
                </span>
              ) : (
                'Check All Freshness'
              )}
            </button>
            <Link 
              href="/admin"
              className="px-4 py-2 bg-[hsl(229,17%,53%)] text-white rounded-md hover:bg-[hsl(229,17%,45%)] transition-colors duration-200"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>

        {/* Enhanced Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-400 font-medium">🚨 Error: {error}</p>
                {error.includes('Failed to fetch') && (
                  <p className="text-red-300 text-sm mt-1">
                    This may be due to NYC Open Data API issues. Try again in a few moments.
                  </p>
                )}
                {error.includes('Rate limit') && (
                  <p className="text-red-300 text-sm mt-1">
                    Rate limit exceeded. Please wait before trying again or consider adding an API token.
                  </p>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                × Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Freshness Summary */}
        {freshnessData && (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[hsl(220,16%,28%)] p-6 rounded-lg border border-[hsl(193,43%,67%)]/30">
              <div className="text-2xl font-bold text-white">{freshnessData.summary.total}</div>
              <div className="text-[hsl(218,14%,71%)]">Total Datasets</div>
            </div>
            <div className="bg-[hsl(220,16%,28%)] p-6 rounded-lg border border-red-700/30">
              <div className="text-2xl font-bold text-red-400">{freshnessData.summary.stale}</div>
              <div className="text-[hsl(218,14%,71%)]">Stale Datasets</div>
            </div>
            <div className="bg-[hsl(220,16%,28%)] p-6 rounded-lg border border-yellow-700/30">
              <div className="text-2xl font-bold text-yellow-400">{freshnessData.summary.needSync}</div>
              <div className="text-[hsl(218,14%,71%)]">Need Sync</div>
            </div>
            <div className="bg-[hsl(220,16%,28%)] p-6 rounded-lg border border-green-700/30">
              <div className={`text-2xl font-bold ${getFreshnessColor(freshnessData.summary.avgFreshness)}`}>
                {freshnessData.summary.avgFreshness}%
              </div>
              <div className="text-[hsl(218,14%,71%)]">Avg Freshness</div>
            </div>
          </div>
        )}

        {/* Enhanced Status Info */}
        {lastCheck && (
          <div className="mb-6 p-4 bg-[hsl(193,43%,67%)]/10 border border-[hsl(193,43%,67%)]/30 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[hsl(193,43%,67%)]">
                  <strong>ℹ️ Last freshness check:</strong> {lastCheck.toLocaleString()}
                </p>
                <p className="text-xs text-[hsl(218,14%,71%)] mt-1">
                  Freshness scores are now calculated purely based on time difference, not record counts.
                </p>
              </div>
              {checking && (
                <div className="flex items-center gap-2 text-[hsl(193,43%,67%)]">
                  <div className="w-4 h-4 border-2 border-[hsl(193,43%,67%)] border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Checking freshness...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Datasets Table */}
        <div className="bg-[hsl(220,16%,28%)] rounded-lg overflow-hidden">
          <div className="p-6 border-b border-[hsl(220,16%,36%)]">
            <h2 className="text-xl font-semibold text-white mb-2">Dataset Freshness Status</h2>
            <p className="text-[hsl(218,14%,71%)]">
              Monitor how current our data is compared to NYC Open Data sources. 
              <strong>Freshness is now calculated purely based on time difference</strong> - 
              record count differences indicate data quality filtering, not staleness.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[hsl(220,16%,36%)]">
                <tr>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">
                    Dataset
                    <div className="text-xs font-normal text-[hsl(218,14%,65%)] mt-1">Name & Database Info</div>
                  </th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">
                    Freshness
                    <div className="text-xs font-normal text-[hsl(218,14%,65%)] mt-1">Days Behind NYC</div>
                  </th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">
                    Records
                    <div className="text-xs font-normal text-[hsl(218,14%,65%)] mt-1">Our DB vs NYC Raw</div>
                  </th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">
                    Last Sync
                    <div className="text-xs font-normal text-[hsl(218,14%,65%)] mt-1">Our Database</div>
                  </th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">
                    NYC Updated
                    <div className="text-xs font-normal text-[hsl(218,14%,65%)] mt-1">Source Data</div>
                  </th>
                  <th className="text-left p-4 font-medium text-[hsl(218,14%,71%)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {freshnessData?.datasets.map((dataset, index) => (
                  <tr key={dataset.datasetId} className={index % 2 === 0 ? 'bg-[hsl(220,16%,25%)]' : 'bg-[hsl(220,16%,28%)]'}>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {NYC_OPEN_DATA_URLS[dataset.datasetId] ? (
                          <a
                            href={NYC_OPEN_DATA_URLS[dataset.datasetId]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[hsl(193,43%,67%)] hover:text-[hsl(193,43%,80%)] transition-colors duration-200"
                          >
                            {dataset.datasetName}
                          </a>
                        ) : (
                          <div className="font-medium text-white">{dataset.datasetName}</div>
                        )}
                        {dataset.priority > 80 && (
                          <span className="px-2 py-1 text-xs bg-orange-900/30 text-orange-400 border border-orange-700 rounded">
                            HIGH PRIORITY
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[hsl(218,14%,71%)]">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs bg-[hsl(220,16%,36%)] text-[hsl(193,43%,67%)] rounded font-mono">
                            {dataset.datasetId}
                          </span>
                        </div>
                        {/* Removed unnecessary dataset key sublabel */}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFreshnessBadge(dataset.freshnessScore, dataset.isStale)}`}>
                          {dataset.isStale ? 'STALE' : `${dataset.freshnessScore}%`}
                        </span>
                        {dataset.recommendSync && (
                          <span className="px-2 py-1 text-xs bg-blue-900/30 text-blue-400 border border-blue-700 rounded">
                            SYNC NEEDED
                          </span>
                        )}
                      </div>
                      {/* Enhanced temporal freshness display */}
                      <div className="text-xs mt-1">
                        {(() => {
                          const daysBehind = calculateDaysBehind(dataset.nycLastModified, dataset.ourLastSync);
                          if (daysBehind === null) {
                            return <span className="text-[hsl(218,14%,71%)]">Unable to compare dates</span>;
                          } else if (daysBehind === 0) {
                            return <span className="text-green-400">✅ Up to date</span>;
                          } else if (daysBehind === 1) {
                            return <span className="text-yellow-400">⚠️ 1 day behind</span>;
                          } else if (daysBehind <= 7) {
                            return <span className="text-orange-400">⚠️ {daysBehind} days behind</span>;
                          } else {
                            return <span className="text-red-400">🚨 {daysBehind} days behind</span>;
                          }
                        })()} 
                      </div>
                      {dataset.staleSince && (
                        <div className="text-xs text-red-400 mt-1">
                          Stale since {formatDaysAgo(dataset.staleSince)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-white font-medium">
                          Our DB: {(dataset.ourRecordCount || 0).toLocaleString()}
                        </div>
                        <div className="text-[hsl(218,14%,71%)]">
                          {dataset.nycRecordCount ? (
                            <span>
                              NYC: {dataset.nycRecordCount.toLocaleString()}
                              {/* Add estimation indicator based on how data was fetched */}
                              <span className="ml-1 text-xs opacity-75">(?)</span>
                            </span>
                          ) : (
                            <span className="text-red-400">NYC: API Error</span>
                          )}
                        </div>
                        {dataset.nycRecordCount && dataset.ourRecordCount && (
                          <div className="text-xs mt-1">
                            {dataset.nycRecordCount > dataset.ourRecordCount ? (
                              <div className="text-blue-400">
                                🔧 {(dataset.nycRecordCount - dataset.ourRecordCount).toLocaleString()} filtered
                                <span className="text-[hsl(218,14%,71%)] ml-1">
                                  ({Math.round(((dataset.nycRecordCount - dataset.ourRecordCount) / dataset.nycRecordCount) * 100)}% cleaned)
                                </span>
                              </div>
                            ) : (
                              <div className="text-green-400">✅ Data quality: Good</div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-white">{formatDate(dataset.ourLastSync)}</div>
                        {dataset.ourLastSync && (
                          <div className="text-[hsl(218,14%,71%)]">{formatDaysAgo(dataset.ourLastSync)}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="text-white">{formatDate(dataset.nycLastModified)}</div>
                        {dataset.nycLastModified && (
                          <div className="text-[hsl(218,14%,71%)]">{formatDaysAgo(dataset.nycLastModified)}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => runFreshnessCheck(dataset.datasetId)}
                          disabled={checking}
                          className="px-2 py-1 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] text-xs font-medium rounded hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 transition-colors"
                          title={`Check freshness for ${dataset.datasetName}`}
                        >
                          {checking ? '⏳' : 'Check'}
                        </button>
                        <button
                          onClick={() => triggerSync(getDatasetKey(dataset.datasetId), false)}
                          disabled={syncing.has(getDatasetKey(dataset.datasetId))}
                          className="px-2 py-1 bg-green-700 text-white text-xs font-medium rounded hover:bg-green-600 disabled:opacity-50 transition-colors"
                        >
                          {syncing.has(getDatasetKey(dataset.datasetId)) ? 'Syncing...' : 'Sync'}
                        </button>
                        <button
                          onClick={() => triggerSync(getDatasetKey(dataset.datasetId), true)}
                          disabled={syncing.has(getDatasetKey(dataset.datasetId))}
                          className="px-2 py-1 bg-[hsl(229,17%,53%)] text-white text-xs font-medium rounded hover:bg-[hsl(229,17%,45%)] disabled:opacity-50 transition-colors"
                        >
                          Full Sync
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-8 bg-[hsl(220,16%,28%)] p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">Data Maintenance Guide</h3>
          <div className="space-y-3 text-[hsl(218,14%,71%)]">
            <div>
              <p><strong className="text-white">Freshness Scores:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• <span className="text-green-400">90-100%:</span> Very fresh data, in sync with NYC</li>
                <li>• <span className="text-yellow-400">70-89%:</span> Moderately fresh, may need attention</li>
                <li>• <span className="text-orange-400">50-69%:</span> Getting stale, sync recommended</li>
                <li>• <span className="text-red-400">Below 50%:</span> Stale data, sync required</li>
              </ul>
            </div>
            
            <div>
              <p><strong className="text-white">Maintenance Actions:</strong></p>
              <ul className="ml-4 space-y-1">
                <li>• <strong>Check:</strong> Manually verify freshness against NYC Open Data</li>
                <li>• <strong>Sync:</strong> Incremental sync to get latest records</li>
                <li>• <strong>Full Sync:</strong> Complete refresh of all data</li>
                <li>• <strong>Auto-check:</strong> System checks freshness every 6 hours</li>
              </ul>
            </div>

            <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
              <p className="text-sm"><strong>💡 Best Practice:</strong> Run "Check All Freshness" daily and sync any datasets marked as stale. High priority datasets (Property Sales, DOB Permits) should be synced immediately when stale.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Discovery Modal */}
      <DatasetDiscoveryModal
        isOpen={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        onDatasetAdded={() => {
          // Refresh freshness data to show the new dataset
          fetchFreshnessData();
          setShowDiscoveryModal(false);
        }}
      />
      
      {/* Sync Progress Bar */}
      {activeSyncSession && (
        <SyncProgressBar
          sessionId={activeSyncSession.sessionId}
          datasetId={activeSyncSession.datasetId}
          datasetName={activeSyncSession.datasetName}
          isActive={true}
          onComplete={handleSyncComplete}
          onCancel={handleSyncCancel}
        />
      )}
    </div>
  );
}