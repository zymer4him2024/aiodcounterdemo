# Staging Environment Status

## ✅ Setup Complete (Partial)

### Staging Project
- **Project ID**: `aiodcounter03-staging`
- **Project Number**: 501380809932
- **Status**: Active

### Deployed Services

#### ✅ Firestore
- Rules: Deployed
- Indexes: Deployed (daily, hourly collections)
- Database Location: nam5 (North America)

#### ⚠️ Cloud Functions
- **Status**: Requires Blaze Plan upgrade
- **Action Required**: 
  1. Visit: https://console.firebase.google.com/project/aiodcounter03-staging/usage/details
  2. Upgrade to Blaze (pay-as-you-go) plan
  3. Then run: `firebase deploy --only functions`

#### ✅ Hosting
- **URL**: https://aiodcounter03-staging.web.app
- **Status**: Deployed and Live!
- **Build**: Complete

### Next Steps

1. **Set Functions Config (API Key)**
   ```bash
   firebase functions:config:set counts.api_key="your-staging-api-key" --project staging
   ```

2. **Get Your Staging URLs**
   ```bash
   firebase hosting:sites:list --project staging
   ```

3. **Test Data Ingestion**
   - Get your function URL from Firebase Console
   - Send test POST requests to create hourly aggregates
   - Verify data appears in Firestore

4. **Test Dashboard**
   - Visit staging hosting URL
   - Verify charts load from hourly collection
   - Test all features

### Switching Between Environments

```bash
# Work on staging
firebase use staging
git checkout feature/hourly-aggregates

# Work on production
firebase use production
git checkout main
```

### Useful Commands

```bash
# View staging project
firebase use staging
firebase projects:list

# Deploy everything to staging
firebase deploy

# Deploy only functions
firebase deploy --only functions

# View function logs
firebase functions:log --project staging
```

