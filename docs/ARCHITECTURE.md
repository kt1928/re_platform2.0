# System Architecture

## Overview

The Real Estate Intelligence Platform is a **monolithic Next.js application** with a PostgreSQL database. We explicitly chose a monolith over microservices because:

1. We have one team and one deployment target
2. Microservices add complexity we don't need
3. Next.js API routes give us logical separation
4. We can always split later if needed

## Core Architecture Principles

### 1. KISS (Keep It Simple, Stupid)
- No abstraction until we need it twice
- No optimization until we measure slowness
- No distribution until we hit scale limits

### 2. YAGNI (You Aren't Gonna Need It)
- Build features when needed, not "just in case"
- Avoid "future-proofing" that adds complexity
- Delete code that isn't being used

### 3. Data Integrity Above All
- Financial data must be 100% accurate
- Use database constraints, not application logic
- Always have an audit trail

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────┐ │
│  │   API Routes    │  │  Business Logic  │  │   Auth     │ │
│  │  /api/v1/*     │  │   Domain Models  │  │ NextAuth   │ │
│  └────────┬────────┘  └────────┬─────────┘  └─────┬──────┘ │
│           │                    │                    │        │
│  ┌────────┴───────────────────┴────────────────────┴──────┐ │
│  │                    Prisma ORM Layer                     │ │
│  │              Type-safe database access                  │ │
│  └─────────────────────────┬──────────────────────────────┘ │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │   PostgreSQL    │
                    │   Database      │
                    └─────────────────┘
```

## Data Flow

### 1. Data Ingestion
```
External APIs → Validation → PostgreSQL → Change Detection → Notifications
```

### 2. User Requests
```
Client → Auth Check → API Route → Business Logic → Database → Response
```

### 3. Background Jobs
```
Cron → Job Queue → Data Processor → Database Update → Audit Log
```

## Technology Choices & Rationale

### Next.js 15 (API Routes Only)
**Why**: 
- Single deployment unit
- Built-in TypeScript support
- Excellent DX with hot reload
- Easy auth integration

**Why Not Alternatives**:
- Express.js: More setup, less convention
- NestJS: Over-engineered for our needs
- FastAPI: Would split our stack (Python/JS)

### PostgreSQL 15
**Why**:
- ACID compliance for financial data
- JSON columns for flexible schemas
- Excellent performance at our scale
- Strong ecosystem

**Why Not Alternatives**:
- MongoDB: No ACID, eventual consistency issues
- MySQL: Weaker JSON support
- SQLite: No concurrent writes

### Prisma ORM
**Why**:
- Type-safe database queries
- Automatic migration generation
- Great developer experience
- Prevents SQL injection

**Why Not Alternatives**:
- TypeORM: More complex, less stable
- Raw SQL: Error-prone, no type safety
- Drizzle: Too new, smaller community

## Security Architecture

### Authentication Flow
```
1. User login with email/password
2. NextAuth creates JWT token
3. Token included in all API requests
4. Middleware validates on each request
5. Role-based access control (RBAC)
```

### Data Security
- All API routes require authentication
- Row-level security in PostgreSQL
- Encrypted passwords with bcrypt
- API rate limiting per user
- Audit log for all data changes

### Network Security
- HTTPS only (enforced by middleware)
- CORS disabled (internal only)
- No public endpoints
- VPN access required in production

## Scaling Strategy

### Current: Vertical Scaling
- Single Next.js instance
- Single PostgreSQL instance
- Can handle 1000+ concurrent users
- ~1M properties without issue

### Future: Horizontal Scaling (If Needed)
1. Add read replicas for PostgreSQL
2. Use connection pooling (PgBouncer)
3. Add Redis for session storage
4. Load balance Next.js instances

### When to Scale
- Database CPU consistently >80%
- API response times >2 seconds
- More than 10k daily active users
- Data volume >100GB

## Development Workflow

### Local Development
```bash
# Start PostgreSQL (Docker)
docker-compose up -d postgres

# Run migrations
npm run db:migrate

# Start Next.js
npm run dev
```

### Testing Strategy
- Unit tests for business logic
- Integration tests for API routes
- E2E tests for critical paths
- No test coverage goals (quality > quantity)

### Deployment Pipeline
1. Push to main branch
2. Run tests in CI
3. Build Docker image
4. Deploy to staging
5. Manual production deploy

## Code Organization

```
src/
├── api/              # Next.js API routes
│   └── v1/          # Versioned endpoints
├── lib/             # Business logic
│   ├── db.ts        # Database client
│   ├── auth.ts      # Authentication
│   └── services/    # Domain services
├── types/           # TypeScript types
└── utils/           # Helper functions
```

### Key Patterns

#### Repository Pattern
```typescript
// Separate data access from business logic
class PropertyRepository {
  async findById(id: string) { }
  async search(criteria: SearchCriteria) { }
  async save(property: Property) { }
}
```

#### Service Layer
```typescript
// Business logic lives here
class PropertyAnalysisService {
  constructor(private repo: PropertyRepository) {}
  
  async analyzeInvestment(propertyId: string) {
    // Complex business logic
  }
}
```

#### Error Handling
```typescript
// Consistent error responses
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string
  ) {
    super(message);
  }
}
```

## Monitoring & Observability

### Metrics to Track
1. API response times (p50, p95, p99)
2. Database query performance
3. Error rates by endpoint
4. Data freshness by source
5. User activity patterns

### Logging Strategy
- Structured JSON logs
- Request ID for tracing
- No sensitive data in logs
- 30-day retention

### Alerting Rules
- API endpoint down >5 minutes
- Database connection failures
- Error rate >5% for 10 minutes
- Data sync failures

## Disaster Recovery

### Backup Strategy
- Daily PostgreSQL backups
- 30-day retention
- Test restore monthly
- Backup to different region

### Recovery Plans
- **Database corruption**: Restore from backup
- **Code regression**: Git revert and redeploy
- **Data breach**: Rotate all credentials
- **Service outage**: Failover to backup instance

## Technical Debt & Trade-offs

### Current Technical Debt
1. No automated testing for all endpoints
2. Manual deployment process
3. Basic error handling in some areas
4. Limited monitoring

### Accepted Trade-offs
1. **Monolith vs Microservices**: Simplicity wins
2. **Perfect vs Working**: Ship iteratively
3. **Generic vs Specific**: Build for our needs
4. **Scale vs Complexity**: Optimize when needed

## Future Considerations

### If We Grow 10x
1. Implement caching layer (Redis)
2. Split read/write databases
3. Add message queue for async work
4. Consider GraphQL for complex queries

### If We Pivot
1. API versioning strategy in place
2. Modular code for easy changes
3. Minimal external dependencies
4. Clear separation of concerns

---

**Remember**: This architecture is designed to be simple, reliable, and maintainable. Complexity is the enemy of reliability.