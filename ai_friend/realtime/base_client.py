from abc import ABC, abstractmethod
from enum import Enum
from collections.abc import AsyncIterator


class ConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    ERROR = "error"


class BaseRealtimeClient(ABC):
    """Phase 1 provider adapters must enforce privacy before connecting/sending."""
    @abstractmethod
    async def connect(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def disconnect(self) -> None:
        raise NotImplementedError

    @abstractmethod
    async def send_audio(self, pcm16: bytes) -> None:
        raise NotImplementedError

    @abstractmethod
    def receive_events(self) -> AsyncIterator[dict]:
        raise NotImplementedError

    @abstractmethod
    async def cancel_response(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def get_connection_state(self) -> ConnectionState:
        raise NotImplementedError
