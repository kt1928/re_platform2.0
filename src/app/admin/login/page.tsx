'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Login failed');
      }

      localStorage.setItem('auth_token', data.data.token);
      router.push('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(220,16%,19%)] flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="data-card">
          <h2 className="text-2xl font-semibold text-[hsl(218,27%,94%)] mb-6">
            Admin Login
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[hsl(219,28%,88%)] mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@re-platform.com"
                required
                className="w-full px-3 py-2 bg-[hsl(220,17%,28%)] border border-[hsl(220,17%,32%)] rounded-md text-[hsl(218,27%,94%)] placeholder-[hsl(220,16%,36%)] focus:outline-none focus:ring-2 focus:ring-[hsl(193,43%,67%)] focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[hsl(219,28%,88%)] mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 bg-[hsl(220,17%,28%)] border border-[hsl(220,17%,32%)] rounded-md text-[hsl(218,27%,94%)] placeholder-[hsl(220,16%,36%)] focus:outline-none focus:ring-2 focus:ring-[hsl(193,43%,67%)] focus:border-transparent"
              />
            </div>

            {error && (
              <div className="bg-[hsl(354,42%,56%,0.1)] text-[hsl(354,42%,56%)] border border-[hsl(354,42%,56%,0.2)] rounded-md p-3 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-sm text-[hsl(219,28%,88%)]">
            <p>Test credentials:</p>
            <p className="font-mono text-xs mt-1">
              Email: admin@re-platform.com<br />
              Password: AdminPass123!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}