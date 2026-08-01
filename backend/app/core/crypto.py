import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import get_settings


_def_settings = get_settings()
_seed = _def_settings.encryption_key or _def_settings.secret_key
_key = base64.urlsafe_b64encode(hashlib.sha256(_seed.encode("utf-8")).digest())
_fernet = Fernet(_key)


def encrypt_value(value: str) -> str:
    return _fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    return _fernet.decrypt(value.encode("utf-8")).decode("utf-8")
