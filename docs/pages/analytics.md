# Analytics Page

**Route**: `/analytics`
**File**: `src/app/(dashboard)/analytics/page.tsx`
**Client Component**: `src/app/(dashboard)/analytics/client.tsx`

## Overview
The analytics page provides visual financial insights through charts and graphs, showing income vs expenses trends, expense distribution by category, and savings patterns over time.

## Features
- **KPI Cards**:
  - Current month income
  - Current month expenses
  - Monthly savings (surplus/deficit)
  - Savings rate percentage
- **Charts**:
  - **Bar Chart**: Income vs Expenses comparison (6 months)
  - **Pie Chart**: Expense distribution by category
  - **Line Chart**: Monthly trend (income, expenses, savings)
- **Interactive Tooltips**: Hover for detailed values
- **Empty States**: Graceful handling when no data available

## Components Used
| Component | Purpose |
|-----------|---------|
| `Card`, `CardHeader`, `CardContent` | Container components |
| `Recharts Components` | BarChart, LineChart, PieChart, etc. |
| `ArrowUpRight`, `ArrowDownRight`, `PiggyBank`, `TrendingUp` | KPI icons |
| `BarChart3`, `PieChart`, `LineChart` | Chart section icons |
| `useSettings` | Currency formatting |
| `useTranslations` | Internationalization |

## Server Actions Used
| Action | Purpose |
|--------|---------|
| `getMonthlyOverview` | Gets monthly income/expense data for 6 months |
| `getCategoryBreakdown` | Gets current month category distribution |

## Chart Types

### Bar Chart (Income vs Expenses)
- **X-axis**: Months (last 6 months)
- **Y-axis**: Amount in currency
- **Bars**: Green for income, Red for expenses
- **Features**: Tooltips, legend, responsive grid

### Pie Chart (Category Distribution)
- **Inner donut**: Hollow center for visual appeal
- **Segments**: Colored by category color (or amber palette)
- **Legend**: Category list with amounts and percentages
- **Max displayed**: Top 7 categories

### Line Chart (Monthly Trend)
- **X-axis**: Months
- **Y-axis**: Amount in currency
- **Lines**: 
  - Income (solid green)
  - Expenses (solid red)
  - Savings (dashed amber)
- **Features**: Dots at data points, interactive tooltips

## Data Structures

### MonthlyTrendItem
```typescript
interface MonthlyTrendItem {
  month: string;      // Short month name (e.g., "Jan")
  income: number;
  expenses: number;
  savings: number;    // income - expenses
}
```

### CategoryItem
```typescript
interface CategoryItem {
  name: string;
  amount: number;
  percentage: number;
  color: string | null;
  icon: string | null;
}
```

## Color Palette
Default amber palette for categories without custom colors:
```javascript
['#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e', '#fcd34d', '#fde68a', '#78350f']
```

## User Interactions
- View financial KPIs at a glance
- Analyze income vs expenses over time
- Understand spending distribution by category
- Track savings trends
- Hover charts for detailed tooltips

## Related Pages
- [Dashboard](./dashboard.md) - Quick KPI overview
- [Overview](./overview.md) - Detailed monthly breakdown
- [Categories](./categories.md) - Manage expense categories
