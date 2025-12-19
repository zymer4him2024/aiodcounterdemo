# Dual-Sending Setup Guide (Option 1)

## Overview
This guide will help you configure your camera to send data to both **Production** and **Staging** simultaneously.

## Step 1: Set Staging API Key

First, you need to configure the API key for the staging Cloud Function:

```bash
# Switch to staging project
firebase use staging

# Set the API key (use the same key as production, or create a new one)
firebase functions:config:set counts.api_key="YOUR-API-KEY" --project staging
```

**Note:** You can use the same API key as production, or create a different one for staging.

## Step 2: Get Staging Function URL

The staging Cloud Function URL is:
```
https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts
```

## Step 3: Update Camera Code

### Option A: Replace FirebaseSender Class

Replace your existing `FirebaseSender` class with the dual-sending version from `camera_firebase_sender_patch.py`.

The key changes:
- Reads `FIREBASE_INGEST_URL_STAGING` environment variable
- Reads `FIREBASE_API_KEY_STAGING` environment variable
- Sends to both production and staging automatically

### Option B: Use Complete File

If you prefer, use the complete example from `camera_dual_send.py`.

## Step 4: Set Environment Variables

Add these environment variables to your camera system:

```bash
# Production (existing - keep these)
export FIREBASE_INGEST_URL="https://us-central1-aiodcounterdemo.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY="your-production-api-key"

# Staging (new - add these)
export FIREBASE_INGEST_URL_STAGING="https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY_STAGING="your-staging-api-key"
```

## Step 5: Test

1. Restart your camera code
2. Check the logs - you should see:
   ```
   ✅ Firebase Sender initialized:
      Production: https://us-central1-aiodcounterdemo.cloudfunctions.net/ingestCounts
      Staging: https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts
   ```

3. When data is sent, you'll see:
   ```
   ✅ Sent to Production: 200
   ✅ Sent to Staging: 200
   ```

## Step 6: Verify Data in Staging

1. Go to staging dashboard: https://aiodcounter03-staging.web.app
2. Check browser console - should see `✅ Data found` messages
3. Data should appear in the dashboard

## Troubleshooting

### If staging sends fail:
- Check that `FIREBASE_INGEST_URL_STAGING` is set correctly
- Check that `FIREBASE_API_KEY_STAGING` matches the key set in Firebase Functions config
- Verify staging Cloud Function is deployed: `firebase functions:list --project staging`

### If production sends fail:
- The dual-sending code maintains backward compatibility
- Production failures won't affect staging sends
- Check your production configuration

## Benefits

✅ **No Production Impact**: Production flow is unchanged
✅ **Automatic**: Data appears in both environments automatically
✅ **Safe Testing**: Test new features in staging without affecting production
✅ **Backward Compatible**: If staging vars aren't set, behaves like original code





