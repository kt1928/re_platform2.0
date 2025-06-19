# Database Design

## Schema Philosophy

1. **Normalize until it hurts, then denormalize until it works**
2. **Use constraints, not application logic, for data integrity**
3. **Design for queries we run, not data we store**
4. **Audit everything that matters**

## Core Schema

### Users & Authentication

```sql
-- Users table: Core user information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'analyst',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    CONSTRAINT valid_role CHECK (role IN ('admin', 'analyst', 'viewer'))
);

-- Audit trail for all data changes
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_action CHECK (action IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- API keys for system integrations
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);
```

### Property Data

```sql
-- Properties: Core property information
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(100), -- Zillow ID, MLS number, etc.
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Property details
    property_type VARCHAR(50) NOT NULL,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    square_feet INTEGER,
    lot_size INTEGER,
    year_built INTEGER,
    
    -- Financial data
    list_price DECIMAL(12, 2),
    sold_price DECIMAL(12, 2),
    rent_estimate DECIMAL(10, 2),
    tax_assessed_value DECIMAL(12, 2),
    
    -- Metadata
    data_source VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_property_type CHECK (
        property_type IN ('single_family', 'condo', 'townhouse', 'multi_family', 'land', 'commercial')
    ),
    CONSTRAINT valid_state CHECK (state ~ '^[A-Z]{2}$'),
    CONSTRAINT valid_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR 
        (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
);

-- Property history: Track all changes over time
CREATE TABLE property_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(50)
);

-- Market comparables
CREATE TABLE comparables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    comparable_property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    similarity_score DECIMAL(3, 2) NOT NULL,
    distance_miles DECIMAL(5, 2),
    price_difference DECIMAL(12, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_similarity CHECK (similarity_score BETWEEN 0 AND 1),
    CONSTRAINT no_self_comparison CHECK (subject_property_id != comparable_property_id),
    UNIQUE(subject_property_id, comparable_property_id)
);
```

### Market Data

```sql
-- ZIP code level market metrics
CREATE TABLE market_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zip_code VARCHAR(10) NOT NULL,
    metric_date DATE NOT NULL,
    
    -- Price metrics
    median_sale_price DECIMAL(12, 2),
    median_rent DECIMAL(10, 2),
    price_per_sqft DECIMAL(8, 2),
    
    -- Volume metrics
    sales_count INTEGER,
    new_listings_count INTEGER,
    days_on_market INTEGER,
    
    -- Inventory
    active_listings INTEGER,
    months_of_supply DECIMAL(4, 2),
    
    -- Year-over-year changes
    price_change_yoy DECIMAL(5, 2),
    sales_volume_change_yoy DECIMAL(5, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(zip_code, metric_date)
);

-- Building permits and construction
CREATE TABLE building_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permit_number VARCHAR(100) UNIQUE NOT NULL,
    property_id UUID REFERENCES properties(id),
    permit_type VARCHAR(100) NOT NULL,
    work_description TEXT,
    estimated_cost DECIMAL(12, 2),
    issue_date DATE,
    completion_date DATE,
    status VARCHAR(50),
    
    -- Location if property not matched
    address TEXT,
    zip_code VARCHAR(10),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Neighborhood demographics
CREATE TABLE demographics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zip_code VARCHAR(10) NOT NULL,
    data_year INTEGER NOT NULL,
    
    -- Population
    total_population INTEGER,
    population_density DECIMAL(10, 2),
    
    -- Income
    median_household_income DECIMAL(10, 2),
    per_capita_income DECIMAL(10, 2),
    poverty_rate DECIMAL(5, 2),
    
    -- Employment
    unemployment_rate DECIMAL(5, 2),
    
    -- Housing
    owner_occupied_rate DECIMAL(5, 2),
    median_home_value DECIMAL(12, 2),
    
    -- Education
    bachelors_degree_rate DECIMAL(5, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(zip_code, data_year)
);
```

### Investment Analysis

```sql
-- Investment portfolios
CREATE TABLE portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    target_return DECIMAL(5, 2),
    risk_tolerance VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_risk CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive'))
);

-- Portfolio properties
CREATE TABLE portfolio_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id),
    
    -- Acquisition details
    purchase_date DATE NOT NULL,
    purchase_price DECIMAL(12, 2) NOT NULL,
    down_payment DECIMAL(12, 2),
    loan_amount DECIMAL(12, 2),
    interest_rate DECIMAL(5, 3),
    
    -- Current status
    current_value DECIMAL(12, 2),
    monthly_rent DECIMAL(10, 2),
    occupancy_status VARCHAR(20),
    
    -- Performance metrics
    total_return DECIMAL(12, 2),
    annualized_return DECIMAL(5, 2),
    cash_on_cash_return DECIMAL(5, 2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(portfolio_id, property_id)
);

-- Investment analysis runs
CREATE TABLE analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id),
    user_id UUID REFERENCES users(id),
    analysis_type VARCHAR(50) NOT NULL,
    
    -- Inputs
    purchase_price DECIMAL(12, 2),
    down_payment_percent DECIMAL(5, 2),
    interest_rate DECIMAL(5, 3),
    loan_term_years INTEGER,
    
    -- Assumptions
    rent_growth_rate DECIMAL(5, 2),
    expense_growth_rate DECIMAL(5, 2),
    vacancy_rate DECIMAL(5, 2),
    management_fee_rate DECIMAL(5, 2),
    
    -- Results
    monthly_cash_flow DECIMAL(10, 2),
    cap_rate DECIMAL(5, 2),
    cash_on_cash_return DECIMAL(5, 2),
    irr DECIMAL(5, 2),
    break_even_year INTEGER,
    
    -- Full results
    detailed_results JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Data Quality & Monitoring

```sql
-- Data quality checks
CREATE TABLE data_quality_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID,
    issue_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    details JSONB,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT valid_severity CHECK (severity IN ('critical', 'warning', 'info'))
);

-- External API sync status
CREATE TABLE sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_source VARCHAR(50) NOT NULL,
    sync_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL,
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    
    CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed'))
);
```

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_properties_zip ON properties(zip_code);
CREATE INDEX idx_properties_location ON properties USING GIST (
    ST_MakePoint(longitude, latitude)
);
CREATE INDEX idx_property_history_property ON property_history(property_id);
CREATE INDEX idx_market_metrics_zip_date ON market_metrics(zip_code, metric_date DESC);
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);

-- Search indexes
CREATE INDEX idx_properties_address ON properties USING GIN (
    to_tsvector('english', address_line1 || ' ' || city || ' ' || state)
);
```

## Views

```sql
-- Current property values with latest metrics
CREATE VIEW property_current_values AS
SELECT 
    p.*,
    COALESCE(p.sold_price, p.list_price, p.tax_assessed_value) as estimated_value,
    m.median_sale_price as zip_median_price,
    m.price_per_sqft as zip_price_per_sqft,
    m.days_on_market as zip_days_on_market
FROM properties p
LEFT JOIN LATERAL (
    SELECT * FROM market_metrics 
    WHERE zip_code = p.zip_code 
    ORDER BY metric_date DESC 
    LIMIT 1
) m ON true;

-- Portfolio performance summary
CREATE VIEW portfolio_performance AS
SELECT 
    p.id,
    p.name,
    COUNT(pp.id) as property_count,
    SUM(pp.purchase_price) as total_invested,
    SUM(pp.current_value) as total_value,
    SUM(pp.monthly_rent) as total_monthly_rent,
    AVG(pp.annualized_return) as avg_return,
    SUM(pp.current_value) - SUM(pp.purchase_price) as unrealized_gain
FROM portfolios p
LEFT JOIN portfolio_properties pp ON p.id = pp.portfolio_id
GROUP BY p.id, p.name;
```

## Migration Strategy

### From JSON Files to PostgreSQL

1. **Create staging tables** matching JSON structure
2. **Load JSON data** using PostgreSQL's COPY with JSON format
3. **Transform and validate** data in staging
4. **Insert into final tables** with proper constraints
5. **Verify data integrity** with checksums

### Rollback Plan

1. Keep JSON files as backup for 90 days
2. Create database snapshots before major migrations
3. Test rollback procedures monthly
4. Maintain compatibility layer during transition

## Performance Considerations

### Expected Data Volumes

- Properties: 1-10 million records
- Property History: 50+ million records
- Market Metrics: 5 million records (500 ZIPs × 10 years × 365 days)
- Analyses: 100k+ records

### Optimization Strategies

1. **Partition large tables** by date (property_history, audit_logs)
2. **Use materialized views** for expensive aggregations
3. **Archive old data** after 2 years to cold storage
4. **Vacuum regularly** to maintain performance

## Security

### Access Control

```sql
-- Row-level security for multi-tenant data
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY properties_access ON properties
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM portfolio_properties pp
            JOIN portfolios p ON pp.portfolio_id = p.id
            WHERE pp.property_id = properties.id
            AND p.user_id = current_user_id()
        )
        OR current_user_role() = 'admin'
    );
```

### Sensitive Data

- Passwords: bcrypt with cost factor 12
- API keys: SHA-256 hashed
- PII: Encrypted at rest
- Financial data: Audit trail required

## Backup & Recovery

### Backup Schedule

- **Full backup**: Daily at 2 AM EST
- **Incremental**: Every 6 hours
- **Transaction logs**: Continuous archival
- **Retention**: 30 days hot, 1 year cold

### Recovery Procedures

1. **Point-in-time recovery** to any second within 30 days
2. **Logical backups** using pg_dump for portability
3. **Test restores** monthly to verify backups
4. **Cross-region replication** for disaster recovery

---

**Remember**: The database is our source of truth. Design it right the first time because migrations are painful and risky.