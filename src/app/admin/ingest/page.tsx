'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DataIngestionAdmin() {
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('mock');
  const [count, setCount] = useState(10);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleIngest = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch('/api/v1/admin/ingest', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source,
          params: source === 'mock' ? { count } : { zipCode: '10001', limit: 20 }
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Ingestion failed');
      }

      const data = await response.json();
      setResults(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[hsl(218,27%,94%)] mb-2">
            Data Ingestion
          </h2>
          <p className="text-[hsl(219,28%,88%)]">
            Import property data from external sources
          </p>
        </div>
        <Link 
          href="/admin" 
          className="px-4 py-2 bg-transparent border border-[hsl(193,43%,67%)] text-[hsl(193,43%,67%)] hover:bg-[hsl(193,43%,67%,0.1)] rounded-md transition-colors duration-200"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="data-card">
          <h3 className="text-lg font-medium text-[hsl(193,43%,75%)] mb-4">
            Ingestion Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[hsl(219,28%,88%)] mb-1">
                Data Source
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 bg-[hsl(220,17%,28%)] border border-[hsl(220,17%,32%)] rounded-md text-[hsl(218,27%,94%)] focus:outline-none focus:ring-2 focus:ring-[hsl(193,43%,67%)] focus:border-transparent"
              >
                <option value="mock">Mock Data Generator</option>
                <option value="zillow" disabled>Zillow API (Coming Soon)</option>
              </select>
            </div>

            {source === 'mock' && (
              <div>
                <label className="block text-sm font-medium text-[hsl(219,28%,88%)] mb-1">
                  Number of Properties
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  disabled={loading}
                  className="w-full px-3 py-2 bg-[hsl(220,17%,28%)] border border-[hsl(220,17%,32%)] rounded-md text-[hsl(218,27%,94%)] focus:outline-none focus:ring-2 focus:ring-[hsl(193,43%,67%)] focus:border-transparent"
                />
              </div>
            )}

            <button
              onClick={handleIngest}
              disabled={loading}
              className="w-full py-2 px-4 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Ingesting Data...' : 'Start Ingestion'}
            </button>
          </div>
        </div>

        <div className="data-card">
          <h3 className="text-lg font-medium text-[hsl(193,43%,75%)] mb-4">
            Ingestion Results
          </h3>
          
          {results ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[hsl(92,28%,65%,0.1)] border border-[hsl(92,28%,65%,0.2)] rounded-md p-3">
                  <p className="text-sm text-[hsl(219,28%,88%)]">Successful</p>
                  <p className="text-2xl font-bold text-[hsl(92,28%,65%)]">{results.success}</p>
                </div>
                <div className="bg-[hsl(354,42%,56%,0.1)] border border-[hsl(354,42%,56%,0.2)] rounded-md p-3">
                  <p className="text-sm text-[hsl(219,28%,88%)]">Failed</p>
                  <p className="text-2xl font-bold text-[hsl(354,42%,56%)]">{results.failed}</p>
                </div>
              </div>
              
              {results.errors.length > 0 && (
                <div className="bg-[hsl(354,42%,56%,0.1)] border border-[hsl(354,42%,56%,0.2)] rounded-md p-3">
                  <p className="text-sm font-medium text-[hsl(354,42%,56%)] mb-2">Errors:</p>
                  <ul className="text-xs text-[hsl(219,28%,88%)] space-y-1">
                    {results.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : error ? (
            <div className="bg-[hsl(354,42%,56%,0.1)] text-[hsl(354,42%,56%)] border border-[hsl(354,42%,56%,0.2)] rounded-md p-3">
              {error}
            </div>
          ) : (
            <p className="text-[hsl(219,28%,88%)]">
              No ingestion results yet. Configure settings and click "Start Ingestion" to begin.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 data-card">
        <h3 className="text-lg font-medium text-[hsl(193,43%,75%)] mb-4">
          About Data Sources
        </h3>
        <div className="space-y-3 text-sm text-[hsl(219,28%,88%)]">
          <div>
            <strong className="text-[hsl(218,27%,94%)]">Mock Data Generator:</strong>
            <p>Generates realistic property data for testing. Properties include randomized addresses, 
            prices based on square footage, and appropriate characteristics for each property type.</p>
          </div>
          <div>
            <strong className="text-[hsl(218,27%,94%)]">Zillow API (Coming Soon):</strong>
            <p>Connect to Zillow's GetSearchResults API to import real property listings. 
            Requires API key and follows rate limiting guidelines.</p>
          </div>
        </div>
      </div>
    </>
  );
}