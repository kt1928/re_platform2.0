# UI Component Specifications

## Component Architecture Philosophy

The frontend uses a **component-driven design** built on shadcn/ui foundations with heavy customization for the Nord theme. Each component is designed to be:

1. **Reusable** - Clear props interface and flexible styling
2. **Accessible** - WCAG compliant with proper ARIA support  
3. **Consistent** - Follows established design patterns
4. **Performant** - Optimized for real-world usage

## Core Component Library

### 1. Data Display Components

#### MetricCard
Primary component for displaying numerical data with context.

```jsx
<MetricCard
  title="Property Value"
  value="$750,000"
  change="+5.2%"
  trend="up"
  subtitle="vs last month"
  icon={TrendingUp}
  color="success" // success | warning | error | neutral
/>
```

**Props Interface:**
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  icon?: LucideIcon;
  color?: 'success' | 'warning' | 'error' | 'neutral';
  loading?: boolean;
  className?: string;
}
```

**Visual Specifications:**
- Background: `hsl(222, 16%, 24%)`
- Border: `1px solid hsl(220, 17%, 28%)`
- Padding: `1rem`
- Border radius: `0.375rem`
- Hover: Subtle lift with `translateY(-1px)`

#### PropertyCard
Specialized card for property listings and details.

```jsx
<PropertyCard
  property={{
    id: "prop-123",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    zipCode: "10001",
    price: 750000,
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1200,
    propertyType: "Condo"
  }}
  showAnalyzeButton={true}
  onAnalyze={(propertyId) => {}}
  variant="compact" // compact | full | summary
/>
```

#### DataTable
Enhanced table component with sorting, filtering, and pagination.

```jsx
<DataTable
  columns={[
    { key: 'address', label: 'Address', sortable: true },
    { key: 'price', label: 'Price', sortable: true, format: 'currency' },
    { key: 'bedrooms', label: 'Beds', align: 'center' }
  ]}
  data={properties}
  pagination={{
    page: 1,
    limit: 20,
    total: 500
  }}
  onSort={(column, direction) => {}}
  onPageChange={(page) => {}}
  loading={false}
  emptyMessage="No properties found"
/>
```

### 2. Navigation Components

#### MainNavigation
Top-level navigation bar with responsive behavior.

```jsx
<MainNavigation
  title="RE Intelligence"
  links={[
    { href: '/tools', label: 'Tools', active: true },
    { href: '/analysis', label: 'Analysis' },
    { href: '/portfolio', label: 'Portfolio' }
  ]}
  user={{
    name: "John Doe",
    email: "john@company.com",
    role: "analyst"
  }}
  onSignOut={() => {}}
/>
```

**Features:**
- Mobile hamburger menu
- User dropdown menu  
- Active link highlighting
- Responsive breakpoints

#### Breadcrumb
Context navigation for deep pages.

```jsx
<Breadcrumb
  items={[
    { label: 'Tools', href: '/tools' },
    { label: 'Location Analysis', href: '/tools/location-analysis' },
    { label: '123 Main St', href: null } // current page
  ]}
/>
```

### 3. Form Components

#### PropertySearchForm
Specialized search form for property filtering.

```jsx
<PropertySearchForm
  initialValues={{
    query: "",
    zipCode: "",
    minPrice: null,
    maxPrice: null,
    bedrooms: null,
    propertyType: "all"
  }}
  onSearch={(filters) => {}}
  onReset={() => {}}
  loading={false}
/>
```

#### InvestmentAnalysisForm
Complex form for investment calculations.

```jsx
<InvestmentAnalysisForm
  propertyId="prop-123"
  initialData={{
    purchasePrice: 750000,
    downPaymentPercent: 20,
    interestRate: 6.5,
    loanTermYears: 30
  }}
  onSubmit={(data) => {}}
  onSave={(data) => {}} // Save as draft
  loading={false}
  errors={{}}
/>
```

### 4. Utility Components

#### StatusBadge
Consistent status indication across the app.

```jsx
<StatusBadge
  status="active" // active | pending | inactive | error
  size="sm" // sm | md | lg
  variant="solid" // solid | outline | subtle
/>
```

**Status Mappings:**
- `active` → Success green (`hsl(92, 28%, 65%)`)
- `pending` → Warning yellow (`hsl(40, 71%, 73%)`)
- `inactive` → Neutral gray
- `error` → Error red (`hsl(354, 42%, 56%)`)

#### LoadingSpinner
Consistent loading indicator.

```jsx
<LoadingSpinner
  size="md" // sm | md | lg
  color="primary" // primary | white | muted
  message="Loading properties..." // optional
/>
```

#### EmptyState
User-friendly empty state displays.

```jsx
<EmptyState
  icon={Home}
  title="No properties found"
  description="Try adjusting your search criteria or add new properties."
  action={{
    label: "Add Property",
    onClick: () => {}
  }}
/>
```

### 5. Modal & Overlay Components

#### Modal
Base modal component with backdrop and animations.

```jsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Property Analysis"
  size="lg" // sm | md | lg | xl | full
  closeOnBackdrop={true}
>
  <ModalContent />
</Modal>
```

#### Popover
Context menus and dropdowns.

```jsx
<Popover
  trigger={<Button>Options</Button>}
  content={
    <PopoverContent>
      <PopoverItem onClick={handleEdit}>Edit</PopoverItem>
      <PopoverItem onClick={handleDelete} variant="destructive">
        Delete
      </PopoverItem>
    </PopoverContent>
  }
  placement="bottom-end"
/>
```

### 6. Chart & Visualization Components

#### TrendChart
Line chart for displaying trends over time.

```jsx
<TrendChart
  data={[
    { date: '2024-01', value: 500000 },
    { date: '2024-02', value: 525000 },
    { date: '2024-03', value: 515000 }
  ]}
  xAxis="date"
  yAxis="value"
  title="Property Value Trend"
  height={300}
  color="primary"
  formatValue={(value) => `$${value.toLocaleString()}`}
/>
```

#### ComparisonBar
Horizontal bar chart for comparing metrics.

```jsx
<ComparisonBar
  items={[
    { label: 'Subject Property', value: 750000, color: 'primary' },
    { label: 'Comparable 1', value: 725000, color: 'muted' },
    { label: 'Comparable 2', value: 780000, color: 'muted' }
  ]}
  maxValue={800000}
  formatValue={(value) => `$${value.toLocaleString()}`}
/>
```

## Component Composition Patterns

### 1. Dashboard Layout Pattern

```jsx
<DashboardLayout>
  <DashboardHeader>
    <Breadcrumb items={breadcrumbItems} />
    <div className="flex gap-2">
      <Button variant="outline">Export</Button>
      <Button>New Analysis</Button>
    </div>
  </DashboardHeader>
  
  <DashboardContent>
    <MetricsGrid>
      <MetricCard {...metricProps} />
      <MetricCard {...metricProps} />
      <MetricCard {...metricProps} />
    </MetricsGrid>
    
    <ContentGrid>
      <PropertyTable data={properties} />
      <TrendChart data={trends} />
    </ContentGrid>
  </DashboardContent>
</DashboardLayout>
```

### 2. Form Layout Pattern

```jsx
<FormLayout>
  <FormHeader>
    <h2>Investment Analysis</h2>
    <p>Calculate potential returns for this property</p>
  </FormHeader>
  
  <FormContent>
    <FormSection title="Purchase Details">
      <FormGrid cols={2}>
        <FormField>
          <Label>Purchase Price</Label>
          <Input type="number" placeholder="750000" />
        </FormField>
        <FormField>
          <Label>Down Payment %</Label>
          <Input type="number" placeholder="20" />
        </FormField>
      </FormGrid>
    </FormSection>
    
    <FormSection title="Financing">
      {/* More form fields */}
    </FormSection>
  </FormContent>
  
  <FormActions>
    <Button variant="outline">Save Draft</Button>
    <Button type="submit">Calculate</Button>
  </FormActions>
</FormLayout>
```

### 3. Data Display Pattern

```jsx
<DataLayout>
  <DataHeader>
    <DataTitle>Property Analysis Results</DataTitle>
    <DataActions>
      <Button variant="outline" size="sm">
        <Share className="h-4 w-4 mr-2" />
        Share
      </Button>
      <Button variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        Export
      </Button>
    </DataActions>
  </DataHeader>
  
  <DataGrid>
    <DataCard title="Cash Flow Analysis">
      <MetricCard {...cashFlowMetrics} />
    </DataCard>
    
    <DataCard title="Comparable Properties">
      <ComparisonTable data={comparables} />
    </DataCard>
    
    <DataCard title="Market Trends">
      <TrendChart data={marketData} />
    </DataCard>
  </DataGrid>
</DataLayout>
```

## Responsive Component Behavior

### Breakpoint-Specific Rendering

```jsx
// MetricCard responsive behavior
<MetricCard
  className={cn(
    "col-span-1", // Mobile: full width
    "md:col-span-1", // Tablet: 1/3 width
    "lg:col-span-1" // Desktop: 1/4 width
  )}
  layout={{
    mobile: "stacked", // Icon, title, value stacked
    desktop: "inline" // Icon and content side-by-side
  }}
/>

// DataTable responsive behavior
<DataTable
  columns={columns}
  responsiveColumns={{
    mobile: ['address', 'price'], // Show only essential columns
    tablet: ['address', 'price', 'bedrooms', 'bathrooms'],
    desktop: [...allColumns] // Show all columns
  }}
  cardView={{
    enabled: true,
    breakpoint: 'md' // Switch to card view below tablet
  }}
/>
```

### Mobile-First Components

```jsx
// Navigation responsive pattern
<Navigation>
  {/* Mobile: Hamburger menu */}
  <MobileNav className="md:hidden">
    <MenuButton />
    <MobileMenu items={navItems} />
  </MobileNav>
  
  {/* Desktop: Horizontal nav */}
  <DesktopNav className="hidden md:flex">
    <NavItems items={navItems} />
  </DesktopNav>
</Navigation>
```

## Component State Management

### Loading States

```jsx
// Component with loading states
const PropertyCard = ({ propertyId, loading }) => {
  if (loading) {
    return (
      <div className="data-card">
        <Skeleton className="h-6 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2 mb-4" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  
  return <PropertyCardContent {...props} />;
};
```

### Error States

```jsx
// Component with error handling
const DataTable = ({ data, error, retry }) => {
  if (error) {
    return (
      <ErrorState
        title="Failed to load data"
        description={error.message}
        action={{
          label: "Try Again",
          onClick: retry
        }}
      />
    );
  }
  
  return <TableContent data={data} />;
};
```

## Component Testing Patterns

### Unit Test Structure

```javascript
// Component test example
describe('MetricCard', () => {
  it('displays metric data correctly', () => {
    render(
      <MetricCard
        title="Property Value"
        value="$750,000"
        change="+5.2%"
        trend="up"
      />
    );
    
    expect(screen.getByText('Property Value')).toBeInTheDocument();
    expect(screen.getByText('$750,000')).toBeInTheDocument();
    expect(screen.getByText('+5.2%')).toBeInTheDocument();
  });

  it('handles loading state', () => {
    render(<MetricCard loading={true} />);
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('supports keyboard navigation', () => {
    render(<MetricCard clickable onClick={jest.fn()} />);
    const card = screen.getByRole('button');
    expect(card).toHaveFocus();
  });
});
```

## Performance Optimization

### Code Splitting

```jsx
// Lazy load heavy components
const InvestmentAnalysisForm = lazy(() => 
  import('./InvestmentAnalysisForm')
);

const PropertyAnalysis = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <InvestmentAnalysisForm />
  </Suspense>
);
```

### Memoization

```jsx
// Memoize expensive calculations
const PropertyCard = memo(({ property }) => {
  const formattedPrice = useMemo(() => 
    formatCurrency(property.price), 
    [property.price]
  );
  
  return <CardContent price={formattedPrice} />;
});
```

---

## Implementation Checklist

When implementing components:

- [ ] **Props interface defined** with TypeScript
- [ ] **Responsive behavior** specified  
- [ ] **Loading states** implemented
- [ ] **Error states** handled
- [ ] **Accessibility** compliance verified
- [ ] **Unit tests** written
- [ ] **Storybook stories** created (if applicable)
- [ ] **Performance** optimized
- [ ] **Design system** compliance verified

This component system provides a solid foundation for building consistent, accessible, and maintainable user interfaces that align with the Nord theme design language.