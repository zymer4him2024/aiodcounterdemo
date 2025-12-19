#!/bin/bash
# Continuous data sender for staging
# This script sets the API key and runs the test sender continuously

# Set the staging API key
export FIREBASE_API_KEY_STAGING='s97XTC3hFiA_oRTOdSbSTp4vmrHbajysAY35Ky2YiGI'

echo "=== 🚀 Staging Data Sender ==="
echo ""
echo "✅ API Key configured"
echo "📡 Sending data to staging continuously..."
echo "⏱️  Interval: 15 seconds"
echo "🛑 Press Ctrl+C to stop"
echo ""

# Run the test script continuously (indefinitely)
# The script will run until manually stopped
python3 test_staging_sender.py continuous 999 15



