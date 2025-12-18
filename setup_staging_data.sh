#!/bin/bash
# Quick setup script for staging data

echo "=== Staging Data Setup ==="
echo ""

# Check if API key is set
if [ -z "$FIREBASE_API_KEY_STAGING" ]; then
    echo "⚠️  FIREBASE_API_KEY_STAGING not set"
    echo ""
    echo "Please set it with:"
    echo "  export FIREBASE_API_KEY_STAGING='your-api-key'"
    echo ""
    echo "Or set it in Firebase Functions first:"
    echo "  firebase use staging"
    echo "  firebase functions:config:set counts.api_key='your-key' --project staging"
    echo ""
    read -p "Enter staging API key (or press Enter to skip): " api_key
    if [ ! -z "$api_key" ]; then
        export FIREBASE_API_KEY_STAGING="$api_key"
        echo "✅ API key set for this session"
    else
        echo "❌ Cannot proceed without API key"
        exit 1
    fi
else
    echo "✅ FIREBASE_API_KEY_STAGING is set"
fi

echo ""
echo "Starting test data sender..."
echo "This will send data to staging for 5 minutes (every 15 seconds)"
echo "Press Ctrl+C to stop early"
echo ""

python3 test_staging_sender.py continuous 5 15
