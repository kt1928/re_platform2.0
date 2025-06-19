'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AuditLog {
  id: string;
  userId: string | null;
  userEmail?: string;
  tableName: string;
  recordId: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export default function AuditAdmin() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch('/api/v1/admin/audit', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        throw new Error('Failed to fetch audit logs');
      }

      const data = await response.json();
      setLogs(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'INSERT':
        return 'bg-[hsl(92,28%,65%,0.1)] text-[hsl(92,28%,65%)] border-[hsl(92,28%,65%,0.2)]';
      case 'UPDATE':
        return 'bg-[hsl(210,34%,63%,0.1)] text-[hsl(210,34%,63%)] border-[hsl(210,34%,63%,0.2)]';
      case 'DELETE':
        return 'bg-[hsl(354,42%,56%,0.1)] text-[hsl(354,42%,56%)] border-[hsl(354,42%,56%,0.2)]';
      default:
        return 'bg-[hsl(219,28%,88%,0.1)] text-[hsl(219,28%,88%)] border-[hsl(219,28%,88%,0.2)]';
    }
  };

  if (loading) {
    return (
      <div className="table-container">
        <div className="p-8">
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton h-12 w-full"></div>
            ))}
          </div>
        </div>
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

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[hsl(218,27%,94%)] mb-2">
            Audit Logs
          </h2>
          <p className="text-[hsl(219,28%,88%)]">
            Total: {logs.length} audit entries
          </p>
        </div>
        <Link 
          href="/admin" 
          className="px-4 py-2 bg-transparent border border-[hsl(193,43%,67%)] text-[hsl(193,43%,67%)] hover:bg-[hsl(193,43%,67%,0.1)] rounded-md transition-colors duration-200"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="table-container">
        <table className="table-enhanced">
          <thead>
            <tr className="border-b border-[hsl(220,17%,28%)]">
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Timestamp</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">User</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Table</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Action</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">IP Address</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-[hsl(220,17%,28%)] hover:bg-[hsl(193,43%,67%,0.05)]">
                <td className="p-4 text-[hsl(219,28%,88%)] text-sm">
                  {formatDate(log.createdAt)}
                </td>
                <td className="p-4 text-[hsl(218,27%,94%)]">
                  {log.userEmail || log.userId || 'System'}
                </td>
                <td className="p-4 text-[hsl(219,28%,88%)]">
                  {log.tableName}
                </td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="p-4 text-[hsl(219,28%,88%)] font-mono text-sm">
                  {log.ipAddress || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="p-8 text-center text-[hsl(219,28%,88%)]">
            No audit logs found
          </div>
        )}
      </div>
    </>
  );
}