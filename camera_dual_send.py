"""
Dual-Sending FirebaseSender Class
==================================

This modified FirebaseSender class supports sending data to both production
and staging environments simultaneously, while maintaining full backward
compatibility with the existing production setup.

Usage:
    Replace the FirebaseSender class in your camera code with this version.
    
Environment Variables:
    Required (Production):
        FIREBASE_INGEST_URL - Production Cloud Function URL
        FIREBASE_API_KEY - Production API key
    
    Optional (Staging):
        FIREBASE_INGEST_URL_STAGING - Staging Cloud Function URL
        FIREBASE_API_KEY_STAGING - Staging API key
    
    Common:
        SITE_ID - Site identifier (default: "demo-site")
        CAMERA_ID - Camera identifier (default: "usb-cam-1")

Backward Compatibility:
    - If staging variables are not set, behaves exactly like original
    - Production send always happens first and independently
    - Staging failures do not affect production
"""

import requests
import os
from typing import Dict, Optional


def safe_env_get(key: str, default: str = "") -> str:
    """Safely get environment variable with default value."""
    return os.environ.get(key, default).strip()


class FirebaseSender:
    """
    Firebase Sender with dual-sending support (Production + Staging).
    
    Maintains full backward compatibility - if staging variables are not set,
    it behaves exactly like the original single-endpoint version.
    """
    
    def __init__(self):
        # PRIMARY endpoint (Production) - REQUIRED for backward compatibility
        self.url = safe_env_get("FIREBASE_INGEST_URL", "")
        self.api_key = safe_env_get("FIREBASE_API_KEY", "")
        
        # SECONDARY endpoint (Staging) - OPTIONAL
        self.url_staging = safe_env_get("FIREBASE_INGEST_URL_STAGING", "")
        self.api_key_staging = safe_env_get("FIREBASE_API_KEY_STAGING", "")
        
        # Common settings
        self.site_id = safe_env_get("SITE_ID", "demo-site")
        self.camera_id = safe_env_get("CAMERA_ID", "usb-cam-1")
        
        # Enabled if primary URL exists (same logic as original)
        self.enabled = bool(self.url)
        
        # Log configuration on initialization
        if self.enabled:
            print(f"✅ Firebase Sender initialized:")
            print(f"   Production: {self.url[:50]}..." if len(self.url) > 50 else f"   Production: {self.url}")
            if self.url_staging:
                print(f"   Staging: {self.url_staging[:50]}..." if len(self.url_staging) > 50 else f"   Staging: {self.url_staging}")
            else:
                print(f"   Staging: Not configured (optional)")
    
    def send(self, payload: Dict) -> None:
        """
        Send payload to Firebase endpoints.
        
        Always sends to production first (if enabled).
        Optionally sends to staging if configured.
        
        Args:
            payload: Dictionary containing the data to send
        """
        if not self.enabled:
            return
        
        # ALWAYS send to production first (unchanged behavior)
        self._send_single(
            url=self.url,
            api_key=self.api_key,
            payload=payload,
            env_name="Production"
        )
        
        # OPTIONALLY send to staging (only if configured)
        if self.url_staging:
            self._send_single(
                url=self.url_staging,
                api_key=self.api_key_staging,
                payload=payload,
                env_name="Staging"
            )
    
    def _send_single(self, url: str, api_key: str, payload: Dict, env_name: str) -> None:
        """
        Send payload to a single endpoint.
        
        This method is isolated - failures here don't affect other sends.
        
        Args:
            url: Cloud Function URL
            api_key: API key for authentication
            payload: Data to send
            env_name: Environment name for logging (Production/Staging)
        """
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["x-api-key"] = api_key
        
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=10)
            if r.status_code >= 300:
                print(f"❌ {env_name} send failed: {r.status_code} {r.text[:200]}")
            else:
                print(f"✅ Sent to {env_name}: {r.status_code}")
        except requests.exceptions.Timeout:
            print(f"❌ {env_name} send timeout: Request took longer than 10 seconds")
        except requests.exceptions.ConnectionError as e:
            print(f"❌ {env_name} connection error: {e}")
        except Exception as e:
            print(f"❌ {env_name} send exception: {e}")
            # Important: Exception is caught and logged, doesn't propagate


# Example usage (for testing):
if __name__ == "__main__":
    # Test the dual-sending functionality
    sender = FirebaseSender()
    
    test_payload = {
        "ts": 1734567890000,
        "windowSec": 15,
        "siteId": "site-001",
        "cameraId": "usb-cam-1",
        "counts": {
            "car": 5,
            "truck": 2,
            "bus": 1,
            "motorcycle": 3,
            "person": 10
        },
        "total": 21
    }
    
    print("\n--- Testing FirebaseSender ---")
    sender.send(test_payload)





