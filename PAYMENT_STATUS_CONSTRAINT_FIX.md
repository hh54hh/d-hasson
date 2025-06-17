# Payment Status Constraint Fix

## Problem

Database constraint violation error:

```
new row for relation "customers" violates check constraint "customers_payment_status_check" (23514)
```

## Root Cause

The code was setting `paymentStatus` to invalid values:

- ❌ `"outstanding"` - not allowed by database constraint
- ❌ `"paid"` - not allowed by database constraint

## Database Constraint

The `customers` table has a check constraint that only allows these values:

```sql
payment_status VARCHAR(20) DEFAULT 'cash' CHECK (payment_status IN ('cash', 'deferred', 'partial'))
```

## Valid Values

- ✅ `"cash"` - Customer pays immediately in cash
- ✅ `"deferred"` - Customer has deferred/credit payments
- ✅ `"partial"` - Customer makes partial payments

## Solution

Updated `src/lib/customerSaleHistory.ts` in two locations:

### 1. Customer Update After Sale (Line ~182)

**Before:**

```typescript
paymentStatus: stats.newDebtAmount > 0
  ? ("outstanding" as const)
  : ("paid" as const);
```

**After:**

```typescript
paymentStatus: stats.newDebtAmount > 0
  ? ("deferred" as const)
  : ("cash" as const);
```

### 2. Debt Payment Update (Line ~318)

**Before:**

```typescript
paymentStatus: newDebt > 0 ? ("outstanding" as const) : ("paid" as const);
```

**After:**

```typescript
paymentStatus: newDebt > 0
  ? ("deferred" as const)
  : customer.paymentStatus === "deferred"
    ? ("cash" as const)
    : customer.paymentStatus;
```

## Logic Explanation

### Customer Sale Updates

- If customer has debt → `"deferred"` (they owe money)
- If customer has no debt → `"cash"` (they pay immediately)

### Debt Payment Updates

- If debt remains → Keep as `"deferred"`
- If debt is cleared → Change to `"cash"` only if they were `"deferred"`, otherwise preserve their preference

## Impact

✅ **Fixed:** Database constraint violations eliminated
✅ **Improved:** More intelligent payment status logic
✅ **Preserved:** Customer payment preferences when appropriate

## Testing

After this fix:

1. New sales with customers who have debt will set `paymentStatus` to `"deferred"`
2. New sales with customers who pay immediately will set `paymentStatus` to `"cash"`
3. Debt payments will properly update status without violating constraints
