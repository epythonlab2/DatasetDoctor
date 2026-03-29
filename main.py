import os
import uvicorn
from datasetdoctor.api.api_routes import app

if __name__ == "__main__":
    uvicorn.run(
        "api.api_routes:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )