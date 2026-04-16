# datasetdoctor/storage/local.py
import json
from pathlib import Path
from fastapi import UploadFile
from datasetdoctor.core import config
from .base import StorageBase


class LocalStorage(StorageBase):

    def ensure_dirs(self):
        for d in [config.UPLOAD_DIR, config.CLEAN_DIR, config.META_DIR]:
            d.mkdir(parents=True, exist_ok=True)

    def upload_path(self, dataset_id: str) -> Path:
        return config.UPLOAD_DIR / f"{dataset_id}.csv"

    def clean_path(self, dataset_id: str) -> Path:
        return config.CLEAN_DIR / f"{dataset_id}_cleaned.csv"

    def meta_path(self, dataset_id: str) -> Path:
        return config.META_DIR / f"{dataset_id}.json"

    def exists(self, path: Path) -> bool:
        return path.exists()

    def write_upload(self, dataset_id: str, file: UploadFile) -> Path:
        path = self.upload_path(dataset_id)
        path.parent.mkdir(parents=True, exist_ok=True)

        with path.open("wb") as f:
            while chunk := file.file.read(1024 * 1024):
                f.write(chunk)

        file.file.seek(0)
        return path

    def save_meta(self, dataset_id: str, data: dict) -> None:
        path = self.meta_path(dataset_id)
        path.parent.mkdir(parents=True, exist_ok=True)

        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data), encoding="utf-8")
        tmp.replace(path)

    def load_meta(self, dataset_id: str):
        path = self.meta_path(dataset_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
