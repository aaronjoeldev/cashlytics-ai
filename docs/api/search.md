# Search API

This document covers the global search server action.

## File

**Path**: `src/actions/search-actions.ts`  
**Type**: Server Action

---

## Overview

Provides global search functionality across all financial entities in the application. Returns unified search results sorted by entity type relevance.

### Functions

#### globalSearch

Searches across accounts, expenses, daily expenses, incomes, and transfers.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | `string` | Yes | Search query (minimum 2 characters) |

**Returns**: `Promise<SearchResult[]>`

```typescript
interface SearchResult {
  id: string;
  type: 'account' | 'expense' | 'daily_expense' | 'income' | 'transfer';
  title: string;
  subtitle?: string;
  amount?: string;
  href: string;
  icon?: string;
}
```

**Example Usage**:
```typescript
const results = await globalSearch('grocery');

results.forEach(result => {
  console.log(`${result.icon} ${result.title}`);
  console.log(`  ${result.subtitle}`);
  console.log(`  Amount: ${result.amount}`);
  console.log(`  Link: ${result.href}`);
});
```

**Behavior**:
- Returns empty array if query is less than 2 characters
- Performs case-insensitive partial matching
- Limits results to 20 items
- Sorts by entity type priority

---

## Search Result Types

### Account Results

```typescript
{
  type: 'account',
  title: account.name,
  subtitle: 'Girokonto' | 'Sparkonto' | 'ETF-Konto',
  amount: account.balance,
  href: `/accounts/${account.id}`,
  icon: '🏦' | '🐷' | '📈'
}
```

### Expense Results (Periodic)

```typescript
{
  type: 'expense',
  title: expense.name,
  subtitle: 'Periodische Ausgabe',
  amount: expense.amount,
  href: '/expenses',
  icon: '💸'
}
```

### Daily Expense Results

```typescript
{
  type: 'daily_expense',
  title: expense.description,
  subtitle: 'Tägliche Ausgabe',
  amount: expense.amount,
  href: '/expenses',
  icon: '🧾'
}
```

### Income Results

```typescript
{
  type: 'income',
  title: income.source,
  subtitle: 'Einnahme',
  amount: income.amount,
  href: '/income',
  icon: '💰'
}
```

### Transfer Results

```typescript
{
  type: 'transfer',
  title: transfer.description || 'Transfer',
  subtitle: 'Umbuchung',
  amount: transfer.amount,
  href: '/transfers',
  icon: '🔄'
}
```

---

## Search Priority

Results are sorted by type in this order:

| Priority | Type | Icon |
|----------|------|------|
| 1 | account | 🏦🐷📈 |
| 2 | income | 💰 |
| 3 | expense | 💸 |
| 4 | daily_expense | 🧾 |
| 5 | transfer | 🔄 |

---

## Type Definitions

```typescript
interface SearchResult {
  id: string;
  type: 'account' | 'expense' | 'daily_expense' | 'income' | 'transfer';
  title: string;
  subtitle?: string;
  amount?: string;
  href: string;
  icon?: string;
}
```

## Search Behavior Details

### Query Processing

```typescript
// Query is trimmed and wrapped for ILIKE search
const searchTerm = `%${query.trim()}%`;
```

### Entity-Specific Searches

| Entity | Search Field |
|--------|-------------|
| Accounts | `name` |
| Expenses | `name` |
| Daily Expenses | `description` |
| Incomes | `source` |
| Transfers | `description` |

### Result Limiting

```typescript
// Maximum 20 results returned
return results.slice(0, 20);
```

## Usage Examples

### Basic Search

```typescript
const results = await globalSearch('salary');

// Might return:
// - Income: "Monthly Salary"
// - Transfer: "Salary transfer to savings"
```

### Search with Type Filtering

```typescript
const results = await globalSearch('netflix');
const expenses = results.filter(r => r.type === 'expense');

// Filter to specific entity types
```

### Navigation Integration

```typescript
function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState<SearchResult[]>([]);
  
  useEffect(() => {
    globalSearch(query).then(setResults);
  }, [query]);
  
  return (
    <ul>
      {results.map(r => (
        <li key={r.id}>
          <Link href={r.href}>
            <span>{r.icon}</span>
            <span>{r.title}</span>
            <span>{r.subtitle}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```
