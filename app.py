from __future__ import annotations

import json
import os
import platform
import subprocess
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = 8765
shutdown_scheduled = False
state_lock = threading.Lock()


def shutdown_command(seconds: int) -> list[str]:
    system = platform.system()
    if system == "Windows":
        return ["shutdown", "/s", "/t", str(seconds)]
    if system == "Darwin":
        minutes = max(1, (seconds + 59) // 60)
        return ["sudo", "shutdown", "-h", f"+{minutes}"]
    minutes = max(1, (seconds + 59) // 60)
    return ["shutdown", "-h", f"+{minutes}"]


def cancel_command() -> list[str]:
    if platform.system() == "Windows":
        return ["shutdown", "/a"]
    return ["shutdown", "-c"]


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / "static"), **kwargs)

    def log_message(self, format: str, *args) -> None:
        print(f"[web] {self.address_string()} - {format % args}")

    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path not in {"/api/schedule", "/api/cancel", "/api/exit"}:
            self.send_json(404, {"ok": False, "error": "Rota não encontrada."})
            return

        try:
            global shutdown_scheduled

            if path == "/api/schedule":
                length = int(self.headers.get("Content-Length", "0"))
                data = json.loads(self.rfile.read(length) or b"{}")
                seconds = int(data.get("seconds", 0))
                if not 60 <= seconds <= 7 * 24 * 60 * 60:
                    raise ValueError("Escolha um tempo entre 1 minuto e 7 dias.")
                command = shutdown_command(seconds)
            else:
                with state_lock:
                    is_scheduled = shutdown_scheduled
                command = cancel_command() if is_scheduled else None

            if command:
                result = subprocess.run(command, capture_output=True, text=True, timeout=10)
                if result.returncode != 0:
                    message = (result.stderr or result.stdout).strip()
                    raise RuntimeError(message or "O sistema recusou o comando.")

            with state_lock:
                shutdown_scheduled = path == "/api/schedule"

            self.send_json(200, {"ok": True})
            if path in {"/api/cancel", "/api/exit"}:
                threading.Thread(target=self.server.shutdown, daemon=True).start()
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            self.send_json(400, {"ok": False, "error": str(error)})
        except Exception as error:
            self.send_json(500, {"ok": False, "error": str(error)})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}"
    print(f"Shutdown Timer disponível em {url}")
    print("Pressione Ctrl+C para encerrar o servidor.")
    if os.environ.get("SHUTDOWN_TIMER_NO_BROWSER") != "1":
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
