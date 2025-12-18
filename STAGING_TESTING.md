# Staging Testing Guide

## ✅ Deployment Complete!

### Staging URLs
- **Dashboard**: https://aiodcounter03-staging.web.app
- **Cloud Function**: https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts

### Services Status
- ✅ Firestore: Deployed
- ✅ Hosting: Deployed
- ✅ Functions: Deployed

## 🔑 Setting Up API Key

### Option 1: Using Functions Config (Legacy - works now)

```bash
firebase functions:config:set counts.api_key="your-staging-api-key-here" --project staging
```

**Note**: Use a different API key than production for security.

### Option 2: Using Environment Variables (Recommended - for future)

The new way is to use `.env` files, but for now, functions.config() works.

## 🧪 Testing Data Ingestion

### Step 1: Set API Key

```bash
# Replace with your actual staging API key
firebase functions:config:set counts.api_key="test-staging-key-123" --project staging
```

### Step 2: Send Test Data

```bash
# Replace YOUR_API_KEY with the key you set above
curl -X POST https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "siteId": "site-001",
    "cameraId": "usb-cam-1",
    "ts": 1734567890000,
    "windowSec": 15,
    "counts": {
      "car": 5,
      "truck": 2,
      "bus": 1,
      "motorcycle": 3,
      "person": 10
    }
  }'
```

### Step 3: Send Multiple Test Requests

To test hourly aggregation, send data for different hours:

```bash
# Current time (adjust ts to current timestamp)
NOW=$(date +%s)000
curl -X POST https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d "{
    \"siteId\": \"site-001\",
    \"cameraId\": \"usb-cam-1\",
    \"ts\": $NOW,
    \"windowSec\": 15,
    \"counts\": {
      \"car\": 10,
      \"truck\": 3,
      \"bus\": 2,
      \"motorcycle\": 5,
      \"person\": 20
    }
  }"
```

## 📊 Verifying Data

### 1. Check Firestore Console

1. Go to: https://console.firebase.google.com/project/aiodcounter03-staging/firestore
2. Navigate to: `sites/site-001/cameras/usb-cam-1/`
3. Check these collections:
   - `windows` - Raw window data
   - `daily` - Daily aggregates
   - `hourly` - **NEW** Hourly aggregates (should see documents like `2025-01-18_14`)
   - `monthly` - Monthly aggregates

### 2. Check Dashboard

1. Visit: https://aiodcounter03-staging.web.app
2. Open browser console (F12)
3. Check for errors
4. Verify charts load
5. Send more test data and watch charts update

### 3. Verify Hourly Aggregates

In Firestore, check the `hourly` collection:
- Document IDs should be: `{date}_{hour}` (e.g., `2025-01-18_14`)
- Each document should have:
  - `dateStr`: "2025-01-18"
  - `hour`: 14
  - `totals`: { total, car, truck, bus, motorcycle, person }
  - `timeZone`: "America/Manaus"

## 🎯 Testing Checklist

- [ ] Set API key in functions config
- [ ] Send test data to staging function
- [ ] Verify data appears in Firestore `windows` collection
- [ ] Verify `hourly` collection has documents
- [ ] Verify `daily` collection updates
- [ ] Verify `monthly` collection updates
- [ ] Check dashboard loads without errors
- [ ] Verify hourly charts display data
- [ ] Send multiple requests for same hour (verify aggregation)
- [ ] Send requests for different hours (verify separate documents)
- [ ] Compare performance: staging vs production

## 🔍 Debugging

### Check Function Logs

```bash
firebase functions:log --project staging
```

### Check Function Status

```bash
firebase functions:list --project staging
```

### Test Function Directly

```bash
# Test with curl (replace API key)
curl -X POST https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"siteId":"site-001","cameraId":"usb-cam-1","ts":1734567890000,"windowSec":15,"counts":{"car":1}}'
```

### Common Issues

1. **401 Unauthorized**: API key not set or incorrect
2. **No hourly data**: Check function logs for errors
3. **Charts empty**: Send test data first, then refresh dashboard
4. **Index errors**: Wait a few minutes for Firestore to create indexes

## 📈 Performance Comparison

Compare staging (hourly aggregates) vs production (scanning windows):

**Production** (old way):
- Queries all windows for the day
- Aggregates in browser
- Slower with more data

**Staging** (new way):
- Queries pre-aggregated hourly documents
- Much faster
- Scales better

## ✅ When Ready for Production

Once testing is complete:

```bash
# 1. Merge to main
git checkout main
git merge feature/hourly-aggregates
git push origin main

# 2. Deploy to production
firebase use production
npm run build
firebase deploy

# 3. Set production API key (if needed)
firebase functions:config:set counts.api_key="production-key" --project production
```

