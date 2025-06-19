'use client';

import Link from 'next/link';

export default function PortfoliosAdmin() {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[hsl(218,27%,94%)] mb-2">
            Portfolios
          </h2>
          <p className="text-[hsl(219,28%,88%)]">
            No portfolios created yet
          </p>
        </div>
        <Link 
          href="/admin" 
          className="px-4 py-2 bg-transparent border border-[hsl(193,43%,67%)] text-[hsl(193,43%,67%)] hover:bg-[hsl(193,43%,67%,0.1)] rounded-md transition-colors duration-200"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="data-card">
        <p className="text-center text-[hsl(219,28%,88%)] py-8">
          No portfolios have been created yet. Create portfolios through the API to see them here.
        </p>
      </div>
    </>
  );
}