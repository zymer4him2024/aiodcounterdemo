#!/usr/bin/env python3
"""
Standalone Test Script for Staging
===================================

This script sends test data to staging Firebase without touching production code.
Run this separately to populate staging with test data.

Usage:
    python test_staging_sender.py
"""

import os
import requests
import time
from datetime import datetime
import random

# Staging configuration
STAGING_URL = "https://us-central1-aiodcounter03-staging.cloudfunctions.net/ingestCounts"
STAGING_API_KEY = os.environ.get("FIREBASE_API_KEY_STAGING", "")

# Site and camera IDs (should match dashboard)
SITE_ID = "site-001"
CAMERA_ID = "usb-cam-1"

def send_test_data(counts=None):
    """Send test data to staging Firebase."""
    if not STAGING_API_KEY:
        print("❌ Error: FIREBASE_API_KEY_STAGING environment variable not set")
        print("   Set it with: export FIREBASE_API_KEY_STAGING='your-api-key'")
        return False
    
    # Generate random counts if not provided
    if counts is None:
        counts = {
            "car": random.randint(1, 10),
            "truck": random.randint(0, 3),
            "bus": random.randint(0, 2),
            "motorcycle": random.randint(0, 5),
            "person": random.randint(5, 20)
        }
    
    # Create payload
    payload = {
        "siteId": SITE_ID,
        "cameraId": CAMERA_ID,
        "ts": int(time.time() * 1000),  # Current timestamp in milliseconds
        "windowSec": 15,
        "counts": counts
    }
    
    # Send to staging
    headers = {
        "Content-Type": "application/json",
        "x-api-key": STAGING_API_KEY
    }
    
    try:
        response = requests.post(STAGING_URL, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            print(f"✅ Sent to Staging: {counts}")
            return True
        else:
            print(f"❌ Staging send failed: {response.status_code} {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ Staging send exception: {e}")
        return False

def send_continuous(duration_minutes=5, interval_seconds=15):
    """Send test data continuously for a specified duration."""
    print(f"🚀 Starting continuous test data sending...")
    print(f"   Duration: {duration_minutes} minutes")
    print(f"   Interval: {interval_seconds} seconds")
    print(f"   Staging URL: {STAGING_URL}")
    print()
    
    end_time = time.time() + (duration_minutes * 60)
    count = 0
    
    while time.time() < end_time:
        count += 1
        print(f"[{count}] {datetime.now().strftime('%H:%M:%S')} - ", end="")
        send_test_data()
        time.sleep(interval_seconds)
    
    print(f"\n✅ Completed: Sent {count} test payloads to staging")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "continuous":
            duration = int(sys.argv[2]) if len(sys.argv) > 2 else 5
            interval = int(sys.argv[3]) if len(sys.argv) > 3 else 15
            send_continuous(duration, interval)
        elif sys.argv[1] == "single":
            send_test_data()
        else:
            print("Usage:")
            print("  python test_staging_sender.py single          # Send one test payload")
            print("  python test_staging_sender.py continuous [minutes] [interval_sec]  # Send continuously")
    else:
        # Default: send single test payload
        print("Sending single test payload to staging...")
        send_test_data()
        print("\nTo send continuously, run:")
        print("  python test_staging_sender.py continuous 5 15  # 5 minutes, every 15 seconds")

