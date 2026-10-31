import platform
import sys


def system_info():
    # No hostname, username, device identifier or environment values.
    return {"os": platform.system(), "release": platform.release(),
            "architecture": platform.machine(), "python": platform.python_version(),
            "python_supported": sys.version_info >= (3, 11)}
