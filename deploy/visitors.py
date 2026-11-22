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
import unicodedata
from urllib.parse import urlsplit

API = "/api/visitor"
COOKIE = "neverland-pass"
TOKEN = re.compile(r"[0-9a-f]{32}")
NAME_LIMIT = 24
# Names roll publicly at the end of the epilogue. Fragments are matched anywhere after
# folding case, width, spacing, punctuation and common digit swaps; WORDS only as whole words,
# so "class" or "Dickens" still pass.
FRAGMENTS = (
    "fuck", "fuk", "shit", "cunt", "bitch", "whore", "slut", "nigger", "nigga", "faggot", "retard",
    "motherf", "pussy", "asshole", "bastard", "wanker", "dildo", "porn", "penis", "vagina", "hitler", "nazi",
    "傻逼", "傻b", "煞笔", "沙比", "傻屄", "装逼", "牛逼", "屌", "肏", "操你", "草你", "艹你", "日你", "干你",
    "你妈", "他妈", "她妈", "尼玛", "妈的", "妈逼", "狗日", "鸡巴", "几把", "婊子", "贱人", "贱货", "骚货",
    "妓女", "强奸", "杂种", "畜生", "去死", "滚蛋", "废物", "脑残", "智障", "白痴", "弱智", "王八蛋", "龟儿子",
    "shabi", "caonima", "nmsl", "wcnm", "mdzz", "cnm", "tmd", "nmb",
)
WORDS = {"ass", "dick", "cock", "fag", "tits", "piss", "rape", "sex", "anal", "cum", "sb", "jb", "nm"}
LEET = str.maketrans("013457@$!", "oieastasi")


def is_profane(name):
    text = unicodedata.normalize("NFKC", name).casefold().translate(LEET)
    words = re.findall(r"[a-z]+", text)
    squeezed = "".join(ch for ch in text if ch.isalnum())
    return any(fragment in squeezed for fragment in FRAGMENTS) or any(word in WORDS for word in words)


def identity(secret):
    return sha256(secret.encode()).hexdigest()


def membership(db, key):
    row = db.execute("SELECT number, verified_at, name FROM visitors WHERE browser = ?", (key,)).fetchone()
    if not row:
        return {"number": None, "verified": False, "name": None}
    return {"number": row[0], "verified": time.time() < row[1] + 86400, "name": row[2]}


def clean_name(value):
    # One visible line of at most NAME_LIMIT characters; an empty name means "leave no name".
    if not isinstance(value, str):
        raise ValueError
    name = " ".join("".join(ch for ch in value if ch.isprintable()).split())
    if len(name) > NAME_LIMIT:
        raise ValueError
    if name and is_profane(name):
        raise LookupError
    return name or None


def sign(db, key, data):
    name = clean_name(data.get("name"))
    status = membership(db, key)
    if not status["verified"]:
        raise PermissionError
    db.execute("UPDATE visitors SET name = ? WHERE number = ?", (name, status["number"]))
    return {"number": status["number"], "name": name}


def roster(db):
    rows = db.execute("SELECT number, name FROM visitors WHERE name IS NOT NULL ORDER BY number").fetchall()
    return [{"number": number, "name": name} for number, name in rows]


def certify(db, key, data):
    # Both Stage 3 recordings must meet the same voiced-frame minimum as the client.
    frames = data.get("voicedFrames")
    if not isinstance(frames, list) or len(frames) != 2 or any(type(n) is not int or n < 6 for n in frames):
        raise ValueError
    # Serialize the decision and allocation, including retries after a lost response.
    db.execute("BEGIN IMMEDIATE")
    existing = membership(db, key)
    if existing["verified"]:
        return existing
    now = int(time.time())
    if existing["number"] is None:
        assigned = db.execute("INSERT INTO visitors(browser, verified_at) VALUES (?, ?)", (key, now)).lastrowid
    else:
        assigned = existing["number"]
        db.execute("UPDATE visitors SET verified_at = ? WHERE number = ?", (now, assigned))
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
        if self.server.preview and path == "/jury.html":
            self.send_response(302)
            self.send_header("Location", "/stage3.html" + ("?" + urlsplit(self.path).query if urlsplit(self.path).query else ""))
            self.end_headers()
            return
        if path in (API, API + "/check", API + "/names") or self.server.preview and path in ("/pass.html", "/forum.html"):
            secret = self.cookie()
            with closing(sqlite3.connect(self.server.db)) as db:
                status = membership(db, identity(secret)) if secret else {"number": None, "verified": False}
                names = roster(db) if path == API + "/names" else None
            if path == API:
                return self.reply(200, status)
            if names is not None:
                return self.reply(200, {"visitors": names})
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
        if path not in (API + "/complete", API + "/name"):
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
                result = (certify if path.endswith("/complete") else sign)(db, identity(secret), data)
        except (ValueError, UnicodeError):
            return self.reply(400)
        except PermissionError:
            return self.reply(401)
        except LookupError:
            return self.reply(422)
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
        """)
        if "name" not in {column[1] for column in db.execute("PRAGMA table_info(visitors)")}:
            db.execute("ALTER TABLE visitors ADD COLUMN name TEXT")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    server.db, server.preview = args.db, args.preview
    server.serve_forever()
