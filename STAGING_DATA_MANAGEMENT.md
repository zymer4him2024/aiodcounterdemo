# Staging Data Management Guide

## 🚀 Starting Continuous Data Flow

The staging environment needs continuous test data to simulate real camera feeds.

### Quick Start

```bash
# Start sending data continuously (runs in background)
./run_staging_data.sh &

# Or run in foreground (press Ctrl+C to stop)
./run_staging_data.sh
```

### Manual Start

```bash
# Set API key
export FIREBASE_API_KEY_STAGING='s97XTC3hFiA_oRTOdSbSTp4vmrHbajysAY35Ky2YiGI'

# Run test sender
python3 test_staging_sender.py continuous 10 15
# Arguments: duration_minutes interval_seconds
```

## 📊 Check Status

### Verify Data is Being Sent

1. **Check if script is running:**
   ```bash
   ps aux | grep test_staging_sender | grep -v grep
   ```

2. **Check staging dashboard:**
   - Open: https://aiodcounter03-staging.web.app
   - Refresh the page
   - You should see live counts updating

3. **Send a test payload manually:**
   ```bash
   export FIREBASE_API_KEY_STAGING='s97XTC3hFiA_oRTOdSbSTp4vmrHbajysAY35Ky2YiGI'
   python3 test_staging_sender.py single
   ```

## 🛑 Stop Data Sender

```bash
# Stop the background process
pkill -f test_staging_sender

# Or if running in foreground, press Ctrl+C
```

## 🔄 Restart Data Sender

```bash
# Stop any existing process
pkill -f test_staging_sender

# Start again
./run_staging_data.sh &
```

## 📝 Configuration

### API Key
- **Staging API Key:** `s97XTC3hFiA_oRTOdSbSTp4vmrHbajysAY35Ky2YiGI`
- Set in Firebase Functions: `firebase functions:config:set counts.api_key="..." --project staging`
- Set as environment variable: `export FIREBASE_API_KEY_STAGING='...'`

### Test Data Settings
- **Site ID:** `site-001`
- **Camera ID:** `usb-cam-1`
- **Interval:** 15 seconds (matches production camera)
- **Data:** Random counts (cars: 1-10, trucks: 0-3, buses: 0-2, motorcycles: 0-5, pedestrians: 5-20)

## 🔍 Troubleshooting

### "Count has stopped"
1. Check if script is running: `ps aux | grep test_staging_sender`
2. If not running, restart: `./run_staging_data.sh &`
3. Verify API key is set: `echo $FIREBASE_API_KEY_STAGING`

### "Missing functions config"
1. Deploy functions: `firebase use staging && firebase deploy --only functions`
2. Verify config: `firebase functions:config:get --project staging`

### "No data in dashboard"
1. Check browser console for errors
2. Verify Firebase project connection in `src/firebase.js`
3. Check Firestore rules are deployed
4. Send test payload manually to verify connection

## 📚 Files

- `test_staging_sender.py` - Main test data sender script
- `run_staging_data.sh` - Wrapper script with API key pre-configured
- `setup_staging_data.sh` - Interactive setup script

