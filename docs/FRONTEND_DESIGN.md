# Frontend Design System Documentation

## Overview

The Real Estate Intelligence Platform uses a sophisticated **Nord Theme-inspired** design system that creates a professional, dark-optimized interface similar to modern IDEs. This design prioritizes data visibility, reduces eye strain during extended use, and maintains a clean, minimalist aesthetic focused on functionality over decoration.

## Design Philosophy

### Core Principles
1. **Professional Minimalism** - Clean interfaces focused on data and functionality
2. **Dark IDE Aesthetic** - Optimized for extended use with reduced eye strain  
3. **Data-First Design** - Clear hierarchy emphasizing important metrics
4. **Subtle Interactions** - Gentle hover states and transitions
5. **Accessibility** - Proper contrast ratios and focus management

### Visual Identity
- **Primary Palette**: Arctic-inspired Nord colors
- **Interaction Model**: Subtle, purposeful animations
- **Typography**: Single font family (Inter) with clear hierarchy
- **Spacing**: Consistent 4px base unit system

## Color Palette

### Foundation Colors (Nord Theme)

#### Polar Night (Dark Backgrounds)
```css
--nord0: hsl(220, 16%, 22%)  /* #2E3440 - Darkest background */
--nord1: hsl(222, 16%, 28%)  /* #3B4252 - Card backgrounds */
--nord2: hsl(220, 17%, 32%)  /* #434C5E - Secondary elements */
--nord3: hsl(220, 16%, 36%)  /* #4C566A - Borders/muted elements */
```

#### Snow Storm (Light Text)
```css
--nord4: hsl(219, 28%, 88%)  /* #D8DEE9 - Body text */
--nord5: hsl(218, 27%, 92%)  /* #E5E9F0 - Secondary text */
--nord6: hsl(218, 27%, 94%)  /* #ECEFF4 - Headers/emphasis */
```

#### Frost (Primary Accents)
```css
--nord7: hsl(179, 25%, 65%)  /* #8FBCBB - Secondary accent */
--nord8: hsl(193, 43%, 67%)  /* #88C0D0 - PRIMARY ACCENT ⭐ */
--nord9: hsl(210, 34%, 63%)  /* #81A1C1 - Alternative accent */
--nord10: hsl(213, 32%, 52%) /* #5E81AC - Dark accent */
```

#### Aurora (Status Colors)
```css
--nord11: hsl(354, 42%, 56%) /* #BF616A - Error/Destructive */
--nord12: hsl(14, 51%, 63%)  /* #D08770 - Warning */
--nord13: hsl(40, 71%, 73%)  /* #EBCB8B - Caution/Pending */
--nord14: hsl(92, 28%, 65%)  /* #A3BE8C - Success */
--nord15: hsl(311, 20%, 63%) /* #B48EAD - Info/Special */
```

### Application Color Mapping

```css
/* Semantic Color Assignments */
--background: hsl(220, 16%, 19%)      /* Main app background (darker than nord0) */
--card: hsl(222, 16%, 24%)           /* Card backgrounds */
--popover: hsl(222, 16%, 24%)        /* Popover/dropdown backgrounds */
--foreground: hsl(219, 28%, 88%)     /* Primary text (nord4) */
--card-foreground: hsl(218, 27%, 94%) /* Text on cards (nord6) */
--muted-foreground: hsl(219, 28%, 88%) /* Secondary text */
--primary: hsl(193, 43%, 67%)        /* Primary actions (nord8) */
--secondary: hsl(220, 17%, 32%)      /* Secondary elements (nord2) */
--accent: hsl(210, 34%, 63%)         /* Alternative accent (nord9) */
--border: hsl(220, 17%, 28%)         /* Default borders */
--input: hsl(220, 17%, 28%)          /* Input borders */
```

### Color Usage Guidelines

#### Text Colors
- **High Emphasis**: `hsl(218, 27%, 94%)` - Headers, important data
- **Medium Emphasis**: `hsl(219, 28%, 88%)` - Body text, descriptions
- **Low Emphasis**: `hsl(219, 28%, 88%)` - Secondary information
- **Interactive**: `hsl(193, 43%, 75%)` - Links, interactive elements

#### Status Colors
```css
/* Success States */
.success {
  background: hsl(92, 28%, 65%, 0.1);
  color: hsl(92, 28%, 65%);
  border: 1px solid hsl(92, 28%, 65%, 0.2);
}

/* Warning States */
.warning {
  background: hsl(40, 71%, 73%, 0.1);
  color: hsl(40, 71%, 73%);
  border: 1px solid hsl(40, 71%, 73%, 0.2);
}

/* Error States */
.error {
  background: hsl(354, 42%, 56%, 0.1);
  color: hsl(354, 42%, 56%);
  border: 1px solid hsl(354, 42%, 56%, 0.2);
}
```

## Typography

### Font System
```css
/* Primary Font Stack */
font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif;

/* Monospace for code/data */
font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
```

### Type Scale
| Usage | Size | Line Height | Weight | Class |
|-------|------|-------------|---------|-------|
| Display | 24px (1.5rem) | 1.2 | 600 | `text-2xl font-semibold` |
| Title | 20px (1.25rem) | 1.3 | 500 | `text-xl font-medium` |
| Heading | 18px (1.125rem) | 1.4 | 500 | `text-lg font-medium` |
| Body | 16px (1rem) | 1.5 | 400 | `text-base` |
| Small | 14px (0.875rem) | 1.4 | 400 | `text-sm` |
| Caption | 12px (0.75rem) | 1.3 | 400 | `text-xs` |

### Typography Implementation
```jsx
// Section Titles
<h3 className="text-lg md:text-xl font-medium mb-6 text-[hsl(193,43%,75%)] pb-3">
  Market Analysis
</h3>

// Data Labels  
<span className="text-sm text-[hsl(219,28%,88%)] font-medium">
  Property Value
</span>

// Primary Values
<p className="text-2xl font-bold text-[hsl(218,27%,94%)]">
  $750,000
</p>

// Change Indicators
<span className="text-sm text-[hsl(92,28%,65%)] font-medium">
  +5.2%
</span>
```

## Component System

### Technology Stack
- **CSS Framework**: Tailwind CSS v4 (latest)
- **Component Library**: shadcn/ui (New York variant)
- **Icons**: Lucide React + Heroicons
- **Configuration**: CSS-first approach with custom properties

### Core Components

#### 1. Data Cards
The foundation component for displaying information blocks.

```jsx
// Basic Data Card
<div className="data-card">
  <h4 className="font-medium text-[hsl(193,43%,75%)] mb-2">
    Property Value
  </h4>
  <p className="text-2xl font-bold text-[hsl(218,27%,94%)] mb-1">
    $750,000
  </p>
  <span className="text-sm text-[hsl(92,28%,65%)] flex items-center gap-1">
    <TrendingUp className="h-3 w-3" />
    +5.2%
  </span>
</div>
```

```css
/* Data Card Styling */
.data-card {
  background: hsl(222, 16%, 24%);
  border: 1px solid hsl(220, 17%, 28%);
  border-radius: 0.375rem;
  padding: 1rem;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.data-card:hover {
  border-color: hsl(193, 43%, 67%, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.08);
}
```

#### 2. Button Variants

```jsx
// Primary Button (most important actions)
<Button 
  variant="default"
  className="bg-[hsl(193,43%,67%)] text-[hsl(220,16%,22%)] hover:bg-[hsl(193,43%,60%)]"
>
  Analyze Property
</Button>

// Outline Button (secondary actions - most common)
<Button 
  variant="outline" 
  className="border-[hsl(193,43%,67%)] text-[hsl(193,43%,67%)] hover:bg-[hsl(193,43%,67%,0.1)]"
>
  View Details
</Button>

// Ghost Button (subtle actions)
<Button 
  variant="ghost"
  className="text-[hsl(219,28%,88%)] hover:bg-[hsl(193,43%,67%,0.1)]"
>
  Cancel
</Button>

// Destructive Button (delete/remove actions)
<Button 
  variant="destructive"
  className="bg-[hsl(354,42%,56%)] text-white hover:bg-[hsl(354,42%,50%)]"
>
  Delete
</Button>
```

#### 3. Status Badges

```jsx
// Success Badge
<Badge className="bg-[hsl(92,28%,65%,0.1)] text-[hsl(92,28%,65%)] border-[hsl(92,28%,65%,0.2)]">
  Active
</Badge>

// Warning Badge  
<Badge className="bg-[hsl(40,71%,73%,0.1)] text-[hsl(40,71%,73%)] border-[hsl(40,71%,73%,0.2)]">
  Pending
</Badge>

// Error Badge
<Badge className="bg-[hsl(354,42%,56%,0.1)] text-[hsl(354,42%,56%)] border-[hsl(354,42%,56%,0.2)]">
  Inactive
</Badge>
```

#### 4. Navigation

```jsx
// Main Navigation
<nav className="bg-[hsl(222,16%,24%)] border-b border-[hsl(220,17%,28%)]">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between h-16">
      <div className="flex items-center space-x-8">
        <h1 className="text-xl font-semibold text-[hsl(193,43%,75%)]">
          RE Intelligence
        </h1>
        <div className="hidden md:flex space-x-6">
          <NavLink href="/tools">Tools</NavLink>
          <NavLink href="/analysis">Analysis</NavLink>
        </div>
      </div>
    </div>
  </div>
</nav>
```

#### 5. Data Tables

```jsx
// Enhanced Table with hover states
<div className="table-container">
  <table className="table-enhanced">
    <thead>
      <tr className="border-b border-[hsl(220,17%,28%)]">
        <th className="text-left p-4 text-[hsl(218,27%,94%)] font-medium">
          Property
        </th>
        <th className="text-right p-4 text-[hsl(218,27%,94%)] font-medium">
          Value
        </th>
      </tr>
    </thead>
    <tbody>
      <tr className="border-b border-[hsl(220,17%,28%)] hover:bg-[hsl(193,43%,67%,0.05)]">
        <td className="p-4 text-[hsl(219,28%,88%)]">123 Main St</td>
        <td className="p-4 text-right text-[hsl(218,27%,94%)] font-medium">$750,000</td>
      </tr>
    </tbody>
  </table>
</div>
```

```css
/* Table Enhancements */
.table-container {
  background: hsl(222, 16%, 24%);
  border: 1px solid hsl(220, 17%, 28%);
  border-radius: 0.375rem;
  overflow: hidden;
}

.table-enhanced {
  width: 100%;
  border-collapse: collapse;
}

.table-enhanced tbody tr:hover {
  background: hsl(193, 43%, 67%, 0.05);
  transition: background-color 0.15s ease;
}
```

## Layout Patterns

### Grid System
```jsx
// Dashboard Layout (responsive)
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
  <MetricCard />
  <MetricCard />  
  <MetricCard />
</div>

// Data Grid (equal columns)
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <DataPoint />
  <DataPoint />
  <DataPoint />
  <DataPoint />
</div>

// Tool Cards (responsive)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <ToolCard />
  <ToolCard />
  <ToolCard />
</div>
```

### Container System
```jsx
// Page Container
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <PageContent />
</div>

// Content Container
<div className="max-w-4xl mx-auto">
  <MainContent />
</div>

// Narrow Container (forms, etc.)
<div className="max-w-2xl mx-auto">
  <FormContent />
</div>
```

## Interactive Elements

### Hover States
All interactive elements use consistent hover patterns:

```css
/* Standard hover transform */
.interactive-element:hover {
  transform: translateY(-1px);
  transition: all 0.2s ease;
}

/* Border color change */
.bordered-element:hover {
  border-color: hsl(193, 43%, 67%, 0.5);
}

/* Background overlay */
.overlay-element:hover {
  background: hsl(193, 43%, 67%, 0.1);
}
```

### Focus States
```css
/* Focus ring for accessibility */
.focusable:focus-visible {
  outline: 2px solid hsl(193, 43%, 67%);
  outline-offset: 2px;
}

/* Alternative focus style */
.focus-ring:focus-visible {
  ring: 2px;
  ring-color: hsl(193, 43%, 67%);
  ring-offset: 2px;
}
```

### Loading States
```jsx
// Skeleton loading
<div className="animate-pulse">
  <div className="h-4 bg-[hsl(220,17%,32%)] rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-[hsl(220,17%,32%)] rounded w-1/2"></div>
</div>

// Spinner loading
<div className="flex justify-center p-4">
  <div className="animate-spin h-6 w-6 border-2 border-[hsl(193,43%,67%)] border-t-transparent rounded-full"></div>
</div>
```

## Responsive Design

### Breakpoint Strategy
- **Mobile First**: Start with mobile layout
- **md: 768px+**: Tablet and small desktop
- **lg: 1024px+**: Large desktop
- **xl: 1280px+**: Extra large screens

### Common Responsive Patterns
```jsx
// Text sizing
<h1 className="text-xl md:text-2xl lg:text-3xl">
  Responsive Title
</h1>

// Grid responsiveness
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  
// Spacing adjustments
<div className="p-4 md:p-6 lg:p-8">

// Show/hide elements
<div className="hidden md:block">
  Desktop Only Content
</div>
```

## Animation Guidelines

### Transition Timing
- **Fast interactions**: 150ms (hover, focus)
- **Standard transitions**: 200ms (most UI changes)
- **Content changes**: 300ms (page transitions)
- **Never exceed**: 400ms

### Easing Functions
- **Standard**: `ease` - Most transitions
- **Smooth**: `ease-in-out` - Modal/page transitions
- **Snappy**: `ease-out` - Button interactions

## Accessibility Features

### Color Contrast
All color combinations meet WCAG AA standards:
- **Normal text**: 4.5:1 minimum ratio
- **Large text**: 3:1 minimum ratio
- **UI elements**: 3:1 minimum ratio

### Keyboard Navigation
- Tab order follows visual hierarchy
- All interactive elements are focusable
- Clear focus indicators on all controls
- Skip links for main content

### Screen Reader Support
- Semantic HTML structure
- Proper ARIA labels where needed
- Alt text for all meaningful images
- Status announcements for dynamic content

## Performance Considerations

### CSS Optimization
- Utility-first approach reduces CSS bundle size
- CSS custom properties enable efficient theming
- Critical CSS inlined for faster rendering

### Image Handling
- Next.js Image component for optimization
- Responsive images with srcset
- Lazy loading by default

## Implementation Guidelines

### CSS Custom Properties
All theme values use CSS custom properties for easy theming:

```css
:root {
  /* Color definitions */
  --color-nord0: 220, 16%, 22%;
  --color-primary: 193, 43%, 67%;
  
  /* Semantic assignments */
  --background: hsl(var(--color-nord0));
  --primary: hsl(var(--color-primary));
}
```

### Component Conventions
```jsx
// Always use semantic class names when creating reusable patterns
<div className="data-card metric-card">
  
// Combine utility classes with custom CSS classes
<button className="btn-primary bg-[hsl(193,43%,67%)] hover:bg-[hsl(193,43%,60%)]">

// Use Tailwind utilities for one-off styling
<div className="flex items-center justify-between p-4 border-b border-[hsl(220,17%,28%)]">
```

### Development Workflow
1. **Use Tailwind utilities** for layout and spacing
2. **Create CSS classes** for repeated patterns
3. **Use semantic class names** for component identification
4. **Test in multiple color schemes** (future-proofing)
5. **Validate accessibility** before implementing

---

## Quick Reference

### Primary Elements
```css
Primary Accent: hsl(193, 43%, 67%)
Background: hsl(220, 16%, 19%)
Card Background: hsl(222, 16%, 24%)
Text Color: hsl(219, 28%, 88%)
Border Color: hsl(220, 17%, 28%)
```

### Status Colors
```css
Success: hsl(92, 28%, 65%)
Warning: hsl(40, 71%, 73%)
Error: hsl(354, 42%, 56%)
```

### Common Classes
```css
.data-card          /* Standard data display card */
.section-title      /* Section headers with accent */
.status-badge       /* Status indicators */
.table-container    /* Enhanced table wrapper */
.btn-primary        /* Primary action button */
.metric-card        /* Numerical data display */
```

This design system creates a cohesive, professional interface that prioritizes data visibility and user experience while maintaining the sophisticated Nord aesthetic throughout the application.