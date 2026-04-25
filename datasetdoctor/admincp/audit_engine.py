import json
import time
import uuid
from datetime import datetime
from user_agents import parse # pip install user-agents
import requests

class AuditLogger:
    def __init__(self, log_file="system_audit.log"):
        self.log_file = log_file

    def get_geo_info(self, ip):
        try:
            # Using a free API for demonstration; in production, use a local GeoIP2 DB
            response = requests.get(f"https://ipapi.co/{ip}/json/").json()
            return {
                "country": response.get("country_code"),
                "city": response.get("city"),
                "org": response.get("org")
            }
        except:
            return {"country": "XX", "city": "Unknown", "org": "Unknown"}

    def log_activity(self, user_data, action_slug, entity_id, meta_delta):
        # 1. Parse Browser/Device Info
        ua_string = user_data.get("user_agent")
        user_agent = parse(ua_string)
        
        # 2. Construct the Forensic Entry
        audit_entry = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "actor": {
                "user_id": user_data.get("id"),
                "role": user_data.get("role")
            },
            "action": {
                "slug": action_slug,
                "entity": entity_id,
                "delta": meta_delta # e.g. {"rows_affected": 500}
            },
            "environment": {
                "ip": user_data.get("ip"),
                "geo": self.get_geo_info(user_data.get("ip")),
                "device": user_agent.device.family,
                "os": user_agent.os.family,
                "browser": user_agent.browser.family
            }
        }

        # 3. High-Performance Append (No DB needed)
        with open(self.log_file, "a") as f:
            f.write(json.dumps(audit_entry) + "\n")


