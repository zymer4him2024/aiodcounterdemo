# Staging Permissions Fix

## Issue
Error: `Missing or insufficient permissions` when fetching hourly aggregates

## Solution Applied

1. ✅ **Firestore Rules Deployed**: The hourly collection has read access
2. ✅ **Indexes Deployed**: Composite index for hourly queries is created

## Verification Steps

### 1. Check Firestore Rules in Console
1. Go to: https://console.firebase.google.com/project/aiodcounter03-staging/firestore/rules
2. Verify you see:
   ```
   match /hourly/{hourId} {
     allow read: if true;
   }
   ```

### 2. Check Index Status
1. Go to: https://console.firebase.google.com/project/aiodcounter03-staging/firestore/indexes
2. Look for index on `hourly` collection with fields:
   - `dateStr` (Ascending)
   - `hour` (Ascending)
3. Status should be "Enabled" (may take a few minutes to build)

### 3. If Index is Still Building
- Wait 2-5 minutes for index to finish building
- Refresh the dashboard after index is enabled
- The error will resolve once index is ready

### 4. Test Query Directly
You can test the query in Firebase Console:
1. Go to Firestore Data
2. Navigate to: `sites/site-001/cameras/usb-cam-1/hourly`
3. Try to query with: `dateStr == "2025-01-18"` ordered by `hour`

## Quick Fix Commands

```bash
# Redeploy rules (if needed)
firebase use staging
firebase deploy --only firestore:rules

# Redeploy indexes (if needed)
firebase deploy --only firestore:indexes

# Check index status
firebase firestore:indexes --project staging
```

## Expected Behavior

Once index is built:
- Dashboard should load without permission errors
- Hourly charts should display data (if data exists)
- Query should work: `where("dateStr", "==", todayStr).orderBy("hour", "asc")`

