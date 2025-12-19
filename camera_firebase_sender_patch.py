"""
FirebaseSender Patch - Drop-in Replacement
==========================================

Copy this class into your camera code to replace the existing FirebaseSender class.
This version adds dual-sending support while maintaining 100% backward compatibility.

IMPORTANT: Only replace the FirebaseSender class, keep everything else unchanged.
"""

# --- Firebase sender (modified for dual-sending, backward compatible) ---
class FirebaseSender:
    def __init__(self):
        # PRIMARY endpoint (Production) - REQUIRED, works exactly as before
        self.url = safe_env_get("FIREBASE_INGEST_URL", "").strip()
        self.api_key = safe_env_get("FIREBASE_API_KEY", "").strip()
        
        # SECONDARY endpoint (Staging) - OPTIONAL, only if you want dual sending
        self.url_staging = safe_env_get("FIREBASE_INGEST_URL_STAGING", "").strip()
        self.api_key_staging = safe_env_get("FIREBASE_API_KEY_STAGING", "").strip()
        
        # Common settings (unchanged)
        self.site_id = safe_env_get("SITE_ID", "demo-site").strip()
        self.camera_id = safe_env_get("CAMERA_ID", "usb-cam-1").strip()
        
        # Enabled if primary URL exists (same logic as original)
        self.enabled = bool(self.url)
    
    def send(self, payload: dict):
        """
        Send payload to Firebase.
        
        Always sends to production first (unchanged behavior).
        Optionally sends to staging if configured.
        """
        if not self.enabled:
            return
        
        # ALWAYS send to production first (unchanged - this is your production flow)
        self._send_single(self.url, self.api_key, payload, "Production")
        
        # OPTIONALLY send to staging (only if FIREBASE_INGEST_URL_STAGING is set)
        if self.url_staging:
            self._send_single(self.url_staging, self.api_key_staging, payload, "Staging")
    
    def _send_single(self, url: str, api_key: str, payload: dict, env_name: str):
        """
        Send to a single endpoint.
        
        Isolated - failures here don't affect other sends.
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
        except Exception as e:
            print(f"❌ {env_name} send exception: {e}")
            # Exception is caught - doesn't stop other send



