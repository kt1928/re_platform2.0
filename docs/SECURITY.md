# Security Guidelines

## 🔴 CRITICAL: This is an INTERNAL-ONLY System

This platform contains proprietary investment data, financial analysis, and strategic information. **There are NO public endpoints.** Every piece of data is confidential.

## Security Principles

1. **Zero Trust** - Verify everything, trust nothing
2. **Defense in Depth** - Multiple layers of security
3. **Least Privilege** - Minimum access required
4. **Audit Everything** - If it's not logged, it didn't happen
5. **Fail Secure** - When in doubt, deny access

## Authentication & Authorization

### Authentication Flow
```
1. User provides email/password
2. Validate against bcrypt hash (cost factor: 12)
3. Generate JWT token (expires in 24 hours)
4. Include user role and permissions in token
5. Require token for ALL API requests
```

### JWT Token Structure
```json
{
  "sub": "user-uuid",
  "email": "user@company.com",
  "role": "analyst",
  "permissions": ["read:properties", "write:analyses"],
  "iat": 1642255200,
  "exp": 1642341600
}
```

### Role-Based Access Control (RBAC)

| Role    | Permissions                                      |
|---------|--------------------------------------------------|
| viewer  | Read properties, view analyses                   |
| analyst | All viewer + create analyses, manage portfolios  |
| admin   | All analyst + manage users, system config        |

### Implementation
```typescript
// Middleware for route protection
export async function requireRole(role: string) {
  return async (req: NextRequest) => {
    const user = await authenticate(req);
    
    if (!user) {
      throw new AuthError('Unauthorized', 401);
    }
    
    if (!hasRole(user, role)) {
      throw new AuthError('Forbidden', 403);
    }
    
    return user;
  };
}

// Usage in API route
export async function POST(req: NextRequest) {
  const user = await requireRole('admin')(req);
  // Admin-only logic here
}
```

## Data Protection

### Encryption

#### At Rest
- Database: Encrypted with AES-256
- Backups: Encrypted before storage
- Local files: Full disk encryption required

#### In Transit
- HTTPS only (TLS 1.3 minimum)
- Certificate pinning for mobile apps
- No HTTP fallback ever

#### Application Level
```typescript
// Encrypt sensitive fields
import { encrypt, decrypt } from '@/lib/crypto';

// Before storing
const encryptedSSN = encrypt(ssn, process.env.ENCRYPTION_KEY);

// When retrieving
const ssn = decrypt(encryptedSSN, process.env.ENCRYPTION_KEY);
```

### Data Classification

| Level        | Examples                    | Protection Required           |
|--------------|----------------------------|------------------------------|
| Critical     | Passwords, API keys        | Encrypted, never logged      |
| Confidential | Financial data, PII        | Encrypted, audit trail       |
| Internal     | Property data, analyses    | Access control, logging      |
| Public       | None in this system        | N/A                         |

## Input Validation & Sanitization

### Never Trust User Input

```typescript
// Bad - SQL Injection risk
const query = `SELECT * FROM properties WHERE zip = '${userInput}'`;

// Good - Parameterized query
const properties = await prisma.property.findMany({
  where: { zip_code: validatedZipCode }
});
```

### Validation Rules

```typescript
// Use Zod for all input validation
const propertySchema = z.object({
  address: z.string()
    .min(5)
    .max(200)
    .regex(/^[a-zA-Z0-9\s,.-]+$/), // Alphanumeric + basic punctuation
  
  zip_code: z.string()
    .regex(/^\d{5}(-\d{4})?$/),
  
  price: z.number()
    .positive()
    .max(1_000_000_000), // Prevent overflow
    
  description: z.string()
    .transform(sanitizeHtml) // Remove any HTML/scripts
});
```

### File Upload Security

```typescript
// Validate file uploads
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
const maxSize = 10 * 1024 * 1024; // 10MB

if (!allowedTypes.includes(file.type)) {
  throw new ValidationError('Invalid file type');
}

if (file.size > maxSize) {
  throw new ValidationError('File too large');
}

// Generate unique filename (never use user input)
const filename = `${uuid()}_${Date.now()}.${extension}`;
```

## API Security

### Rate Limiting

```typescript
// Per-user rate limits
const limits = {
  viewer: { requests: 100, window: '1m' },
  analyst: { requests: 200, window: '1m' },
  admin: { requests: 500, window: '1m' }
};

// Implementation
export async function rateLimit(req: NextRequest) {
  const user = await authenticate(req);
  const key = `rate_limit:${user.id}`;
  
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 60); // 1 minute
  }
  
  const limit = limits[user.role].requests;
  if (current > limit) {
    throw new RateLimitError('Too many requests');
  }
}
```

### CORS Policy

```typescript
// Next.js middleware
export function middleware(request: NextRequest) {
  // NO CORS - Internal only
  const response = NextResponse.next();
  
  // Strict CSP
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}
```

## Secrets Management

### Environment Variables

```bash
# .env.local (NEVER commit this)
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=<64-character-random-string>
ENCRYPTION_KEY=<32-character-random-string>
GOOGLE_MAPS_API_KEY=<api-key>
ZILLOW_API_KEY=<api-key>
```

### Secrets Rotation

1. Database passwords: Rotate monthly
2. JWT secrets: Rotate quarterly (with grace period)
3. API keys: Rotate when employee leaves
4. Encryption keys: Rotate annually (re-encrypt data)

### Code Security

```typescript
// Bad - Hardcoded secret
const apiKey = 'sk_live_abcd1234';

// Bad - Secret in error message
throw new Error(`API call failed with key: ${apiKey}`);

// Good - Use environment variables
const apiKey = process.env.ZILLOW_API_KEY;
if (!apiKey) {
  throw new Error('Missing required configuration');
}
```

## Audit Logging

### What to Log

```typescript
// Every data modification
await auditLog({
  user_id: user.id,
  action: 'UPDATE',
  table: 'properties',
  record_id: property.id,
  old_data: oldProperty,
  new_data: newProperty,
  ip_address: req.ip,
  user_agent: req.headers['user-agent']
});

// Every access attempt
await accessLog({
  user_id: user?.id,
  endpoint: req.url,
  method: req.method,
  status_code: res.status,
  duration_ms: performance.now() - start,
  ip_address: req.ip
});
```

### What NOT to Log

- Passwords (ever)
- Full credit card numbers
- API keys or tokens
- Detailed PII (use identifiers instead)

## Session Management

### Session Configuration

```typescript
// NextAuth configuration
export const authOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.permissions = user.permissions;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.role = token.role;
      session.user.permissions = token.permissions;
      return session;
    }
  }
};
```

### Session Security

- Regenerate session ID on login
- Invalidate sessions on logout
- Clear sessions on password change
- Monitor for concurrent sessions

## Vulnerability Prevention

### SQL Injection
✅ Use Prisma ORM exclusively
✅ Never concatenate SQL strings
✅ Validate all inputs
❌ Don't use raw SQL unless absolutely necessary

### XSS (Cross-Site Scripting)
✅ Sanitize all user input
✅ Use React's built-in escaping
✅ Set Content-Security-Policy headers
❌ Don't use dangerouslySetInnerHTML

### CSRF (Cross-Site Request Forgery)
✅ Use SameSite cookies
✅ Verify Origin header
✅ Include CSRF tokens in forms
❌ Don't rely on cookies alone for auth

### Directory Traversal
✅ Use path.join() for file paths
✅ Validate against whitelist
✅ Use unique generated filenames
❌ Don't use user input in file paths

## Incident Response

### Security Incident Checklist

1. **Detect & Contain**
   - [ ] Identify scope of breach
   - [ ] Isolate affected systems
   - [ ] Preserve evidence

2. **Assess Impact**
   - [ ] What data was accessed?
   - [ ] How many users affected?
   - [ ] Timeline of events

3. **Respond**
   - [ ] Patch vulnerability
   - [ ] Reset affected credentials
   - [ ] Notify affected users (if required)

4. **Recovery**
   - [ ] Restore from clean backups
   - [ ] Monitor for suspicious activity
   - [ ] Update security measures

5. **Post-Mortem**
   - [ ] Document what happened
   - [ ] Identify root cause
   - [ ] Update procedures

## Development Security

### Code Review Checklist

- [ ] No hardcoded secrets
- [ ] All inputs validated
- [ ] Authentication checks present
- [ ] Sensitive operations logged
- [ ] Error messages don't leak info
- [ ] Dependencies up to date

### Dependency Management

```bash
# Check for vulnerabilities weekly
npm audit

# Update dependencies monthly
npm update

# Review dependency changes
npm diff <package>
```

### Security Testing

```typescript
// Test authentication
describe('API Security', () => {
  it('should reject unauthenticated requests', async () => {
    const res = await fetch('/api/v1/properties');
    expect(res.status).toBe(401);
  });

  it('should prevent SQL injection', async () => {
    const malicious = "'; DROP TABLE properties; --";
    const res = await fetch(`/api/v1/properties?zip=${malicious}`);
    expect(res.status).toBe(400); // Validation error
  });

  it('should rate limit excessive requests', async () => {
    for (let i = 0; i < 150; i++) {
      await fetch('/api/v1/properties');
    }
    const res = await fetch('/api/v1/properties');
    expect(res.status).toBe(429);
  });
});
```

## Compliance

### Data Privacy
- Right to access data (export user data)
- Right to deletion (hard delete with audit trail)
- Data minimization (only collect what's needed)
- Purpose limitation (use data only as intended)

### Financial Regulations
- Maintain audit trails for 7 years
- Implement proper access controls
- Regular security assessments
- Incident response procedures

---

**Remember**: Security is not a feature, it's a requirement. Every line of code should be written with security in mind. When in doubt, deny access.