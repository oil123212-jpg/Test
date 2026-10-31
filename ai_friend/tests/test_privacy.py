from dataclasses import replace
from unittest.mock import Mock
import logging
import pytest
from config import Config
from safety.consent import ConsentState, UnverifiedConsent
from safety.privacy import PrivacyPolicy, delete_local_user_data
from infrastructure.exceptions import PrivacyPermissionError
from infrastructure.logger import configure_logging, log_event


def test_default_consent_and_storage():
    consent = UnverifiedConsent()
    policy = PrivacyPolicy(Config(), consent)
    assert consent.get_state() == ConsentState.NOT_REQUESTED
    assert not policy.is_audio_storage_allowed()
    assert not policy.is_transcript_storage_allowed()
    consent.request_consent()
    assert consent.get_state() == ConsentState.PENDING
    consent.revoke_consent()
    assert consent.get_state() == ConsentState.REVOKED


@pytest.mark.parametrize("state", list(ConsentState))
def test_external_transfer_blocked_even_with_consent(state):
    consent = Mock()
    consent.get_state.return_value = state
    policy = PrivacyPolicy(Config(), consent)
    with pytest.raises(PrivacyPermissionError):
        policy.validate_data_processing_permission(external=True)


def test_local_permission_and_storage_revocation():
    consent = Mock()
    policy = PrivacyPolicy(replace(Config(), enable_audio_storage=True, enable_transcript_storage=True), consent)
    consent.get_state.return_value = ConsentState.GRANTED
    policy.validate_data_processing_permission()
    assert policy.is_audio_storage_allowed()
    assert policy.is_transcript_storage_allowed()
    consent.get_state.return_value = ConsentState.REVOKED
    assert not policy.is_audio_storage_allowed()
    with pytest.raises(PrivacyPermissionError):
        policy.validate_data_processing_permission()


def test_delete_data(tmp_path):
    data = tmp_path / "user_data"
    data.mkdir()
    (data / "voice.wav").write_bytes(b"audio")
    (data / "transcript.txt").write_text("private")
    assert delete_local_user_data(data) == 2
    assert delete_local_user_data(data) == 0
    assert delete_local_user_data(tmp_path / "absent") == 0


def test_delete_refuses_unknown_files(tmp_path):
    (tmp_path / "source.py").write_text("preserve")
    with pytest.raises(PrivacyPermissionError):
        delete_local_user_data(tmp_path)
    assert (tmp_path / "source.py").exists()


def test_delete_refuses_symlinks(tmp_path):
    target = tmp_path / "outside.txt"
    target.write_text("preserve")
    data = tmp_path / "user_data"
    data.mkdir()
    try:
        (data / "link.txt").symlink_to(target)
    except OSError:
        pytest.skip("OS does not permit creating symlinks")
    with pytest.raises(PrivacyPermissionError):
        delete_local_user_data(data)
    assert target.exists()


def test_logs_exclude_private_payloads_and_rotate(tmp_path):
    logger = configure_logging("DEBUG", tmp_path)
    log_event("program_start", api_key="secret-api-key", name="child-name", frames=12,
              transcript="private-transcript", sample_rate="private-sample", error_type="secret-token")
    logger.debug("child-name secret-api-key private-transcript")
    logger.info("program_start", extra={"operational": True}, exc_info=(ValueError, ValueError("secret-token"), None))
    content = (tmp_path / "operations.log").read_text()
    for private in ("child-name", "secret-api-key", "private-transcript", "private-sample", "secret-token"):
        assert private not in content
    assert "frames" in content
    handler = logger.handlers[-1]
    handler.maxBytes = 120
    for _ in range(20):
        log_event("program_end")
    assert (tmp_path / "operations.log.1").exists()
    configure_logging()


@pytest.mark.parametrize("state", [ConsentState.NOT_REQUESTED, ConsentState.PENDING, ConsentState.REVOKED])
def test_local_data_processing_requires_granted_consent(state):
    consent = Mock()
    consent.get_state.return_value = state
    with pytest.raises(PrivacyPermissionError):
        PrivacyPolicy(Config(), consent).validate_data_processing_permission()


def test_delete_refuses_symlinked_parent(tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    data = real / "user_data"
    data.mkdir()
    (data / "audio.wav").write_bytes(b"preserve")
    alias = tmp_path / "alias"
    try:
        alias.symlink_to(real, target_is_directory=True)
    except OSError:
        pytest.skip("OS does not permit creating symlinks")
    with pytest.raises(PrivacyPermissionError):
        delete_local_user_data(alias / "user_data")
    assert (data / "audio.wav").read_bytes() == b"preserve"
