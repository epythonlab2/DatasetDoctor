# datasetdoctor/services/insight_logger.py
from datasetdoctor.core.db import supabase

class InsightLogger:
    def __init__(self):
        # Use the already initialized client from your core/db module
        self.supabase = supabase

    def log_insight(self, task_id: str, title: str, category: str, content: str):
        data = {
            "task_id": task_id,
            "title": title,
            "category": category,
            "content": content
        }
        # execute() returns the data; we return the result for the route to handle
        return self.supabase.table("insights").insert(data).execute()
