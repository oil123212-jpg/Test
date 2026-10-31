from datetime import datetime, timezone, timedelta
import pytest
from realtime.auth_interface import ConnectionGrant, AuthProvider, DeviceIdentity, AuthState
from realtime.base_client import BaseRealtimeClient
from infrastructure.exceptions import AuthenticationError


def test_grant_valid_and_not_in_repr():
    grant = ConnectionGrant("secret-token", datetime.now(timezone.utc) + timedelta(minutes=5))
    grant.validate()
    assert "secret-token" not in repr(grant)
    assert "private-device" not in repr(DeviceIdentity("private-device"))
    assert DeviceIdentity("device").state == AuthState.UNAUTHENTICATED


@pytest.mark.parametrize("token, delta", [("", 300), ("secret-token", -1), ("secret-token", 10)])
def test_invalid_grant(token, delta):
    grant = ConnectionGrant(token, datetime.now(timezone.utc) + timedelta(seconds=delta))
    with pytest.raises(AuthenticationError) as error:
        grant.validate()
    assert "secret-token" not in str(error.value)


def test_naive_expiry_rejected():
    with pytest.raises(AuthenticationError):
        ConnectionGrant("token", datetime.now()).validate()


def test_interfaces_are_abstract():
    for interface in (AuthProvider, BaseRealtimeClient):
        with pytest.raises(TypeError):
            interface()
