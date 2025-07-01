import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NYCOpenDataClient, createDatasetConfig, NYCDataset } from '../src/lib/data-sources/nyc-open-data';

// Mock fetch for testing
global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);

describe('NYC Open Data Client', () => {
  let client: NYCOpenDataClient;
  let testDataset: NYCDataset;

  beforeEach(() => {
    client = new NYCOpenDataClient();
    testDataset = createDatasetConfig('8wbx-tsch', {
      name: 'Test Dataset',
      limit: 1000
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic API Operations', () => {
    it('should fetch dataset successfully', async () => {
      const mockData = [
        { id: '1', name: 'Test Record 1' },
        { id: '2', name: 'Test Record 2' }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers()
      } as Response);

      const result = await client.fetchDataset(testDataset, { $limit: 2 });

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('8wbx-tsch.json');
      expect(calledUrl).toContain('$limit=2');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: () => Promise.resolve('Dataset not found')
      } as Response);

      await expect(client.fetchDataset(testDataset)).rejects.toThrow('HTTP 404');
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        })
      );

      await expect(
        client.fetchDataset(testDataset, {}, { timeout: 50 })
      ).rejects.toThrow('timeout');
    });

    it('should handle rate limiting errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '60' }),
        text: () => Promise.resolve('Rate limit exceeded')
      } as Response);

      await expect(client.fetchDataset(testDataset)).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Parameter Validation', () => {
    it('should handle basic parameters correctly', async () => {
      const mockData = [{ id: '1' }];
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers()
      } as Response);

      await client.fetchDataset(testDataset, {
        $limit: 500,
        $offset: 100,
        $select: 'id,name',
        $where: "status='active'"
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('$limit=500');
      expect(calledUrl).toContain('$offset=100');
      expect(calledUrl).toContain('$select=id,name');
      expect(calledUrl).toContain('$where=status=\'active\'');
    });

    it('should skip validation when requested', async () => {
      const mockData = [{ id: '1' }];
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers()
      } as Response);

      // Should not throw even with potentially invalid parameters
      await client.fetchDataset(
        testDataset, 
        { $select: 'nonexistent_field' },
        { skipValidation: true }
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient failures', async () => {
      // First call fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error')
      } as Response);

      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: '1' }]),
        headers: new Headers()
      } as Response);

      const result = await client.fetchDataset(testDataset);

      expect(result).toEqual([{ id: '1' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on permanent failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: () => Promise.resolve('Access denied')
      } as Response);

      await expect(client.fetchDataset(testDataset)).rejects.toThrow('Access forbidden');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Record Count Operations', () => {
    it('should get record count via metadata API', async () => {
      // Mock metadata API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          rowCount: 50000,
          name: 'Test Dataset',
          id: '8wbx-tsch'
        }),
        headers: new Headers()
      } as Response);

      const result = await client.getRecordCount(testDataset);

      expect(result.count).toBe(50000);
      expect(result.estimated).toBe(false);
      expect(result.method).toBe('metadata');
    });

    it('should fallback to count query when metadata fails', async () => {
      // Metadata API fails
      mockFetch.mockRejectedValueOnce(new Error('Metadata not available'));

      // Count query succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ count: '25000' }]),
        headers: new Headers()
      } as Response);

      const result = await client.getRecordCount(testDataset);

      expect(result.count).toBe(25000);
      expect(result.method).toBe('count_query');
    });

    it('should provide fallback estimates when all methods fail', async () => {
      // All API calls fail
      mockFetch.mockRejectedValue(new Error('API unavailable'));

      const result = await client.getRecordCount(testDataset);

      expect(result.count).toBeGreaterThan(0);
      expect(result.estimated).toBe(true);
      expect(result.method).toBe('fallback_estimate');
    });
  });

  describe('Parallel Processing', () => {
    it('should handle parallel fetching correctly', async () => {
      // Mock multiple successful responses
      const mockResponses = [
        [{ id: '1' }, { id: '2' }],
        [{ id: '3' }, { id: '4' }],
        [{ id: '5' }, { id: '6' }]
      ];

      mockResponses.forEach(data => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
          headers: new Headers()
        } as Response);
      });

      let totalProcessed = 0;
      const onBatch = vi.fn(async (records: any[]) => {
        totalProcessed += records.length;
      });

      await client.fetchAllRecordsParallel(
        testDataset,
        { $limit: 2 },
        onBatch,
        { maxRecords: 6, concurrency: 2, batchSize: 2 }
      );

      expect(totalProcessed).toBe(6);
      expect(onBatch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle memory optimization in parallel mode', async () => {
      const mockData = [{ id: '1' }, { id: '2' }];
      
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockData),
        headers: new Headers()
      } as Response);

      // Mock process.memoryUsage for memory monitoring
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        rss: 150 * 1024 * 1024
      });

      await client.fetchAllRecordsParallel(
        testDataset,
        {},
        undefined,
        { maxRecords: 4, memoryOptimized: true, concurrency: 1 }
      );

      expect(process.memoryUsage).toHaveBeenCalled();
      
      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Health Check', () => {
    it('should report healthy status when API is accessible', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
        headers: new Headers()
      } as Response);

      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should report unhealthy status when API is down', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('Dataset Configuration', () => {
    it('should create dataset config with default values', () => {
      const dataset = createDatasetConfig('test-123');

      expect(dataset.id).toBe('test-123');
      expect(dataset.endpoint).toBe('https://data.cityofnewyork.us/resource/test-123.json');
      expect(dataset.limit).toBe(1000);
    });

    it('should create dataset config with custom options', () => {
      const dataset = createDatasetConfig('test-456', {
        name: 'Custom Dataset',
        primaryKey: ['id', 'date'],
        dateField: 'created_at',
        limit: 500
      });

      expect(dataset.name).toBe('Custom Dataset');
      expect(dataset.primaryKey).toEqual(['id', 'date']);
      expect(dataset.dateField).toBe('created_at');
      expect(dataset.limit).toBe(500);
    });
  });

  describe('Error Recovery', () => {
    it('should handle AbortError correctly', async () => {
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(client.fetchDataset(testDataset)).rejects.toThrow('timeout');
    });

    it('should provide meaningful error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid query syntax')
      } as Response);

      await expect(client.fetchDataset(testDataset)).rejects.toThrow('HTTP 400: Invalid query syntax');
    });
  });
});

describe('Integration Tests (Real API)', () => {
  // These tests run against the real NYC Open Data API
  // They should only run in CI/CD environment with proper rate limiting

  const isCI = process.env.CI === 'true' || process.env.NYC_TEST_MODE === 'true';
  const testCondition = isCI ? it : it.skip;

  let client: NYCOpenDataClient;
  let testDataset: NYCDataset;

  beforeEach(() => {
    client = new NYCOpenDataClient();
    testDataset = createDatasetConfig('8wbx-tsch', {
      name: 'For Hire Vehicles - Active (Integration Test)',
      limit: 100 // Small limit for integration tests
    });
  });

  testCondition('should fetch real data from NYC API', async () => {
    const result = await client.fetchDataset(testDataset, { $limit: 5 });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
  }, 15000); // 15 second timeout for real API calls

  testCondition('should get real record count', async () => {
    const result = await client.getRecordCount(testDataset);

    expect(result.count).toBeGreaterThan(0);
    expect(typeof result.count).toBe('number');
    expect(['metadata', 'count_query', 'sample_complete', 'quick_estimate', 'fallback_estimate'])
      .toContain(result.method);
  }, 20000);

  testCondition('should handle real API health check', async () => {
    const result = await client.healthCheck();

    expect(typeof result.healthy).toBe('boolean');
    expect(typeof result.responseTime).toBe('number');
    expect(result.responseTime).toBeGreaterThan(0);
  }, 10000);
});