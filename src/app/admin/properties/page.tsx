'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Property {
  id: string;
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  list_price: number | null;
  is_active: boolean;
  created_at: string;
}

export default function PropertiesAdmin() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch('/api/v1/properties', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        throw new Error('Failed to fetch properties');
      }

      const data = await response.json();
      setProperties(data.data.properties);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
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
            Properties
          </h2>
          <p className="text-[hsl(219,28%,88%)]">
            Total: {properties.length} properties
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
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Address</th>
              <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">Type</th>
              <th className="text-right p-4 text-[hsl(218,27%,94%)] font-medium">Beds/Baths</th>
              <th className="text-right p-4 text-[hsl(218,27%,94%)] font-medium">Sq Ft</th>
              <th className="text-right p-4 text-[hsl(218,27%,94%)] font-medium">List Price</th>
              <th className="text-center p-4 text-[hsl(218,27%,94%)] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr key={property.id} className="border-b border-[hsl(220,17%,28%)] hover:bg-[hsl(193,43%,67%,0.05)]">
                <td className="p-4">
                  <div className="text-[hsl(218,27%,94%)]">{property.address_line1}</div>
                  <div className="text-sm text-[hsl(219,28%,88%)]">
                    {property.city}, {property.state} {property.zip_code}
                  </div>
                </td>
                <td className="p-4 text-[hsl(219,28%,88%)]">
                  {property.property_type ? property.property_type.replace('_', ' ') : '-'}
                </td>
                <td className="p-4 text-right text-[hsl(219,28%,88%)]">
                  {property.bedrooms || '-'} / {property.bathrooms || '-'}
                </td>
                <td className="p-4 text-right text-[hsl(219,28%,88%)]">
                  {property.square_feet?.toLocaleString() || '-'}
                </td>
                <td className="p-4 text-right text-[hsl(218,27%,94%)] font-medium">
                  {property.list_price ? `$${property.list_price.toLocaleString()}` : '-'}
                </td>
                <td className="p-4 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    property.is_active
                      ? 'bg-[hsl(92,28%,65%,0.1)] text-[hsl(92,28%,65%)] border border-[hsl(92,28%,65%,0.2)]'
                      : 'bg-[hsl(354,42%,56%,0.1)] text-[hsl(354,42%,56%)] border border-[hsl(354,42%,56%,0.2)]'
                  }`}>
                    {property.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {properties.length === 0 && (
          <div className="p-8 text-center text-[hsl(219,28%,88%)]">
            No properties found
          </div>
        )}
      </div>
    </>
  );
}