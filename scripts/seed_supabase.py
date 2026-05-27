from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def upsert_document(key: str, payload: object) -> None:
    body = json.dumps({"key": key, "payload": payload}).encode("utf-8")
    request = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/velkaris_documents",
        data=body,
        method="POST",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    with urllib.request.urlopen(request, timeout=20):
        print(f"seeded {key}")


def read_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


if __name__ == "__main__":
    upsert_document("house", read_json(BASE_DIR / "data" / "house.json"))
    upsert_document("members", read_json(BASE_DIR / "data" / "members.json"))
