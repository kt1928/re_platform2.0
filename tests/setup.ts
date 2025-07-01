import { beforeAll, afterAll } from 'vitest';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.NYC_TEST_MODE = 'true';
  
  // Mock console methods to reduce noise in tests
  if (!process.env.VERBOSE_TESTS) {
    console.log = () => {};
    console.warn = () => {};
  }
});

afterAll(() => {
  // Cleanup after all tests
  delete process.env.NYC_TEST_MODE;
});