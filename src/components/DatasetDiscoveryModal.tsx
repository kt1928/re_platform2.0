'use client';

import { useState, useEffect } from 'react';
// Using simple SVG icons instead of lucide-react
const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <path d="21 21l-4.35-4.35"></path>
  </svg>
);

const DatabaseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
    <path d="M5 12c0 1.657 3.134 3 7 3s7-1.343 7-3"></path>
    <path d="M5 5v14c0 1.657 3.134 3 7 3s7-1.343 7-3V5"></path>
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15,3 21,3 21,9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
  </svg>
);

interface DiscoveredDataset {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  apiEndpoint: string;
  webUrl: string;
  recordCount: number;
  lastUpdated: Date | null;
  columns: DatasetColumn[];
  updateFrequency: string;
  isConfigured: boolean;
}

interface DatasetColumn {
  fieldName: string;
  displayName: string;
  dataTypeName: string;
  description: string;
  position: number;
}

interface DatasetSearchResult {
  datasets: DiscoveredDataset[];
  totalCount: number;
  categories: string[];
  popularTags: string[];
}

interface DatasetDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatasetAdded?: (dataset: DiscoveredDataset) => void;
}

export default function DatasetDiscoveryModal({ isOpen, onClose, onDatasetAdded }: DatasetDiscoveryModalProps) {
  const [searchResults, setSearchResults] = useState<DatasetSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<DiscoveredDataset | null>(null);
  const [adding, setAdding] = useState<Set<string>>(new Set());

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    if (isOpen) {
      searchDatasets();
    }
  }, [isOpen]);

  const searchDatasets = async (page: number = 1) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams({
        action: 'search',
        limit: itemsPerPage.toString(),
        offset: ((page - 1) * itemsPerPage).toString()
      });

      if (searchQuery) params.append('query', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      if (selectedTags.length > 0) params.append('tags', selectedTags.join(','));

      const response = await fetch(`/api/v1/datasets/discover?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to search datasets');
      }

      const data = await response.json();
      if (data.success) {
        setSearchResults(data.data);
        setCurrentPage(page);
      } else {
        throw new Error(data.error?.message || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const addDataset = async (dataset: DiscoveredDataset) => {
    setAdding(prev => new Set([...prev, dataset.id]));
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/v1/datasets/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'add',
          datasetId: dataset.id,
          configuration: {
            priority: 50,
            autoSync: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to add dataset');
      }

      const data = await response.json();
      if (data.success) {
        // Mark dataset as configured
        if (searchResults) {
          const updatedDatasets = searchResults.datasets.map(ds =>
            ds.id === dataset.id ? { ...ds, isConfigured: true } : ds
          );
          setSearchResults({ ...searchResults, datasets: updatedDatasets });
        }

        onDatasetAdded?.(dataset);
      } else {
        throw new Error(data.error?.message || 'Failed to add dataset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add dataset');
    } finally {
      setAdding(prev => {
        const newSet = new Set(prev);
        newSet.delete(dataset.id);
        return newSet;
      });
    }
  };

  const getDatasetDetails = async (datasetId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/v1/datasets/discover?action=details&id=${datasetId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get dataset details');
      }

      const data = await response.json();
      if (data.success) {
        setSelectedDataset(data.data.dataset);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get dataset details');
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    searchDatasets(1);
  };

  const handlePageChange = (page: number) => {
    searchDatasets(page);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  const formatRecordCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(220,16%,22%)] rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[hsl(220,16%,36%)]">
          <div>
            <h2 className="text-xl font-bold text-white">Discover NYC Datasets</h2>
            <p className="text-[hsl(218,14%,71%)] text-sm">Browse and add datasets from NYC Open Data</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[hsl(220,16%,36%)] rounded-lg transition-colors text-[hsl(218,14%,71%)]"
          >
            <XIcon />
          </button>
        </div>

        {/* Search and Filters */}
        <div className="p-6 border-b border-[hsl(220,16%,36%)]">
          {/* Search Bar */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[hsl(218,14%,71%)]">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search datasets (e.g., 'property', 'building', 'permit')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 bg-[hsl(220,16%,28%)] border border-[hsl(220,16%,36%)] rounded-md text-white placeholder-[hsl(218,14%,71%)] focus:outline-none focus:border-[hsl(193,43%,67%)]"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-[hsl(229,17%,53%)] text-white rounded-md hover:bg-[hsl(229,17%,45%)] transition-colors flex items-center gap-2"
            >
              <FilterIcon />
              Filters
            </button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="bg-[hsl(220,16%,28%)] p-4 rounded-lg space-y-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full p-2 bg-[hsl(220,16%,36%)] border border-[hsl(220,16%,45%)] rounded-md text-white focus:outline-none focus:border-[hsl(193,43%,67%)]"
                >
                  <option value="">All Categories</option>
                  {searchResults?.categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Tags Filter */}
              {searchResults?.popularTags && searchResults.popularTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Popular Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {searchResults.popularTags.slice(0, 10).map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1 text-xs rounded-full transition-colors ${
                          selectedTags.includes(tag)
                            ? 'bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)]'
                            : 'bg-[hsl(220,16%,36%)] text-[hsl(218,14%,71%)] hover:bg-[hsl(220,16%,45%)]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-900/30 border border-red-700 rounded-md">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-[hsl(218,14%,71%)]">Searching datasets...</div>
            </div>
          ) : searchResults ? (
            <div className="h-full flex">
              {/* Dataset List */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4 text-sm text-[hsl(218,14%,71%)]">
                  Found {searchResults.totalCount} datasets
                </div>
                
                <div className="space-y-4">
                  {searchResults.datasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      className="bg-[hsl(220,16%,28%)] rounded-lg border border-[hsl(220,16%,36%)] p-4 hover:border-[hsl(193,43%,67%)] transition-colors cursor-pointer"
                      onClick={() => getDatasetDetails(dataset.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-white">{dataset.name}</h3>
                            {dataset.isConfigured && (
                              <span className="px-2 py-1 text-xs bg-green-900/30 text-green-400 border border-green-700 rounded">
                                ADDED
                              </span>
                            )}
                            <a
                              href={dataset.webUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[hsl(193,43%,67%)] hover:text-[hsl(193,43%,80%)]"
                            >
                              <ExternalLinkIcon />
                            </a>
                          </div>
                          
                          <p className="text-[hsl(218,14%,71%)] text-sm mb-3 line-clamp-2">
                            {dataset.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-[hsl(218,14%,71%)]">
                            <div className="flex items-center gap-1">
                              <DatabaseIcon />
                              {formatRecordCount(dataset.recordCount)} records
                            </div>
                            <div className="flex items-center gap-1">
                              <CalendarIcon />
                              Updated {formatDate(dataset.lastUpdated)}
                            </div>
                            <div className="px-2 py-1 bg-[hsl(220,16%,36%)] rounded">
                              {dataset.category}
                            </div>
                          </div>
                          
                          {dataset.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {dataset.tags.slice(0, 5).map(tag => (
                                <span
                                  key={tag}
                                  className="px-2 py-1 text-xs bg-[hsl(229,17%,53%)]/20 text-[hsl(229,17%,73%)] rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-4">
                          {dataset.isConfigured ? (
                            <div className="px-3 py-1 text-sm bg-green-900/30 text-green-400 border border-green-700 rounded">
                              Added
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addDataset(dataset);
                              }}
                              disabled={adding.has(dataset.id)}
                              className="px-3 py-1 text-sm bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 transition-colors flex items-center gap-1"
                            >
                              <PlusIcon />
                              {adding.has(dataset.id) ? 'Adding...' : 'Add'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {searchResults.totalCount > itemsPerPage && (
                  <div className="mt-6 flex justify-center">
                    <div className="flex gap-2">
                      {currentPage > 1 && (
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          className="px-3 py-1 text-sm bg-[hsl(229,17%,53%)] text-white rounded hover:bg-[hsl(229,17%,45%)]"
                        >
                          Previous
                        </button>
                      )}
                      
                      <span className="px-3 py-1 text-sm text-[hsl(218,14%,71%)]">
                        Page {currentPage} of {Math.ceil(searchResults.totalCount / itemsPerPage)}
                      </span>
                      
                      {currentPage < Math.ceil(searchResults.totalCount / itemsPerPage) && (
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          className="px-3 py-1 text-sm bg-[hsl(229,17%,53%)] text-white rounded hover:bg-[hsl(229,17%,45%)]"
                        >
                          Next
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dataset Details Panel */}
              {selectedDataset && (
                <div className="w-1/3 border-l border-[hsl(220,16%,36%)] bg-[hsl(220,16%,25%)] overflow-y-auto">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-white">Dataset Details</h3>
                      <button
                        onClick={() => setSelectedDataset(null)}
                        className="text-[hsl(218,14%,71%)] hover:text-white"
                      >
                        <XIcon />
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-white mb-1">{selectedDataset.name}</h4>
                        <p className="text-sm text-[hsl(218,14%,71%)]">{selectedDataset.description}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-white">Record Count</label>
                        <p className="text-[hsl(218,14%,71%)]">{selectedDataset.recordCount.toLocaleString()}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-white">Update Frequency</label>
                        <p className="text-[hsl(218,14%,71%)]">{selectedDataset.updateFrequency}</p>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-white">Fields ({selectedDataset.columns.length})</label>
                        <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                          {selectedDataset.columns.map((column, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-medium text-white">{column.displayName}</div>
                              <div className="text-[hsl(218,14%,71%)] text-xs">
                                {column.dataTypeName} • {column.fieldName}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {!selectedDataset.isConfigured && (
                        <button
                          onClick={() => addDataset(selectedDataset)}
                          disabled={adding.has(selectedDataset.id)}
                          className="w-full px-4 py-2 bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] font-medium rounded-md hover:bg-[hsl(193,43%,60%)] disabled:opacity-50 transition-colors"
                        >
                          {adding.has(selectedDataset.id) ? 'Adding Dataset...' : 'Add This Dataset'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[hsl(218,14%,71%)]">
              Click "Search" to discover NYC datasets
            </div>
          )}
        </div>
      </div>
    </div>
  );
}