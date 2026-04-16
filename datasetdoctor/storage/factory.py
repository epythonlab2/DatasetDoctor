from datasetdoctor.core import config
from .local import LocalStorage


def get_storage():
    return LocalStorage()


storage = get_storage()
