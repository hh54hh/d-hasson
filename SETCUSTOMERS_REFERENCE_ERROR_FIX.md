# setCustomers Reference Error Fix

## Problem

ReferenceError when processing debt payments and other customer operations:

```
Error processing debt payment: ReferenceError: setCustomers is not defined
    at handleDebtPayment (Dashboard.tsx:194:13)
```

## Root Cause

Multiple functions in the Dashboard component were calling `setCustomers()` but the `customers` data is passed as a **prop**, not managed as local state.

The `DashboardContent` component receives `customers` as a prop from its parent component, so there is no `setCustomers` function available.

## Error Locations

**File**: `src/pages/Dashboard.tsx`  
**Functions affected**:

1. `handleDebtPayment` - Line ~315
2. `handleEditCustomer` - Line ~415
3. `handleDeleteCustomer` - Line ~1547

## Solution

Replaced all `setCustomers()` calls with `refreshData()` which is the proper way to update the data since it's managed by the parent component.

### Before:

```typescript
// ❌ Trying to update local state that doesn't exist
setCustomers((prevCustomers) =>
  prevCustomers.map((customer) =>
    customer.id === selectedCustomer.id
      ? { ...customer, debtAmount: remainingDebt }
      : customer,
  ),
);
```

### After:

```typescript
// ✅ Using the proper refresh function
refreshData();
```

## Changes Made

1. **Debt Payment Function**:

   - Removed local state update attempt
   - Added `refreshData()` call to reload customer data

2. **Edit Customer Function**:

   - Removed local state update attempt
   - Added `refreshData()` call to reload customer data

3. **Delete Customer Function**:
   - Removed local state update attempt
   - Kept existing `refreshData()` call

## Component Architecture

The Dashboard follows this pattern:

- **Parent Component**: Manages `customers` state and provides `refreshData()`
- **DashboardContent Component**: Receives `customers` as prop and calls `refreshData()` when updates are needed

## Impact

✅ **Fixed**: Debt payment processing now works without errors  
✅ **Fixed**: Customer editing works without errors  
✅ **Fixed**: Customer deletion works without errors  
✅ **Improved**: More consistent data refresh pattern  
✅ **Maintained**: All functionality preserved with proper data flow

## Testing

All customer operations (debt payment, editing, deletion) should now work without reference errors and properly refresh the customer data.
