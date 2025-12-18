# Staging Environment Setup Guide

## Step 1: Create Staging Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project"
3. Name it: `aiodcounter03-staging`
4. Follow the setup wizard:
   - Disable Google Analytics (optional for staging)
   - Click "Create project"

## Step 2: Initialize Firebase in Staging Project

```bash
# Make sure you're on the feature branch
git checkout feature/hourly-aggregates

# Link to staging project
firebase use staging

# If staging project doesn't exist in .firebaserc, add it:
firebase use --add
# Select: aiodcounter03-staging
# Alias: staging
```

## Step 3: Set Up Firestore

```bash
# Initialize Firestore (if not already done)
firebase init firestore

# Deploy Firestore rules and indexes
firebase deploy --only firestore:rules,firestore:indexes
```

## Step 4: Set Up Cloud Functions

```bash
# Install dependencies
cd functions
npm install
cd ..

# Deploy functions
firebase deploy --only functions
```

## Step 5: Set Up Hosting

```bash
# Build the React app
npm run build

# Deploy hosting
firebase deploy --only hosting
```

## Step 6: Configure Functions Environment

```bash
# Set API key for staging (use a different key than production)
firebase functions:config:set counts.api_key="your-staging-api-key" --project staging
```

## Step 7: Test the Deployment

1. Visit your staging URL (shown after deployment)
2. Test all features:
   - Real-time data updates
   - Hourly charts
   - Daypart breakdown
   - Dynamic pricing

## Step 8: Compare with Production

**Production URL**: https://aiodcounter03-demo.web.app
**Staging URL**: https://aiodcounter03-staging-demo.web.app (after setup)

## Quick Deploy Commands

```bash
# Full deployment to staging
firebase use staging
npm run build
firebase deploy

# Deploy only functions
firebase deploy --only functions

# Deploy only hosting
firebase deploy --only hosting

# Deploy only Firestore
firebase deploy --only firestore
```

## Switching Between Environments

```bash
# Work on staging
firebase use staging
# ... make changes ...
firebase deploy

# Switch back to production
firebase use production
# ... deploy to production ...
firebase deploy
```

## Important Notes

1. **Separate Data**: Staging and production use completely separate Firestore databases
2. **Separate Functions**: Each environment has its own Cloud Functions
3. **Test Data**: You'll need to send test data to staging to see results
4. **API Keys**: Use different API keys for staging vs production

## Testing Data Ingestion

To test hourly aggregates, send data to your staging Cloud Function:

```bash
# Get your staging function URL
firebase functions:config:get --project staging

# Send test data (replace with your staging function URL and API key)
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

## Troubleshooting

### Index Creation
If you see index errors, wait a few minutes for Firestore to create the indexes automatically, or create them manually in Firebase Console.

### Functions Not Deploying
```bash
# Check Firebase CLI version
firebase --version

# Update if needed
npm install -g firebase-tools

# Try deploying with verbose output
firebase deploy --only functions --debug
```

### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules build
npm install
npm run build
```

