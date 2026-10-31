from pathlib import Path
from config import Config
from safety.consent import ConsentProvider, ConsentState
from infrastructure.exceptions import PrivacyPermissionError


class PrivacyPolicy:
    def __init__(self, config: Config, consent: ConsentProvider):
        self.config = config
        self.consent = consent

    def is_audio_storage_allowed(self):
        return self.config.enable_audio_storage and self.consent.get_state() == ConsentState.GRANTED

    def is_transcript_storage_allowed(self):
        return self.config.enable_transcript_storage and self.consent.get_state() == ConsentState.GRANTED

    def validate_data_processing_permission(self, *, external=False):
        # External transport is deliberately unavailable throughout Phase 0,
        # even with guardian consent. No env switch can override this boundary.
        if external:
            raise PrivacyPermissionError("Phase 0에서는 아동 데이터 외부 전송을 허용하지 않습니다.")
        if self.consent.get_state() != ConsentState.GRANTED:
            raise PrivacyPermissionError("검증된 보호자 동의가 필요합니다.")


def delete_local_user_data(data_root: Path) -> int:
    """Delete only allowlisted Phase-0 data files in a dedicated root.

    No arbitrary recursive deletion, symlink following, or database deletion.
    A future SQLite schema needs its own transactional deletion adapter.
    """
    root = Path(data_root)
    if any(part.is_symlink() for part in (root, *root.parents)):
        raise PrivacyPermissionError("데이터 경로의 심볼릭 링크는 허용하지 않습니다.")
    if not root.exists():
        return 0
    if not root.is_dir():
        raise PrivacyPermissionError("전용 데이터 디렉터리가 필요합니다.")
    candidates = list(root.iterdir())
    if any(p.is_symlink() or not p.is_file() or p.suffix not in {".wav", ".pcm", ".txt", ".json"} for p in candidates):
        raise PrivacyPermissionError("알 수 없는 파일이 있습니다. 삭제 어댑터를 확인하세요.")
    for path in candidates:
        path.unlink()
    return len(candidates)
