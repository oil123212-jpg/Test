import main


def test_system_info_without_audio_or_network(monkeypatch, capsys):
    monkeypatch.setattr("audio.devices.backend", lambda: (_ for _ in ()).throw(AssertionError("No hardware access expected")))
    assert main.main(["--system-info"]) == 0
    assert '"python_supported": true' in capsys.readouterr().out


def test_devices_does_not_record(monkeypatch, fake_audio):
    monkeypatch.setattr("audio.microphone.record_microphone", lambda **kw: (_ for _ in ()).throw(AssertionError("No recording expected")))
    assert main.main(["--devices"]) == 0
    fake_audio.InputStream.assert_not_called()
    fake_audio.OutputStream.assert_not_called()


def test_microphone_only_clears_and_does_not_play(fake_audio):
    assert main.main(["--test-microphone"]) == 0
    fake_audio.OutputStream.assert_not_called()


def test_invalid_cli_device():
    assert main.main(["--devices", "--input-device", "-1"]) == 1
