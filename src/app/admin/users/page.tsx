'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface User {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch('/api/v1/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="table-container">
        <div className="p-8">
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
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
            Users
          </h2>
          <p className="text-[hsl(219,28%,88%)]">
            Total: {users.length} users
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
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Email</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Role</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Created</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Last Login</th>
              <th className="text-center p-4 text-[hsl(218,27%,94%)] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[hsl(220,17%,28%)] hover:bg-[hsl(193,43%,67%,0.05)]">
                <td className="p-4 text-[hsl(218,27%,94%)]">{user.email}</td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    user.role === 'admin'
                      ? 'bg-[hsl(311,20%,63%,0.1)] text-[hsl(311,20%,63%)] border border-[hsl(311,20%,63%,0.2)]'
                      : user.role === 'analyst'
                      ? 'bg-[hsl(210,34%,63%,0.1)] text-[hsl(210,34%,63%)] border border-[hsl(210,34%,63%,0.2)]'
                      : 'bg-[hsl(219,28%,88%,0.1)] text-[hsl(219,28%,88%)] border border-[hsl(219,28%,88%,0.2)]'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4 text-[hsl(219,28%,88%)] text-sm">{formatDate(user.createdAt)}</td>
                <td className="p-4 text-[hsl(219,28%,88%)] text-sm">{formatDate(user.lastLoginAt)}</td>
                <td className="p-4 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    user.isActive
                      ? 'bg-[hsl(92,28%,65%,0.1)] text-[hsl(92,28%,65%)] border border-[hsl(92,28%,65%,0.2)]'
                      : 'bg-[hsl(354,42%,56%,0.1)] text-[hsl(354,42%,56%)] border border-[hsl(354,42%,56%,0.2)]'
                  }`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}