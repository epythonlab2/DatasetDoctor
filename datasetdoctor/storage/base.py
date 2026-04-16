# datasetdoctor/storage/base.py
from abc import ABC, abstractmethod
from pathlib import Path
from fastapi import UploadFile


class StorageBase(ABC):

    # paths
    @abstractmethod
    def upload_path(self, dataset_id: str) -> Path: ...
    
    @abstractmethod
    def clean_path(self, dataset_id: str) -> Path: ...

    @abstractmethod
    def meta_path(self, dataset_id: str) -> Path: ...

    # lifecycle
    @abstractmethod
    def ensure_dirs(self) -> None: ...

    # metadata
    @abstractmethod
    def save_meta(self, dataset_id: str, data: dict) -> None: ...

    @abstractmethod
    def load_meta(self, dataset_id: str) -> dict | None: ...

    # file ops
    @abstractmethod
    def write_upload(self, dataset_id: str, file: UploadFile) -> Path: ...

    @abstractmethod
    def exists(self, path: Path) -> bool: ...
