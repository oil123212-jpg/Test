from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum
from infrastructure.exceptions import AuthenticationError


class AuthState(Enum):
    UNAUTHENTICATED = "unauthenticated"
    AUTHENTICATED = "authenticated"
    EXPIRED = "expired"
    FAILED = "failed"


@dataclass(frozen=True)
class DeviceIdentity:
    device_id: str = field(repr=False)
    state: AuthState = AuthState.UNAUTHENTICATED


@dataclass(frozen=True)
class ConnectionGrant:
    token: str = field(repr=False)
    expires_at: datetime

    def validate(self, now: datetime | None = None, margin_seconds: int = 30):
        now = now or datetime.now(timezone.utc)
        if self.expires_at.utcoffset() is None or now.utcoffset() is None:
            raise AuthenticationError("Timezone-aware token expiry required")
        if margin_seconds < 0:
            raise AuthenticationError("Invalid expiry safety margin")
        if not self.token or self.expires_at <= now + timedelta(seconds=margin_seconds):
            raise AuthenticationError("Connection grant missing or expired")


class AuthProvider(ABC):
    @abstractmethod
    async def acquire_grant(self, identity: DeviceIdentity) -> ConnectionGrant:
        raise NotImplementedError

    @abstractmethod
    async def refresh_grant(self, identity: DeviceIdentity, previous: ConnectionGrant) -> ConnectionGrant:
        raise NotImplementedError

    @abstractmethod
    async def revoke_grant(self, identity: DeviceIdentity) -> None:
        raise NotImplementedError
