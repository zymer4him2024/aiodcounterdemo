# Quick Start: Dual-Sending Setup

## 🚀 Fast Setup (5 minutes)

### Step 1: Update Camera Code

Replace the `FirebaseSender` class in your camera code with the version from `camera_firebase_sender_patch.py`.

**What to change:**
- Find the `class FirebaseSender:` in your camera code
- Replace it with the version from `camera_firebase_sender_patch.py`
- Keep everything else unchanged

### Step 2: Set Environment Variables

**For Production Only (Backward Compatible):**
```bash
export FIREBASE_INGEST_URL="https://us-central1-aiodcounter03.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY="your-production-key"
export SITE_ID="site-001"
export CAMERA_ID="usb-cam-1"
```

**For Production + Staging (Dual Sending):**
```bash
# Production (required)
export FIREBASE_INGEST_URL="https://us-central1-aiodcounter03.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY="your-production-key"

# Staging (optional - add these to enable dual sending)
export FIREBASE_INGEST_URL_STAGING="https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts"
export FIREBASE_API_KEY_STAGING="your-staging-key"

# Common
export SITE_ID="site-001"
export CAMERA_ID="usb-cam-1"
```

### Step 3: Restart Camera

Restart your camera script to load the new code.

### Step 4: Verify

Check logs - you should see:
```
✅ Sent to Production: 200
✅ Sent to Staging: 200  (if staging vars are set)
```

## ✅ That's It!

- **Production**: Continues working exactly as before
- **Staging**: Receives data if you set the staging variables
- **Safe**: Staging failures don't affect production

## 🔄 To Disable Staging

Simply remove the staging environment variables:
```bash
unset FIREBASE_INGEST_URL_STAGING
unset FIREBASE_API_KEY_STAGING
```

Camera immediately reverts to production-only mode.

