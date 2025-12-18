# Staging Data Setup (No Production Code Changes)

## Overview

This approach allows you to populate staging with data **without modifying your production camera code**.

## Option 1: Standalone Test Script (Recommended)

### Step 1: Set Staging API Key

```bash
# Set the API key for staging Cloud Function
firebase use staging
firebase functions:config:set counts.api_key="YOUR-API-KEY" --project staging
```

### Step 2: Set Environment Variable

```bash
export FIREBASE_API_KEY_STAGING="YOUR-API-KEY"
```

### Step 3: Run Test Script

```bash
# Send a single test payload
python test_staging_sender.py single

# Send continuously for 5 minutes (every 15 seconds)
python test_staging_sender.py continuous 5 15

# Send continuously for 10 minutes (every 30 seconds)
python test_staging_sender.py continuous 10 30
```

### Step 4: Verify

1. Go to staging dashboard: https://aiodcounter03-staging.web.app
2. Check browser console - should see `✅ Data found`
3. Data should appear in the dashboard

## Option 2: Manual Test Data (Quick Test)

You can also manually add test data via Firebase Console:

1. Go to: https://console.firebase.google.com/project/aiodcounter03-staging/firestore
2. Navigate to: `sites/site-001/cameras/usb-cam-1/daily/2025-12-18`
3. Add a document with test data

## Option 3: Copy Production Data (Advanced)

If you want to copy real production data to staging:

1. Export data from production Firestore
2. Import to staging Firestore
3. Update document IDs and timestamps as needed

## Benefits

✅ **No Production Changes**: Production code stays untouched
✅ **Safe Testing**: Test in staging without affecting production
✅ **Flexible**: Send as much or as little test data as needed
✅ **Easy**: Simple Python script, no code changes required

## Troubleshooting

### Script fails with "API key not set"
```bash
export FIREBASE_API_KEY_STAGING="your-api-key"
```

### Script fails with connection error
- Check that staging Cloud Function is deployed
- Verify the URL is correct: `https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts`

### No data appears in dashboard
- Wait a few seconds for data to process
- Check browser console for errors
- Verify `siteId` and `cameraId` match: `site-001` / `usb-cam-1`

