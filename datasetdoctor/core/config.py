import os
from pathlib import Path

# -------------------------
# FILE LIMITS
# -------------------------
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB
CHUNK_SIZE = 1024 * 1024  # 1MB

# -------------------------
# DIRECTORY STRUCTURE
# -------------------------
# BASE_DIR: datasetdoctor/api
BASE_DIR = Path(__file__).resolve().parent

# ROOT_DIR: root_project (Goes up twice from api folder)
ROOT_DIR = BASE_DIR.parent.parent

# DATA DIRECTORIES
DATA_DIR = ROOT_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CLEAN_DIR = DATA_DIR / "cleaned"
META_DIR = DATA_DIR / "metadata"

# UI DIRECTORIES
STATIC_DIR = ROOT_DIR / "static"
TEMPLATES_DIR = ROOT_DIR / "templates"

# List for easy iteration during startup/reset
ALL_DATA_DIRS = [UPLOAD_DIR, CLEAN_DIR, META_DIR]

DEBUG = os.getenv("DEBUG", "False") == "True"
