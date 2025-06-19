# API Routes Documentation

## API Design Principles

1. **RESTful where it makes sense** - Don't force REST for complex operations
2. **Consistent error responses** - Same format for all errors
3. **Version from day one** - `/api/v1/` prefix for all routes
4. **Authenticate everything** - No public endpoints, period
5. **Validate aggressively** - Never trust client data

## Authentication

All routes require authentication via JWT token in Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Auth Endpoints

```typescript
POST   /api/v1/auth/login
POST   /api/v1/auth/logout  
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
```

## Standard Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0",
    "request_id": "uuid"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "zip_code",
      "issue": "Must be 5 or 9 digits"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "uuid"
  }
}
```

### Error Codes
- `UNAUTHORIZED` - Invalid or missing auth token
- `FORBIDDEN` - Valid auth but insufficient permissions
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Input validation failed
- `RATE_LIMITED` - Too many requests
- `INTERNAL_ERROR` - Server error (500)

## Core API Routes

### Properties

```typescript
// Search properties
GET    /api/v1/properties
Query: {
  q?: string              // Full-text search
  zip_code?: string       // Filter by ZIP
  min_price?: number      // Minimum price
  max_price?: number      // Maximum price
  property_type?: string  // single_family, condo, etc.
  bedrooms?: number       // Minimum bedrooms
  bathrooms?: number      // Minimum bathrooms
  limit?: number          // Default: 20, Max: 100
  offset?: number         // For pagination
}

// Get single property
GET    /api/v1/properties/:id

// Create property (admin only)
POST   /api/v1/properties
Body: {
  address_line1: string
  city: string
  state: string
  zip_code: string
  property_type: string
  bedrooms?: number
  bathrooms?: number
  square_feet?: number
  list_price?: number
}

// Update property (admin only)
PATCH  /api/v1/properties/:id
Body: Partial<Property>

// Get property history
GET    /api/v1/properties/:id/history

// Get comparable properties
GET    /api/v1/properties/:id/comparables
Query: {
  radius_miles?: number   // Default: 1.0
  limit?: number         // Default: 10
}
```

### Market Analysis

```typescript
// Get market metrics for ZIP code
GET    /api/v1/market/metrics/:zip_code
Query: {
  start_date?: string    // ISO date
  end_date?: string      // ISO date
  interval?: string      // daily, weekly, monthly
}

// Get market trends
GET    /api/v1/market/trends
Query: {
  zip_codes: string[]    // Comma-separated
  metric: string         // median_price, sales_volume, etc.
  period: string         // 1m, 3m, 6m, 1y, 5y
}

// Compare multiple markets
POST   /api/v1/market/compare
Body: {
  zip_codes: string[]
  metrics: string[]
  date_range: {
    start: string
    end: string
  }
}
```

### Investment Analysis

```typescript
// Run investment analysis
POST   /api/v1/analysis/investment
Body: {
  property_id: string
  purchase_price: number
  down_payment_percent: number
  interest_rate: number
  loan_term_years: number
  monthly_rent: number
  expenses: {
    property_tax: number
    insurance: number
    hoa?: number
    maintenance?: number
    management?: number
  }
}

// Get saved analyses
GET    /api/v1/analysis
Query: {
  property_id?: string
  user_id?: string
  limit?: number
  offset?: number
}

// Get analysis by ID
GET    /api/v1/analysis/:id
```

### Portfolios

```typescript
// List user's portfolios
GET    /api/v1/portfolios

// Get portfolio details
GET    /api/v1/portfolios/:id

// Create portfolio
POST   /api/v1/portfolios
Body: {
  name: string
  description?: string
  target_return?: number
  risk_tolerance?: string
}

// Update portfolio
PATCH  /api/v1/portfolios/:id

// Delete portfolio
DELETE /api/v1/portfolios/:id

// Add property to portfolio
POST   /api/v1/portfolios/:id/properties
Body: {
  property_id: string
  purchase_date: string
  purchase_price: number
  down_payment: number
  loan_amount?: number
  interest_rate?: number
}

// Remove property from portfolio
DELETE /api/v1/portfolios/:id/properties/:property_id

// Get portfolio performance
GET    /api/v1/portfolios/:id/performance
Query: {
  period?: string        // mtd, qtd, ytd, all
}
```

### Data Management

```typescript
// Trigger data sync (admin only)
POST   /api/v1/admin/sync
Body: {
  source: string         // zillow, census, nyc_opendata
  type: string          // full, incremental
  options?: {
    zip_codes?: string[]
    force?: boolean
  }
}

// Get sync status
GET    /api/v1/admin/sync/status

// Get data quality report
GET    /api/v1/admin/data-quality
Query: {
  table?: string
  severity?: string
  resolved?: boolean
}
```

## Implementation Examples

### Property Search Endpoint

```typescript
// /api/v1/properties/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/auth';
import { PropertyRepository } from '@/lib/repositories';

const searchSchema = z.object({
  q: z.string().optional(),
  zip_code: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  min_price: z.coerce.number().positive().optional(),
  max_price: z.coerce.number().positive().optional(),
  property_type: z.enum(['single_family', 'condo', 'townhouse']).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      }, { status: 401 });
    }

    // Parse and validate query params
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const params = searchSchema.parse(searchParams);

    // Execute search
    const repository = new PropertyRepository();
    const results = await repository.search(params);

    return NextResponse.json({
      success: true,
      data: {
        properties: results.properties,
        total: results.total,
        limit: params.limit,
        offset: params.offset
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        request_id: crypto.randomUUID()
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: error.errors
        }
      }, { status: 400 });
    }

    console.error('Property search error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred'
      }
    }, { status: 500 });
  }
}
```

### Investment Analysis Endpoint

```typescript
// /api/v1/analysis/investment/route.ts
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) return unauthorized();

    const body = await request.json();
    const input = analysisSchema.parse(body);

    // Run analysis
    const service = new InvestmentAnalysisService();
    const results = await service.analyze(input);

    // Save analysis
    const repository = new AnalysisRepository();
    const saved = await repository.save({
      ...input,
      ...results,
      user_id: user.id,
      analysis_type: 'investment'
    });

    // Log for audit
    await auditLog(user.id, 'analysis', saved.id, 'CREATE');

    return NextResponse.json({
      success: true,
      data: saved
    });

  } catch (error) {
    return handleError(error);
  }
}
```

## Rate Limiting

All endpoints are rate limited per user:

- **Standard endpoints**: 100 requests per minute
- **Search endpoints**: 30 requests per minute  
- **Analysis endpoints**: 10 requests per minute
- **Admin endpoints**: 20 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642255200
```

## Caching Strategy

### Cache Headers
```typescript
// No cache for user-specific data
'Cache-Control': 'private, no-cache, no-store, must-revalidate'

// Cache market data for 1 hour
'Cache-Control': 'private, max-age=3600'

// Cache property data for 10 minutes  
'Cache-Control': 'private, max-age=600'
```

### ETag Support
- Generate ETags for GET requests
- Support conditional requests (If-None-Match)
- Return 304 Not Modified when appropriate

## Security Considerations

### Input Validation
- Use Zod for runtime validation
- Sanitize all string inputs
- Validate UUIDs format
- Check number ranges
- Limit array sizes

### SQL Injection Prevention
- Use Prisma parameterized queries
- Never concatenate user input
- Validate table/column names against whitelist

### Authorization Checks
```typescript
// Check ownership
if (property.user_id !== user.id && user.role !== 'admin') {
  return forbidden();
}

// Check portfolio access
const hasAccess = await checkPortfolioAccess(user.id, portfolioId);
if (!hasAccess) {
  return forbidden();
}
```

## Monitoring & Logging

### Log Every Request
```typescript
{
  timestamp: '2024-01-15T10:30:00Z',
  method: 'GET',
  path: '/api/v1/properties',
  user_id: 'uuid',
  ip: '192.168.1.1',
  duration_ms: 145,
  status_code: 200,
  request_id: 'uuid'
}
```

### Performance Metrics
- Track p50, p95, p99 response times
- Monitor database query times
- Alert on error rate > 1%
- Track rate limit violations

## Testing Strategy

### Unit Tests
```typescript
describe('GET /api/v1/properties', () => {
  it('should require authentication', async () => {
    const response = await GET('/api/v1/properties');
    expect(response.status).toBe(401);
  });

  it('should validate zip code format', async () => {
    const response = await GET('/api/v1/properties?zip_code=123');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return paginated results', async () => {
    const response = await GET('/api/v1/properties?limit=10');
    expect(response.body.data.properties).toHaveLength(10);
  });
});
```

### Integration Tests
- Test full request/response cycle
- Verify database transactions
- Check audit logging
- Validate caching behavior

---

**Remember**: APIs are contracts. Breaking changes require new versions. Design thoughtfully because changes are expensive.