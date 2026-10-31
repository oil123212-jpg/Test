"""Close streams even when PortAudio fails while starting them."""
from contextlib import contextmanager


@contextmanager
def managed_stream(stream):
    completed = False
    try:
        stream.start()
        yield stream
        completed = True
    finally:
        try:
            if completed:
                stream.stop()
            else:
                stream.abort()
        finally:
            stream.close()
