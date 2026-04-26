import geoip2.database
from pathlib import Path
from user_agents import parse
from supabase import create_client, Client
from datasetdoctor.core.logger import logger

class AuditLogger:
    def __init__(self, supabase_url: str, supabase_key: str):
        # 1. Initialize Supabase
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # 2. Initialize MaxMind Reader once
        # Suggestion: Put the .mmdb in your 'data' folder
        self.db_path = Path(__file__).parent.parent.parent / "mmdb" / "GeoLite2-Country.mmdb"
        
        try:
            self.reader = geoip2.database.Reader(str(self.db_path))
        except Exception as e:
            logger.info(f"⚠️ GeoIP Database not found at {self.db_path}: {e}")
            self.reader = None

    def get_geo_info(self, ip):
        """
        Uses the lightweight Country DB (4MB). 
        No city data is available in this version.
        """
        if not self.reader or ip in ["127.0.0.1", "localhost", None]:
            return {"country": "Local", "city": "N/A", "org": "Development"}

        try:
            # 1. Use the .country() method specifically
            response = self.reader.country(ip)
            
            # 2. Return only what the database actually contains
            return {
                "country": response.country.iso_code or "XX", # e.g., "ET", "US"
                "city": "—",                                  # Use a dash or N/A
                "org": "Local-Country-DB"
            }
        except Exception:
            # If the IP is private or not in the MaxMind range
            return {"country": "XX", "city": "—", "org": "Unknown"}
        
        

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
            logger.info(f"❌ Supabase Logging Failure: {e}")


    def __del__(self):
        """Cleanup: Ensure the reader closes when the app stops"""
        if hasattr(self, 'reader') and self.reader:
            self.reader.close()
