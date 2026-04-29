# analysis/core/audit.py

import geoip2.database
import ipaddress
from pathlib import Path
from typing import Dict, Any, Optional
from user_agents import parse
from supabase import create_client, Client
from datasetdoctor.core.logger import logger


class AuditLogger:
    """
    Handles telemetry and security auditing for the DatasetDoctor platform.

    This service enriches user activity logs with geographical data (via MaxMind),
    device/browser information (via user_agents), and persists the resulting
    audit trail to Supabase.
    """

    def __init__(self, supabase_url: str, supabase_key: str):
        """
        Initializes connections to Supabase and MaxMind.

        Args:
            supabase_url (str): The Supabase project URL.
            supabase_key (str): The Supabase service role or anon key.
        """
        self.supabase: Client = create_client(supabase_url, supabase_key)
        
        # Pathing: Adjust relative to this file's location
        self.db_path = (
            Path(__file__).parent.parent.parent / "mmdb" / "GeoLite2-Country.mmdb"
        )
        
        try:
            self.reader = geoip2.database.Reader(str(self.db_path))
        except Exception as e:
            logger.warning(f"AuditLogger: GeoIP Database not found at {self.db_path}. Geo-enrichment disabled.")
            self.reader = None

    def get_geo_info(self, ip: str) -> Optional[Dict[str, str]]:
        """
        Retrieves country-level geographical info for a given IP.

        Args:
            ip (str): The remote user's IP address.

        Returns:
            Optional[Dict[str, str]]: Dictionary containing country, city, and provider info.
        """
        if not self.reader or not ip:
            return None

        try:
            response = self.reader.country(ip)
            return {
                "country": response.country.name or "Unknown",
                "city": "—",
                "org": "MaxMind-GeoLite2"
            }
        except Exception:
            # Captures 'AddressNotFound' or invalid IP formats
            return {
                "country": "Unknown",
                "city": "—",
                "org": "Unknown"
            }

    def is_local_ip(self, ip: Optional[str]) -> bool:
        """
        Checks if an IP is a local or private network address.

        Args:
            ip (str, optional): The IP address to validate.

        Returns:
            bool: True if the IP is localhost or within a private CIDR block.
        """
        if not ip or ip in ["localhost", "127.0.0.1"]:
            return True
        
        try:
            addr = ipaddress.ip_address(ip)
            return addr.is_private or addr.is_loopback
        except ValueError:
            return True

    def log_activity(
        self, 
        user_data: Dict[str, Any], 
        action_slug: str, 
        entity_id: str, 
        meta_delta: Dict[str, Any]
    ) -> None:
        """
        Processes and sends an audit entry to the Supabase 'audit_logs' table.

        Args:
            user_data (Dict[str, Any]): Context including 'id', 'role', 'ip', and 'user_agent'.
            action_slug (str): Unique identifier for the action (e.g., 'file_upload').
            entity_id (str): UUID or ID of the object being modified.
            meta_delta (Dict[str, Any]): Changes or metadata produced by the action.
        """
        ip = user_data.get("ip")

        # Skip logging for internal development traffic
        if self.is_local_ip(ip):
            return

        ua_string = user_data.get("user_agent", "")
        ua = parse(ua_string)

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
                "ip": ip,
                "geo": self.get_geo_info(ip),
                "device": ua.device.family,
                "os": ua.os.family,
                "browser": ua.browser.family
            }
        }

        try:
            self.supabase.table("audit_logs").insert(audit_entry).execute()
        except Exception as e:
            logger.error(f"AuditLogger: Supabase persistence failure: {e}")

    def close(self):
        """Explicitly closes the MaxMind database reader."""
        if self.reader:
            self.reader.close()

    def __del__(self):
        self.close()
