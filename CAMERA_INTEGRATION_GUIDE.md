# Camera Dual-Sending Integration Guide

## Overview

This guide shows you how to integrate dual-sending (Production + Staging) into your camera code while maintaining full backward compatibility with production.

## Step 1: Replace FirebaseSender Class

Replace the existing `FirebaseSender` class in your camera code with the modified version from `camera_dual_send.py`.

### Original Code (Single Endpoint):
```python
class FirebaseSender:
    def __init__(self):
        self.url = safe_env_get("FIREBASE_INGEST_URL", "").strip()
        self.api_key = safe_env_get("FIREBASE_API_KEY", "").strip()
        self.site_id = safe_env_get("SITE_ID", "demo-site").strip()
        self.camera_id = safe_env_get("CAMERA_ID", "usb-cam-1").strip()
        self.enabled = bool(self.url)
    
    def send(self, payload: dict):
        if not self.enabled: return
        headers = {"Content-Type": "application/json"}
        if self.api_key: headers["x-api-key"] = self.api_key
        try:
            r = requests.post(self.url, headers=headers, json=payload, timeout=10)
            if r.status_code >= 300:
                print(f"❌ Firebase send failed: {r.status_code} {r.text[:200]}")
            else:
                print(f"✅ Sent to Firebase: {r.status_code}")
        except Exception as e:
            print(f"❌ Firebase send exception: {e}")
```

### Modified Code (Dual Endpoint):
```python
class FirebaseSender:
    def __init__(self):
        # PRIMARY endpoint (Production) - REQUIRED
        self.url = safe_env_get("FIREBASE_INGEST_URL", "").strip()
        self.api_key = safe_env_get("FIREBASE_API_KEY", "").strip()
        
        # SECONDARY endpoint (Staging) - OPTIONAL
        self.url_staging = safe_env_get("FIREBASE_INGEST_URL_STAGING", "").strip()
        self.api_key_staging = safe_env_get("FIREBASE_API_KEY_STAGING", "").strip()
        
        self.site_id = safe_env_get("SITE_ID", "demo-site").strip()
        self.camera_id = safe_env_get("CAMERA_ID", "usb-cam-1").strip()
        self.enabled = bool(self.url)  # Same as before
    
    def send(self, payload: dict):
        if not self.enabled: return
        
        # ALWAYS send to production first (unchanged)
        self._send_single(self.url, self.api_key, payload, "Production")
        
        # OPTIONALLY send to staging (only if configured)
        if self.url_staging:
            self._send_single(self.url_staging, self.api_key_staging, payload, "Staging")
    
    def _send_single(self, url: str, api_key: str, payload: dict, env_name: str):
        headers = {"Content-Type": "application/json"}
        if api_key: headers["x-api-key"] = api_key
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            if r.status_code >= 300:
                print(f"❌ {env_name} send failed: {r.status_code} {r.text[:200]}")
            else:
                print(f"✅ Sent to {env_name}: {r.status_code}")
        except Exception as e:
            print(f"❌ {env_name} send exception: {e}")
            # Exception doesn't propagate - other send continues
```

## Step 2: Environment Variables Setup

### Option A: Production Only (Backward Compatible)
```bash
# On Raspberry Pi - .env file or environment variables
export FIREBASE_INGEST_URL="https://us-central1-aiodcounter03.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY="your-production-api-key"
export SITE_ID="site-001"
export CAMERA_ID="usb-cam-1"

# Staging variables NOT set = behaves exactly like original code
```

### Option B: Production + Staging (Dual Sending)
```bash
# On Raspberry Pi - .env file or environment variables
# Production (required)
export FIREBASE_INGEST_URL="https://us-central1-aiodcounter03.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY="your-production-api-key"

# Staging (optional - only if you want dual sending)
export FIREBASE_INGEST_URL_STAGING="https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY_STAGING="your-staging-api-key"

# Common
export SITE_ID="site-001"
export CAMERA_ID="usb-cam-1"
```

## Step 3: Testing Strategy

### Phase 1: Test Backward Compatibility
1. Deploy modified code to camera
2. Keep only production environment variables (no staging vars)
3. Verify production works exactly as before
4. Monitor for 24 hours to ensure stability

### Phase 2: Test Dual Sending
1. Add staging environment variables
2. Verify both endpoints receive data
3. Check logs for success messages from both
4. Monitor both dashboards

## Step 4: Verification

### Check Logs
You should see output like:
```
✅ Firebase Sender initialized:
   Production: https://us-central1-aiodcounter03.cloudfunctions.net/ingestCounts
   Staging: https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts

✅ Sent to Production: 200
✅ Sent to Staging: 200
```

### Check Dashboards
- **Production**: https://aiodcounter03-demo.web.app
- **Staging**: https://aiodcounter03-staging.web.app

Both should show the same data (with slight delay).

## Safety Features

### ✅ Production Protection
- Production send happens **first** and **independently**
- Production uses **same variables** as before
- Production behavior is **unchanged**

### ✅ Error Isolation
- Staging failure **does not affect** production
- Each send has **separate timeout** (10 seconds)
- Exceptions are **caught and logged** (don't propagate)

### ✅ Backward Compatibility
- Works with **existing environment variables**
- If staging vars not set, **behaves like original**
- **No breaking changes**

## Rollback Plan

If you need to rollback:

1. **Quick Rollback**: Remove staging environment variables
   ```bash
   unset FIREBASE_INGEST_URL_STAGING
   unset FIREBASE_API_KEY_STAGING
   ```
   Camera will immediately revert to production-only mode.

2. **Full Rollback**: Replace with original FirebaseSender class
   - Copy original code back
   - Restart camera script

## Troubleshooting

### Production not sending
- Check `FIREBASE_INGEST_URL` is set correctly
- Check `FIREBASE_API_KEY` is correct
- Check network connectivity

### Staging not sending
- Check `FIREBASE_INGEST_URL_STAGING` is set
- Check `FIREBASE_API_KEY_STAGING` is correct
- Check staging function is deployed
- Check staging API key is configured in Firebase

### Both failing
- Check network connection
- Check firewall rules
- Check function URLs are correct

## Function URLs Reference

**Production:**
```
https://us-central1-aiodcounter03.cloudfunctions.net/ingestCounts
```

**Staging:**
```
https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts
```

## Summary

- ✅ **Backward Compatible**: Works with existing setup
- ✅ **Production Safe**: Production always works independently
- ✅ **Optional Staging**: Only sends to staging if configured
- ✅ **Error Isolated**: Staging failures don't affect production
- ✅ **Easy Rollback**: Remove staging vars to revert

