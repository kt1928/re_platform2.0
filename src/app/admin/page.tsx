'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DbStats {
  users: number;
  properties: number;
  portfolios: number;
  marketMetrics: number;
  auditLogs: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch('/api/v1/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="data-card">
            <div className="skeleton h-5 w-24 mb-3"></div>
            <div className="skeleton h-8 w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[hsl(354,42%,56%,0.1)] text-[hsl(354,42%,56%)] border border-[hsl(354,42%,56%,0.2)] rounded-md p-4">
        Error: {error}
      </div>
    );
  }

  const dataCards = [
    { label: 'Users', value: stats?.users || 0, href: '/admin/users', color: 'hsl(193,43%,67%)' },
    { label: 'Properties', value: stats?.properties || 0, href: '/admin/properties', color: 'hsl(92,28%,65%)' },
    { label: 'Portfolios', value: stats?.portfolios || 0, href: '/admin/portfolios', color: 'hsl(210,34%,63%)' },
    { label: 'Market Metrics', value: stats?.marketMetrics || 0, href: '/admin/market', color: 'hsl(40,71%,73%)' },
    { label: 'Audit Logs', value: stats?.auditLogs || 0, href: '/admin/audit', color: 'hsl(311,20%,63%)' },
  ];

  return (
    <>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[hsl(218,27%,94%)] mb-2">
          Database Overview
        </h2>
        <p className="text-[hsl(219,28%,88%)]">
          Current state of the RE Platform database
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {dataCards.map((card) => (
          <Link key={card.label} href={card.href} className="data-card block">
            <h4 className="font-medium text-[hsl(193,43%,75%)] mb-2">
              {card.label}
            </h4>
            <p className="text-3xl font-bold text-[hsl(218,27%,94%)] mb-1">
              {card.value.toLocaleString()}
            </p>
            <span className="text-sm text-[hsl(219,28%,88%)]">
              Click to view details →
            </span>
          </Link>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap">
        <Link
          href="/admin/ingest"
          className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] transition-colors duration-200"
        >
          Import Data
        </Link>
        <Link
          href="/admin/nyc-data"
          className="px-4 py-2 bg-[hsl(92,28%,65%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(92,28%,58%)] transition-colors duration-200"
        >
          NYC Open Data
        </Link>
        <Link
          href="/admin/census-data"
          className="px-4 py-2 bg-[hsl(40,71%,73%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(40,71%,66%)] transition-colors duration-200"
        >
          Census Data
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-transparent border border-[hsl(193,43%,67%)] text-[hsl(193,43%,67%)] hover:bg-[hsl(193,43%,67%,0.1)] rounded-md transition-colors duration-200"
        >
          Refresh Data
        </button>
        <button
          onClick={() => {
            localStorage.removeItem('auth_token');
            window.location.href = '/admin/login';
          }}
          className="px-4 py-2 bg-transparent border border-[hsl(354,42%,56%)] text-[hsl(354,42%,56%)] hover:bg-[hsl(354,42%,56%,0.1)] rounded-md transition-colors duration-200"
        >
          Logout
        </button>
      </div>
    </>
  );
}