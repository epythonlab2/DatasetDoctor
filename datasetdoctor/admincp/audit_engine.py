import uuid
import requests
from datetime import datetime
from user_agents import parse
from supabase import create_client, Client

class AuditLogger:
    def __init__(self, supabase_url: str, supabase_key: str):
        """
        Initializes the Supabase client for cloud-persistent logging.
        """
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def get_geo_info(self, ip):
        # Keeps your original logic for GeoIP resolution
        try:
            if ip in ["127.0.0.1", "localhost", None]:
                return {"country": "Local", "city": "Host", "org": "Development"}
                
            response = requests.get(f"https://ipapi.co/{ip}/json/", timeout=3).json()
            return {
                "country": response.get("country_code", "XX"),
                "city": response.get("city", "Unknown"),
                "org": response.get("org", "Unknown")
            }
        except:
            return {"country": "XX", "city": "Unknown", "org": "Unknown"}

    def log_activity(self, user_data, action_slug, entity_id, meta_delta):
        """
        Constructs the Forensic Entry and pushes to Supabase.
        """
        # 1. Parse Browser/Device Info
        ua_string = user_data.get("user_agent", "")
        user_agent = parse(ua_string)
        
        # 2. Construct the Entry (Matching your original schema)
        audit_entry = {
            "actor": {
                "user_id": user_data.get("id"),
                "role": user_data.get("role")
            },
            "action": {
                "slug": action_slug,
                "entity": entity_id,
                "delta": meta_delta
            },
            "environment": {
                "ip": user_data.get("ip"),
                "geo": self.get_geo_info(user_data.get("ip")),
                "device": user_agent.device.family,
                "os": user_agent.os.family,
                "browser": user_agent.browser.family
            }
        }

        # 3. Cloud-Persistent Insert
        try:
            self.supabase.table("audit_logs").insert(audit_entry).execute()
        except Exception as e:
            print(f"❌ Supabase Logging Failure: {e}")
