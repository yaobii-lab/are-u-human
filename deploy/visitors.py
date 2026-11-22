"""Neverland visitor registry. Production runs behind nginx on loopback."""
import argparse
from contextlib import closing
from hashlib import sha256
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sqlite3
import time
from urllib.parse import urlsplit

API = "/api/visitor"
ANSWERS = ["human", "agent", "human"]
COOKIE = "neverland-pass"
TOKEN = re.compile(r"[0-9a-f]{32}")


def identity(secret):
    return sha256(secret.encode()).hexdigest()


def membership(db, key):
    row = db.execute("SELECT number, verified_at FROM visitors WHERE browser = ?", (key,)).fetchone()
    if not row:
        return {"number": None, "verified": False}
    return {"number": row[0], "verified": time.time() < row[1] + 86400}


def certify(db, key, action, data):
    # Serialize the decision and allocation, including retries after a lost response.
    db.execute("BEGIN IMMEDIATE")
    existing = membership(db, key)
    if existing["verified"]:
        return existing
    if action == "jury":
        if data.get("answers") != ANSWERS:
            answers = data.get("answers")
            if not isinstance(answers, list) or len(answers) != 3 or any(a not in ("human", "agent") for a in answers):
                raise ValueError
            db.execute("INSERT OR IGNORE INTO pending VALUES (?, 0)", (key,))
            votes = db.execute("SELECT votes FROM pending WHERE browser = ?", (key,)).fetchone()[0]
            return {"votes": votes}
    elif action == "vouch":
        step = data.get("step")
        row = db.execute("SELECT votes FROM pending WHERE browser = ?", (key,)).fetchone()
        if not row or type(step) is not int or not 1 <= step <= row[0] + 1:
            raise ValueError
        votes = max(step, row[0])
        if votes < 3:
            db.execute("UPDATE pending SET votes = ? WHERE browser = ?", (votes, key))
            return {"votes": votes}
    else:
        raise ValueError
    now = int(time.time())
    if existing["number"] is None:
        assigned = db.execute("INSERT INTO visitors(browser, verified_at) VALUES (?, ?)", (key, now)).lastrowid
    else:
        assigned = existing["number"]
        db.execute("UPDATE visitors SET verified_at = ? WHERE number = ?", (now, assigned))
    db.execute("DELETE FROM pending WHERE browser = ?", (key,))
    return {"number": assigned}


class Handler(SimpleHTTPRequestHandler):
    def reply(self, status, data=None, secret=None):
        body = json.dumps(data).encode() if data is not None else b""
        self.send_response(status)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if secret:
            attrs = "" if self.server.preview else "; Domain=ariari.art; Secure"
            self.send_header("Set-Cookie", f"{COOKIE}={secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=34560000{attrs}")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def cookie(self):
        jar = SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
        except CookieError:
            return None
        value = jar[COOKIE].value if COOKIE in jar else ""
        return value if TOKEN.fullmatch(value) else None

    def do_GET(self):
        path = urlsplit(self.path).path
        if path in (API, API + "/check") or self.server.preview and path in ("/pass.html", "/forum.html"):
            secret = self.cookie()
            with closing(sqlite3.connect(self.server.db)) as db:
                status = membership(db, identity(secret)) if secret else {"number": None, "verified": False}
            if path == API:
                return self.reply(200, status)
            if path.endswith("/check"):
                return self.reply(204 if status["verified"] else 401)
            if not status["verified"]:
                self.send_response(302)
                self.send_header("Location", "/start.html" + ("?" + urlsplit(self.path).query if urlsplit(self.path).query else ""))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
        if self.server.preview and not path.startswith(API):
            return super().do_HEAD() if self.command == "HEAD" else super().do_GET()
        self.reply(404)

    do_HEAD = do_GET

    def do_POST(self):
        path = urlsplit(self.path).path
        if path not in (API + "/jury", API + "/vouch"):
            return self.reply(404)
        origin = self.headers.get("Origin", "")
        allowed = f"http://127.0.0.1:{self.server.server_port}" if self.server.preview else "https://portal.ariari.art"
        if origin != allowed or self.headers.get_content_type() != "application/json":
            return self.reply(403)
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 1024:
                raise ValueError
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError
            secret = self.cookie() or data.get("browser")
            if not isinstance(secret, str) or not TOKEN.fullmatch(secret):
                raise ValueError
            with closing(sqlite3.connect(self.server.db, timeout=10)) as db, db:
                result = certify(db, identity(secret), path.rsplit("/", 1)[1], data)
        except (ValueError, UnicodeError):
            return self.reply(400)
        except sqlite3.Error:
            return self.reply(503)
        self.reply(200, result, secret if result.get("number") else None)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    parser.add_argument("--port", type=int, default=28374)
    parser.add_argument("--preview", action="store_true", help="also serve the current directory locally")
    args = parser.parse_args()
    if args.preview and (args.db.resolve() == Path.cwd() or Path.cwd() in args.db.resolve().parents):
        parser.error("place the preview database outside the document root")
    with closing(sqlite3.connect(args.db)) as db, db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS visitors(number INTEGER PRIMARY KEY, browser TEXT NOT NULL UNIQUE, verified_at INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS pending(browser TEXT PRIMARY KEY, votes INTEGER NOT NULL);
        """)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.db, server.preview = args.db, args.preview
    server.serve_forever()
