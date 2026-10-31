from audio.microphone import record_microphone
from audio.speaker import Speaker


def run_audio_test(config, request_playback=None):
    """Record first; playback only after a fresh explicit request. No file writes."""
    recording = record_microphone(sample_rate=config.audio_sample_rate,
                                  channels=config.audio_channels, device=config.audio_input_device)
    speaker = Speaker(config.audio_output_device)
    try:
        print(f"녹음 완료: {len(recording.pcm)} 프레임, RMS={recording.rms:.3f}, peak={recording.peak:.3f}, clipping={recording.clipped}")
        if request_playback is None:
            approved = input("녹음한 소리를 재생할까요? 재생하려면 PLAY 입력: ").strip() == "PLAY"
        else:
            approved = request_playback() is True
        if approved:
            speaker.play(recording.pcm, recording.sample_rate)
    finally:
        speaker.stop()
        recording.clear()
