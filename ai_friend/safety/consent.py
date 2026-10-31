from abc import ABC, abstractmethod
from enum import Enum


class ConsentState(Enum):
    NOT_REQUESTED = "not_requested"
    PENDING = "pending"
    GRANTED = "granted"
    REVOKED = "revoked"


class ConsentProvider(ABC):
    """Future verified guardian workflow. No fake identity verification in Phase 0."""
    @abstractmethod
    def get_state(self) -> ConsentState:
        raise NotImplementedError

    @abstractmethod
    def request_consent(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def revoke_consent(self) -> None:
        raise NotImplementedError


class UnverifiedConsent(ConsentProvider):
    def __init__(self):
        self._state = ConsentState.NOT_REQUESTED

    def get_state(self):
        return self._state

    def request_consent(self):
        self._state = ConsentState.PENDING

    def revoke_consent(self):
        self._state = ConsentState.REVOKED
