# Staging Setup - Next Steps

## ✅ What's Done

1. ✅ Firestore rules and indexes deployed
2. ✅ Hosting deployed to: **https://aiodcounter03-staging.web.app**
3. ✅ Build completed successfully
4. ✅ Git branch: `feature/hourly-aggregates`

## ⚠️ Action Required: Cloud Functions

### Step 1: Upgrade to Blaze Plan

Cloud Functions require the Blaze (pay-as-you-go) plan:

1. Visit: https://console.firebase.google.com/project/aiodcounter03-staging/usage/details
2. Click "Upgrade" or "Modify plan"
3. Select "Blaze Plan"
4. Complete the upgrade (you'll need to add a payment method)

**Note**: Blaze plan has a free tier, so you won't be charged unless you exceed free limits.

### Step 2: Deploy Functions

After upgrading:

```bash
firebase use staging
firebase deploy --only functions
```

### Step 3: Set Functions Config (API Key)

```bash
# Set a staging API key (use a different key than production)
firebase functions:config:set counts.api_key="your-staging-api-key" --project staging

# Or use the new params method (recommended):
# Edit functions/.env or use Firebase Console
```

## 🧪 Testing the Staging Dashboard

### 1. Visit Staging URL
- **Staging**: https://aiodcounter03-staging.web.app
- **Production**: https://aiodcounter03-demo.web.app (for comparison)

### 2. Test Data Ingestion

Once functions are deployed, send test data:

```bash
# Get your function URL from Firebase Console
# Functions → ingestCounts → Copy URL

curl -X POST https://YOUR-REGION-aiodcounter03-staging.cloudfunctions.net/ingestCounts \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-staging-api-key" \
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

### 3. Verify Hourly Aggregates

1. Go to Firebase Console → Firestore
2. Navigate to: `sites/site-001/cameras/usb-cam-1/hourly`
3. You should see documents like: `2025-01-18_14` (date_hour)
4. Check that totals are being aggregated correctly

### 4. Test Dashboard

1. Visit staging URL
2. Check browser console for errors
3. Verify charts load (may be empty until data is sent)
4. Send multiple test requests with different timestamps
5. Verify hourly charts update

## 📊 Current Status

```
Production (main branch)
├─ URL: https://aiodcounter03-demo.web.app
├─ Status: ✅ Stable
└─ Code: Current production version

Staging (feature/hourly-aggregates branch)
├─ URL: https://aiodcounter03-staging.web.app
├─ Status: 🧪 Testing (hourly aggregates feature)
├─ Firestore: ✅ Ready
├─ Hosting: ✅ Deployed
└─ Functions: ⚠️ Needs Blaze plan upgrade
```

## 🔄 Quick Commands

```bash
# Switch to staging
firebase use staging

# Switch to production
firebase use production

# Deploy everything to staging
firebase deploy

# View function logs
firebase functions:log --project staging

# Check current project
firebase use
```

## 🎯 Testing Checklist

- [ ] Upgrade staging project to Blaze plan
- [ ] Deploy Cloud Functions to staging
- [ ] Set functions config (API key)
- [ ] Send test data to staging function
- [ ] Verify hourly aggregates in Firestore
- [ ] Test dashboard at staging URL
- [ ] Verify charts load from hourly collection
- [ ] Compare performance with production
- [ ] Test all features work correctly

## 💡 Tips

1. **Free Tier**: Blaze plan has generous free tier, you likely won't be charged
2. **Separate Data**: Staging and production have completely separate databases
3. **Test Data**: You'll need to send test data to see results in staging
4. **Compare**: Keep both URLs open to compare production vs staging

## 🆘 Troubleshooting

### Functions won't deploy
- Make sure Blaze plan is activated
- Wait a few minutes after upgrade
- Try: `firebase deploy --only functions --debug`

### Dashboard shows no data
- Send test data to staging function first
- Check Firestore console for hourly documents
- Check browser console for errors

### Index errors
- Firestore indexes are created automatically
- May take a few minutes
- Check Firebase Console → Firestore → Indexes

