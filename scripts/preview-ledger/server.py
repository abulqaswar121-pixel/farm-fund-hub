#!/usr/bin/env python3
"""
Preview ledger — a local PostgREST + GoTrue subset over a local PostgreSQL
database, so the NDH AgriCapital app can be previewed offline.

This is development tooling. It is never used in production: production talks to
the real Supabase project, where PostgREST and GoTrue do these jobs properly and
under their own security model. Nothing here is a substitute for them.

It exists because a build sandbox has no route to supabase.co, and a ledger app
that renders empty states everywhere cannot be reviewed.

What it does faithfully:
  * every request runs as `anon`, `authenticated` or `service_role` with
    `request.jwt.claim.sub` set, so the real Row Level Security policies and
    `auth.uid()` behave exactly as they do behind PostgREST;
  * the settlement, rollover and transfer functions are the real ones.

What it does not do: embedded resource selects, full-text search, storage,
realtime, and anything else the app does not use.

Run:
    python3 scripts/preview-ledger/server.py            # 0.0.0.0:8788
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

import psycopg
from psycopg.rows import dict_row

DSN = os.environ.get("PREVIEW_LEDGER_DSN", "postgresql://postgres:@/postgres?host=/tmp/pgdata")
PORT = int(os.environ.get("PREVIEW_LEDGER_PORT", "8788"))
JWT_SECRET = os.environ.get("PREVIEW_LEDGER_JWT_SECRET", "ndh-agricapital-preview-secret")
ANON_KEY = os.environ.get("PREVIEW_LEDGER_ANON_KEY", "sb_publishable_preview_anon_key")
SERVICE_KEY = os.environ.get("PREVIEW_LEDGER_SERVICE_KEY", "sb_secret_preview_service_key")
ACCESS_TTL = 3600
REFRESH_TTL = 60 * 60 * 24 * 30

IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")


# --------------------------------------------------------------------------- #
# JWT (HS256). Supabase signs with its own keys; nothing outside this process
# validates these tokens, so a shared local secret is enough.
# --------------------------------------------------------------------------- #
def b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def b64d(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def sign_jwt(payload: dict) -> str:
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    body = b64(json.dumps(payload, separators=(",", ":")).encode())
    signature = b64(hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{signature}"


def read_jwt(token: str) -> dict | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header, body, signature = parts
    expected = b64(hmac.new(JWT_SECRET.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(expected, signature):
        return None
    try:
        claims = json.loads(b64d(body))
    except Exception:
        return None
    if claims.get("exp") and claims["exp"] < time.time():
        return None
    return claims


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"pbkdf2${b64(salt)}${b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt, digest = stored.split("$")
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), b64d(salt), 120_000)
        return hmac.compare_digest(candidate, b64d(digest))
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# PostgREST query translation
# --------------------------------------------------------------------------- #
OPS = {
    "eq": "=",
    "neq": "<>",
    "gt": ">",
    "gte": ">=",
    "lt": "<",
    "lte": "<=",
    "like": "LIKE",
    "ilike": "ILIKE",
}


def parse_value(raw: str):
    if raw == "null":
        return None
    if raw == "true":
        return True
    if raw == "false":
        return False
    return raw


def split_list(raw: str) -> list[str]:
    """Parse a PostgREST list argument, e.g. (a,b,\"c,d\")."""
    inner = raw[1:-1] if raw.startswith("(") and raw.endswith(")") else raw
    out, current, quoted = [], "", False
    for char in inner:
        if char == '"':
            quoted = not quoted
            continue
        if char == "," and not quoted:
            out.append(current)
            current = ""
            continue
        current += char
    if current:
        out.append(current)
    return out


def build_where(params: list[tuple[str, str]], start: int = 1):
    """Turn PostgREST filter params into SQL + values."""
    clauses: list[str] = []
    values: list[object] = []
    for key, raw in params:
        if key in {"select", "order", "limit", "offset", "on_conflict", "columns"}:
            continue
        if not IDENT.match(key):
            continue
        negate = False
        expr = raw
        if expr.startswith("not."):
            negate = True
            expr = expr[4:]

        if "." not in expr:
            continue
        op, _, operand = expr.partition(".")
        column = f'"{key}"'

        if op == "is":
            piece = f"{column} IS {'NULL' if operand == 'null' else operand.upper()}"
            clauses.append(f"NOT ({piece})" if negate else piece)
            continue
        if op == "in":
            items = split_list(operand)
            placeholders = ", ".join(["%s"] * len(items))
            piece = f"{column} IN ({placeholders})"
            clauses.append(f"NOT ({piece})" if negate else piece)
            values.extend(parse_value(item) for item in items)
            continue
        if op in OPS:
            piece = f"{column} {OPS[op]} %s"
            clauses.append(f"NOT ({piece})" if negate else piece)
            values.append(parse_value(operand))
            continue
    if not clauses:
        return "", values
    return " WHERE " + " AND ".join(clauses), values


def build_order(raw: str | None) -> str:
    if not raw:
        return ""
    parts = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        column, _, direction = token.partition(".")
        if not IDENT.match(column):
            continue
        nulls = ""
        if "." in direction:
            direction, _, nulls_raw = direction.partition(".")
            nulls = " NULLS FIRST" if nulls_raw == "nullsfirst" else " NULLS LAST"
        parts.append(f'"{column}" {"DESC" if direction == "desc" else "ASC"}{nulls}')
    return " ORDER BY " + ", ".join(parts) if parts else ""


def select_list(raw: str | None) -> str:
    if not raw or raw.strip() in {"", "*"}:
        return "*"
    columns = []
    for token in raw.split(","):
        token = token.strip()
        if not token:
            continue
        # strip any cast / rename the app does not use
        token = token.split("::")[0].strip()
        if token == "*" or IDENT.match(token):
            columns.append("*" if token == "*" else f'"{token}"')
    return ", ".join(columns) if columns else "*"


def clean_row(row: dict) -> dict:
    out = {}
    for key, value in row.items():
        if hasattr(value, "isoformat"):
            value = value.isoformat()
        elif isinstance(value, uuid.UUID):
            value = str(value)
        elif isinstance(value, (int, float, str, bool)) or value is None:
            pass
        else:
            value = float(value) if hasattr(value, "as_tuple") else str(value)
        out[key] = value
    return out


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    server_version = "PreviewLedger/1.0"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # quieter logs
        if os.environ.get("PREVIEW_LEDGER_VERBOSE"):
            sys.stderr.write("[preview-ledger] " + fmt % args + "\n")

    # ---------------------------------------------------------------- helpers
    def send_json(self, status: int, payload, extra: dict | None = None):
        body = b"" if self.command == "HEAD" else json.dumps(payload, default=str).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Expose-Headers", "Content-Range")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_empty(self, status: int, extra: dict | None = None):
        self.send_response(status)
        self.send_header("Content-Length", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Expose-Headers", "Content-Range")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()

    def read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def token(self) -> str:
        auth = self.headers.get("Authorization") or ""
        if auth.lower().startswith("bearer "):
            return auth[7:].strip()
        return ""

    def identity(self) -> tuple[str, str | None, dict]:
        """Return (role, subject, claims) for this request."""
        raw = self.token() or self.headers.get("apikey") or ""
        if raw in {SERVICE_KEY}:
            return "service_role", None, {}
        claims = read_jwt(raw) if raw else None
        if claims:
            role = claims.get("role") or "authenticated"
            if role not in {"anon", "authenticated", "service_role"}:
                role = "authenticated"
            return role, claims.get("sub"), claims
        if raw in {ANON_KEY} or not raw:
            return "anon", None, {}
        return "anon", None, {}

    def connect(self):
        return psycopg.connect(DSN, row_factory=dict_row)

    # ------------------------------------------------------------------ verbs
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,HEAD,OPTIONS")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        self.route("GET")

    def do_HEAD(self):
        self.route("HEAD")

    def do_POST(self):
        self.route("POST")

    def do_PATCH(self):
        self.route("PATCH")

    def do_DELETE(self):
        self.route("DELETE")

    def do_PUT(self):
        self.route("PUT")

    def route(self, method: str):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query, keep_blank_values=True)
        flat: list[tuple[str, str]] = []
        for key, values in params.items():
            for value in values:
                flat.append((key, unquote(value)))

        try:
            if path.startswith("/auth/v1"):
                return self.handle_auth(method, path, flat)
            if path.startswith("/rest/v1"):
                return self.handle_rest(method, path, flat)
            if path == "/health":
                return self.send_json(200, {"status": "ok"})
            return self.send_json(404, {"message": "Not found"})
        except psycopg.Error as exc:
            message = str(exc).strip().splitlines()[0] if str(exc).strip() else "Database error"
            code = getattr(exc, "sqlstate", None) or "PGRST000"
            return self.send_json(
                400, {"message": message, "code": code, "details": None, "hint": None}
            )
        except Exception as exc:  # pragma: no cover - defensive
            return self.send_json(
                500, {"message": f"preview-ledger: {exc}", "code": "PGRST000", "details": None}
            )

    # ------------------------------------------------------------------- auth
    def session_payload(self, user: dict) -> dict:
        now = int(time.time())
        claims = {
            "sub": str(user["id"]),
            "email": user["email"],
            "role": "authenticated",
            "aud": "authenticated",
            "iat": now,
            "exp": now + ACCESS_TTL,
            "session_id": str(uuid.uuid4()),
        }
        refresh = {
            "sub": str(user["id"]),
            "type": "refresh",
            "role": "authenticated",
            "iat": now,
            "exp": now + REFRESH_TTL,
        }
        return {
            "access_token": sign_jwt(claims),
            "token_type": "bearer",
            "expires_in": ACCESS_TTL,
            "expires_at": now + ACCESS_TTL,
            "refresh_token": sign_jwt(refresh),
            "user": self.user_payload(user),
        }

    @staticmethod
    def user_payload(user: dict) -> dict:
        return {
            "id": str(user["id"]),
            "aud": "authenticated",
            "role": "authenticated",
            "email": user["email"],
            "email_confirmed_at": user["created_at"],
            "confirmed_at": user["created_at"],
            "phone": "",
            "app_metadata": {"provider": "email", "providers": ["email"]},
            "user_metadata": {"full_name": user.get("full_name") or ""},
            "identities": [],
            "created_at": user["created_at"],
            "updated_at": user["created_at"],
        }

    def handle_auth(self, method: str, path: str, params: list[tuple[str, str]]):
        query = {k: v for k, v in params}
        route = path[len("/auth/v1"):] or "/"

        if route.endswith("/settings") and method == "GET":
            return self.send_json(200, {"external": {}, "disable_signup": False})

        if route.endswith("/signup") and method == "POST":
            body = json.loads(self.read_body() or b"{}")
            email = (body.get("email") or "").strip().lower()
            password = body.get("password") or ""
            full_name = ((body.get("data") or {}).get("full_name") or "").strip()
            if not email or len(password) < 6:
                return self.send_json(
                    422, {"message": "A valid email and a password of 6+ characters are required"}
                )
            with self.connect() as conn, conn.cursor() as cur:
                cur.execute("select id from preview_users where email = %s", (email,))
                if cur.fetchone():
                    return self.send_json(
                        422,
                        {
                            "message": "An account with this email already exists",
                            "code": "user_already_exists",
                        },
                    )
                cur.execute(
                    """insert into preview_users (email, password_hash, full_name)
                       values (%s, %s, %s)
                       returning id, email, full_name, created_at""",
                    (email, hash_password(password), full_name or None),
                )
                user = cur.fetchone()
                conn.commit()
            return self.send_json(200, self.session_payload(user))

        if route.endswith("/token") and method == "POST":
            body = json.loads(self.read_body() or b"{}")
            grant = query.get("grant_type", "password")
            if grant == "password":
                email = (body.get("email") or "").strip().lower()
                password = body.get("password") or ""
                with self.connect() as conn, conn.cursor() as cur:
                    cur.execute("select * from preview_users where email = %s", (email,))
                    user = cur.fetchone()
                if not user or not verify_password(password, user["password_hash"]):
                    return self.send_json(
                        400,
                        {
                            "error": "invalid_grant",
                            "error_description": "Invalid login credentials",
                            "message": "Invalid login credentials",
                        },
                    )
                return self.send_json(200, self.session_payload(user))

            if grant == "refresh_token":
                claims = read_jwt(body.get("refresh_token") or "")
                if not claims or claims.get("type") != "refresh":
                    return self.send_json(400, {"message": "Invalid refresh token"})
                with self.connect() as conn, conn.cursor() as cur:
                    cur.execute("select * from preview_users where id = %s", (claims["sub"],))
                    user = cur.fetchone()
                if not user:
                    return self.send_json(400, {"message": "Invalid refresh token"})
                return self.send_json(200, self.session_payload(user))

            return self.send_json(400, {"message": f"Unsupported grant_type {grant}"})

        if route.endswith("/user") and method == "GET":
            claims = read_jwt(self.token())
            if not claims:
                return self.send_json(401, {"message": "Invalid token"})
            with self.connect() as conn, conn.cursor() as cur:
                cur.execute("select * from preview_users where id = %s", (claims["sub"],))
                user = cur.fetchone()
            if not user:
                return self.send_json(401, {"message": "User not found"})
            return self.send_json(200, self.user_payload(user))

        if route.endswith("/logout") and method == "POST":
            return self.send_empty(204)

        return self.send_json(404, {"message": f"Unsupported auth route {route}"})

    # ------------------------------------------------------------------- rest
    def handle_rest(self, method: str, path: str, params: list[tuple[str, str]]):
        route = path[len("/rest/v1"):].lstrip("/")
        role, subject, _ = self.identity()
        prefer = self.headers.get("Prefer") or ""
        accept = self.headers.get("Accept") or ""
        wants_object = "vnd.pgrst.object+json" in accept
        wants_count = "count=exact" in prefer
        return_repr = "return=representation" in prefer
        merge_duplicates = "resolution=merge-duplicates" in prefer

        if route.startswith("rpc/"):
            return self.handle_rpc(route[4:], role, subject, params, method)

        relation = route.split("?")[0]
        if not IDENT.match(relation):
            return self.send_json(404, {"message": "Unknown relation"})

        select = select_list(dict(params).get("select"))
        where, values = build_where(params)
        order = build_order(dict(params).get("order"))
        limit = dict(params).get("limit")
        offset = dict(params).get("offset")
        tail = ""
        if order:
            tail += order
        if limit and limit.isdigit():
            tail += f" LIMIT {int(limit)}"
        if offset and offset.isdigit():
            tail += f" OFFSET {int(offset)}"

        with self.connect() as conn:
            with conn.cursor() as cur:
                self.begin(cur, role, subject)
                if method in {"GET", "HEAD"}:
                    cur.execute(
                        f'SELECT count(*) OVER () AS __total, {select} FROM public."{relation}"{where}{tail}',
                        values,
                    )
                    rows = cur.fetchall()
                    total = rows[0]["__total"] if rows else 0
                    for row in rows:
                        row.pop("__total", None)
                    payload = [clean_row(row) for row in rows]
                elif method == "POST":
                    body = json.loads(self.read_body() or b"{}")
                    records = body if isinstance(body, list) else [body]
                    if not records:
                        return self.send_json(201, [])
                    columns = sorted({key for record in records for key in record})
                    for column in columns:
                        if not IDENT.match(column):
                            return self.send_json(400, {"message": f"Bad column {column}"})
                    placeholders, flat = [], []
                    for record in records:
                        placeholders.append("(" + ", ".join(["%s"] * len(columns)) + ")")
                        flat.extend([record.get(column) for column in columns])
                    conflict = dict(params).get("on_conflict")
                    conflict_sql = ""
                    if conflict and all(IDENT.match(c) for c in conflict.split(",")):
                        target = ", ".join(f'"{c}"' for c in conflict.split(","))
                        updates = ", ".join(
                            f'"{c}" = EXCLUDED."{c}"' for c in columns if c not in conflict.split(",")
                        )
                        conflict_sql = (
                            f" ON CONFLICT ({target}) DO UPDATE SET {updates}"
                            if updates and merge_duplicates
                            else f" ON CONFLICT ({target}) DO NOTHING"
                        )
                    column_sql = ", ".join('"' + c + '"' for c in columns)
                    values_sql = ", ".join(placeholders)
                    returning = f" RETURNING {select}" if return_repr else ""
                    cur.execute(
                        f'INSERT INTO public."{relation}" ({column_sql}) '
                        f"VALUES {values_sql}{conflict_sql}{returning}",
                        flat,
                    )
                    payload = [clean_row(row) for row in cur.fetchall()] if return_repr else []
                elif method in {"PATCH", "PUT"}:
                    body = json.loads(self.read_body() or b"{}")
                    assignments = ", ".join(f'"{column}" = %s' for column in body if IDENT.match(column))
                    if not assignments:
                        return self.send_json(400, {"message": "Nothing to update"})
                    cur.execute(
                        f'UPDATE public."{relation}" SET {assignments}{where}'
                        + (f' RETURNING {select}' if return_repr else ""),
                        list(body.values()) + values,
                    )
                    payload = [clean_row(row) for row in cur.fetchall()] if return_repr else []
                elif method == "DELETE":
                    cur.execute(
                        f'DELETE FROM public."{relation}"{where}'
                        + (f" RETURNING {select}" if return_repr else ""),
                        values,
                    )
                    payload = [clean_row(row) for row in cur.fetchall()] if return_repr else []
                else:
                    return self.send_json(405, {"message": "Method not allowed"})
                conn.commit()

        if method in {"GET", "HEAD"} and wants_object:
            if len(payload) != 1:
                return self.send_json(
                    406,
                    {
                        "message": "JSON object requested, multiple (or no) rows returned",
                        "code": "PGRST116",
                        "details": f"Results contain {len(payload)} rows",
                        "hint": None,
                    },
                )
            payload = payload[0]

        # PostgREST answers a read with 200 and an empty array, never 204: a
        # 204 has no body, and the client would be handed null instead of [].
        if method == "POST":
            status = 201
        elif method in {"GET", "HEAD"}:
            status = 200
        else:
            status = 200 if payload else 204
        extra = {}
        if wants_count:
            extra["Content-Range"] = f"0-{max(len(payload) - 1, 0)}/{total if method in {'GET', 'HEAD'} else len(payload)}"
        if method == "POST":
            extra["Preference-Applied"] = "return=representation" if return_repr else "return=minimal"
        if status == 204:
            return self.send_empty(204, extra)
        return self.send_json(status, payload, extra)

    def handle_rpc(self, function: str, role: str, subject: str | None, params, method: str):
        if not IDENT.match(function):
            return self.send_json(404, {"message": "Unknown function"})
        body = json.loads(self.read_body() or b"{}") if method == "POST" else {}
        if not isinstance(body, dict):
            body = {}
        args = [(key, value) for key, value in body.items() if IDENT.match(key)]

        with self.connect() as conn:
            with conn.cursor() as cur:
                self.begin(cur, role, subject)
                cur.execute(
                    "select proretset, prorettype, pg_get_function_result(oid) as result "
                    "from pg_proc where proname = %s and pronamespace = 'public'::regnamespace",
                    (function,),
                )
                meta = cur.fetchone()
                if not meta:
                    return self.send_json(404, {"message": f"Function {function} not found"})
                sets = meta["proretset"]

                call = ", ".join(f'"{name}" => %s' for name, _ in args)
                values = [value for _, value in args]
                if sets:
                    cur.execute(f'SELECT * FROM public."{function}"({call})', values)
                    payload = [clean_row(row) for row in cur.fetchall()]
                else:
                    result = (meta["result"] or "").strip()
                    if result in {"public.waterfall_distributions", "public.share_transfers",
                                  "public.farm_cycles", "public.cycle_investments"} or "record" in result.lower():
                        cur.execute(f'SELECT * FROM public."{function}"({call})', values)
                        payload = [clean_row(row) for row in cur.fetchall()]
                    else:
                        cur.execute(f'SELECT public."{function}"({call}) AS value', values)
                        row = cur.fetchone()
                        payload = clean_row({"value": row["value"]})["value"] if row else None
                conn.commit()
        return self.send_json(200, payload)

    @staticmethod
    def begin(cur, role: str, subject: str | None):
        cur.execute(f"SET LOCAL ROLE {role}")
        cur.execute("SELECT set_config('request.jwt.claims', %s, true)", (json.dumps({"sub": subject, "role": role}),))
        if subject:
            cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (str(subject),))
        else:
            cur.execute("SELECT set_config('request.jwt.claim.sub', '', true)")


def ensure_auth_store():
    with psycopg.connect(DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            create table if not exists preview_users (
              id uuid primary key default gen_random_uuid(),
              email text not null unique,
              password_hash text not null,
              full_name text,
              created_at timestamptz not null default now()
            )
            """
        )
        conn.commit()


def main():
    ensure_auth_store()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    sys.stderr.write(f"[preview-ledger] listening on http://0.0.0.0:{PORT}\n")
    server.serve_forever()


if __name__ == "__main__":
    main()
