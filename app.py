from __future__ import annotations

import hmac
import json
import mimetypes
import os
import re
import time
import unicodedata
import urllib.error
import urllib.request
import uuid
from functools import wraps
from io import BytesIO
from pathlib import Path
from typing import Any

from flask import (
    Flask,
    abort,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from werkzeug.utils import secure_filename

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError:  # Pillow is listed in requirements; this keeps local fallback graceful.
    Image = None
    ImageOps = None
    UnidentifiedImageError = OSError


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
BUNDLED_UPLOAD_DIR = STATIC_DIR / "uploads"
BUNDLED_DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = Path(os.environ.get("VELKARIS_STORAGE_DIR", BASE_DIR)).resolve()
DATA_DIR = Path(os.environ.get("VELKARIS_DATA_DIR", STORAGE_DIR / "data" if "VELKARIS_STORAGE_DIR" in os.environ else BUNDLED_DATA_DIR)).resolve()
UPLOAD_DIR = Path(os.environ.get("VELKARIS_UPLOAD_DIR", STORAGE_DIR / "uploads" if "VELKARIS_STORAGE_DIR" in os.environ else STATIC_DIR / "uploads")).resolve()
MEMBERS_FILE = DATA_DIR / "members.json"
HOUSE_FILE = DATA_DIR / "house.json"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.environ.get("SUPABASE_STORAGE_BUCKET", "velkaris-media")
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MEMBER_PORTRAIT_SIZE = (2160, 2700)
GENERATION_OPTIONS = ["1ª Geração", "2ª Geração", "3ª Geração", "4ª Geração", "5ª Geração"]
STATUS_OPTIONS = ["Vivo", "Morto", "Desaparecido"]
PLACEHOLDERS = [
    "assets/member-placeholder-1.png",
    "assets/member-placeholder-2.png",
    "assets/member-placeholder-3.png",
    "assets/member-placeholder-4.png",
]

HOUSE_DEFAULTS = {
    "name": "Velkaris",
    "motto": "Honra. Lealdade. Poder.",
    "subtitle": "De sangue antigo e vontade inabalável, a Casa Velkaris carrega o peso da história e o dever de manter acesa a chama do legado.",
    "about_heading": "Juramentos escritos em ouro antigo",
    "members_heading": "Retratos da linhagem",
    "tree_heading": "Linhagem Velkaris",
    "territories_heading": "Domínios",
    "archives_heading": "Registros recentes",
    "timeline_heading": "Crônicas do sangue antigo",
    "eras_heading": "Eras da Casa",
    "newspapers_heading": "Gazeta da Casa",
    "gallery_heading": "Pinturas e banners",
    "crest_image": "assets/Velkaris.png",
    "hero_image": "assets/hero-castle.png",
    "territory_map": "assets/territory-map.png",
    "ancestor_order": [],
    "leaders": [],
    "fortifications": [],
    "conflicts": [],
    "aristocrats": [],
    "allies": [],
    "vassals": [],
    "newspapers": [],
}

MAP_MARKER_TYPES = [
    "Castelo",
    "Cidade",
    "Vila",
    "Ruína",
    "Porto",
    "Floresta",
    "Território aliado",
    "Território inimigo",
    "Local misterioso",
]

MAP_MARKER_COLORS = [
    "#d7b46a",
    "#8ea6c7",
    "#b85656",
    "#78a978",
    "#9d82c9",
    "#d08a4c",
]

MAP_MARKER_ICONS = ["crown", "castle", "city", "village", "ruin", "port", "forest", "ally", "enemy", "mystery"]

COLLECTION_FIELDS = {
    "about": ("text",),
    "symbols": ("name", "meaning"),
    "territories": ("name", "type", "description", "lore", "coord_x", "coord_y", "status", "color", "icon"),
    "archives": ("date", "title", "summary"),
    "timeline": ("date", "era", "title", "summary", "details"),
    "eras": ("name", "period", "description"),
    "newspapers": ("title", "edition", "date", "description"),
    "gallery": ("title",),
    "leaders": ("name", "title", "period", "description"),
    "fortifications": ("name", "type", "responsible", "description"),
    "conflicts": ("name", "period", "outcome", "description"),
    "aristocrats": ("name", "title", "role", "description"),
    "allies": ("name", "group", "role", "description"),
    "vassals": ("name", "group", "service", "description"),
}
STRATEGIC_COLLECTIONS = {"leaders", "fortifications", "conflicts", "aristocrats", "allies", "vassals"}


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
app.secret_key = os.environ.get("SECRET_KEY", "velkaris-dev-secret-change-me")

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "velkaris")
LOGIN_ATTEMPTS: dict[str, list[float]] = {}
MAX_LOGIN_ATTEMPTS = 6
LOGIN_WINDOW_SECONDS = 15 * 60


def read_json(path: Path, fallback: Any) -> Any:
    supabase_payload = supabase_read_json(path)
    if supabase_payload is not None:
        return supabase_payload
    if not path.exists():
        bundled_path = BUNDLED_DATA_DIR / path.name
        if path.parent != BUNDLED_DATA_DIR and bundled_path.exists():
            with bundled_path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    if supabase_write_json(path, payload):
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temp_path.replace(path)


def item_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_value.lower()).strip("-")
    return slug or uuid.uuid4().hex[:8]


def supabase_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }
    headers.update(extra or {})
    return headers


def supabase_document_key(path: Path) -> str | None:
    if path.name == "house.json":
        return "house"
    if path.name == "members.json":
        return "members"
    if path.name == "publish.json":
        return "publish"
    return None


def supabase_read_json(path: Path) -> Any | None:
    key = supabase_document_key(path)
    if not SUPABASE_ENABLED or not key:
        return None
    url = f"{SUPABASE_URL}/rest/v1/velkaris_documents?key=eq.{key}&select=payload&limit=1"
    request_obj = urllib.request.Request(url, headers=supabase_headers({"Accept": "application/json"}))
    try:
        with urllib.request.urlopen(request_obj, timeout=8) as response:
            rows = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    if not rows:
        return None
    return rows[0].get("payload")


def supabase_write_json(path: Path, payload: Any) -> bool:
    key = supabase_document_key(path)
    if not SUPABASE_ENABLED or not key:
        return False
    body = json.dumps({"key": key, "payload": payload}).encode("utf-8")
    request_obj = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/velkaris_documents",
        data=body,
        method="POST",
        headers=supabase_headers(
            {
                "Content-Type": "application/json",
                "Prefer": "resolution=merge-duplicates,return=minimal",
            }
        ),
    )
    try:
        with urllib.request.urlopen(request_obj, timeout=8):
            return True
    except urllib.error.URLError:
        return False


def as_bool(value: Any) -> bool:
    return str(value).lower() in {"1", "true", "on", "yes", "sim"}


def as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


def clamp_number(value: Any, fallback: float = 0, minimum: float = 0, maximum: float = 100) -> float:
    try:
        number = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        number = fallback
    return min(maximum, max(minimum, number))


def normalize_status(value: Any) -> str:
    clean = str(value or "").strip().lower()
    status_map = {
        "vivo": "Vivo",
        "ativa": "Vivo",
        "ativo": "Vivo",
        "registro ativo": "Vivo",
        "morto": "Morto",
        "morta": "Morto",
        "falecido": "Morto",
        "falecida": "Morto",
        "desaparecido": "Desaparecido",
        "desaparecida": "Desaparecido",
    }
    return status_map.get(clean, "Vivo")


def generation_rank(member: dict[str, Any]) -> int:
    generation = str(member.get("generation", ""))
    for index, option in enumerate(GENERATION_OPTIONS):
        if generation == option or generation.startswith(option[:1]):
            return index
    return len(GENERATION_OPTIONS)


def sort_members(members: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        members,
        key=lambda member: (
            as_int(member.get("sort_order"), 999),
            generation_rank(member),
            str(member.get("name", "")).lower(),
        ),
    )


def normalize_member(member: dict[str, Any], index: int) -> dict[str, Any]:
    normalized = dict(member)
    normalized.setdefault("id", item_id("member"))
    normalized.setdefault("name", f"Retrato {index + 1}")
    normalized["slug"] = str(normalized.get("slug") or slugify(normalized.get("name", "")))
    normalized.setdefault("title", "Retrato reservado")
    normalized.setdefault("generation", GENERATION_OPTIONS[min(index // 2, len(GENERATION_OPTIONS) - 1)])
    normalized.setdefault("description", "Registro aguardando confirmação dos arquivos da Casa.")
    normalized.setdefault("image", PLACEHOLDERS[index % len(PLACEHOLDERS)])
    normalized["status"] = normalize_status(normalized.get("status"))
    normalized.setdefault("death_cause", "")
    normalized.setdefault("branch", "Ramo principal")
    normalized.setdefault("territory", "")
    normalized.setdefault("birth_year", "")
    normalized.setdefault("spouse", "")
    normalized["partner_id"] = str(normalized.get("partner_id") or "").strip()
    if normalized["partner_id"] == normalized["id"]:
        normalized["partner_id"] = ""
    normalized.setdefault("epithet", "")
    normalized.setdefault("quote", "")
    normalized.setdefault("biography", normalized.get("description", ""))
    normalized.setdefault("traits", "")
    normalized["sort_order"] = as_int(normalized.get("sort_order"), index + 1)
    normalized["featured"] = as_bool(normalized.get("featured", index < 5))
    normalized["in_tree"] = as_bool(normalized.get("in_tree", True))

    parent_ids = normalized.get("parent_ids")
    if not isinstance(parent_ids, list):
        parent_ids = []
        if 2 <= index <= 3:
            parent_ids = ["velkaris-01", "velkaris-02"]
        elif 4 <= index <= 5:
            parent_ids = ["velkaris-03", "velkaris-04"]
        elif index >= 6:
            parent_ids = ["velkaris-05", "velkaris-06"]
    normalized["parent_ids"] = [str(parent_id) for parent_id in parent_ids if parent_id]
    return normalized


def load_members() -> list[dict[str, Any]]:
    return sort_members([normalize_member(member, index) for index, member in enumerate(read_json(MEMBERS_FILE, []))])


def ensure_collection_item(collection: str, item: Any, index: int) -> dict[str, Any]:
    if collection == "about":
        if isinstance(item, dict):
            return {"id": item.get("id") or item_id("about"), "text": item.get("text", "")}
        return {"id": item_id("about"), "text": str(item)}

    if not isinstance(item, dict):
        item = {}
    normalized = {"id": item.get("id") or item_id(collection)}
    for field in COLLECTION_FIELDS[collection]:
        normalized[field] = item.get(field, "")
    if collection == "territories":
        normalized["type"] = normalized.get("type") or MAP_MARKER_TYPES[0]
        normalized["coord_x"] = str(clamp_number(normalized.get("coord_x"), 50, 0, 100))
        normalized["coord_y"] = str(clamp_number(normalized.get("coord_y"), 50, 0, 100))
        normalized["color"] = normalized.get("color") or MAP_MARKER_COLORS[index % len(MAP_MARKER_COLORS)]
        normalized["icon"] = normalized.get("icon") or "crown"
        images = item.get("images", [])
        normalized["images"] = (
            [str(image) for image in images if image] if isinstance(images, list) else []
        )
    if collection in {"gallery", "newspapers"}:
        normalized["image"] = item.get("image") or ["assets/gallery-castle.png", "assets/territory-map.png", "assets/gallery-fortress.png"][index % 3]
    if collection == "timeline":
        images = item.get("images", [])
        normalized["images"] = (
            [str(image) for image in images if image] if isinstance(images, list) else []
        )
    if collection in STRATEGIC_COLLECTIONS:
        normalized["image"] = item.get("image", "")
    return normalized


def normalize_house(house: dict[str, Any]) -> dict[str, Any]:
    normalized = {**HOUSE_DEFAULTS, **(house or {})}
    ancestor_order = normalized.get("ancestor_order", [])
    normalized["ancestor_order"] = (
        [str(member_id) for member_id in ancestor_order if member_id]
        if isinstance(ancestor_order, list)
        else []
    )
    for collection in COLLECTION_FIELDS:
        items = normalized.get(collection, [])
        if not isinstance(items, list):
            items = []
        normalized[collection] = [ensure_collection_item(collection, item, index) for index, item in enumerate(items)]
    return normalized


def sanitize_map_marker(item: dict[str, Any]) -> dict[str, Any]:
    item["coord_x"] = f"{clamp_number(item.get('coord_x'), 50, 0, 100):.2f}".rstrip("0").rstrip(".")
    item["coord_y"] = f"{clamp_number(item.get('coord_y'), 50, 0, 100):.2f}".rstrip("0").rstrip(".")
    item["type"] = item.get("type") if item.get("type") in MAP_MARKER_TYPES else (item.get("type") or MAP_MARKER_TYPES[0])
    color = str(item.get("color") or "").strip()
    item["color"] = color if re.fullmatch(r"#[0-9a-fA-F]{6}", color) else MAP_MARKER_COLORS[0]
    item["icon"] = item.get("icon") if item.get("icon") in MAP_MARKER_ICONS else "crown"
    return item


def load_house() -> dict[str, Any]:
    return normalize_house(read_json(HOUSE_FILE, {}))


def timeline_sort_value(item: dict[str, Any]) -> tuple[int, str]:
    match = re.search(r"-?\d+", str(item.get("date", "")))
    return (int(match.group()) if match else 0, str(item.get("title", "")))


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def process_upload(file_storage, extension: str, prefix: str) -> tuple[bytes, str, str]:
    file_storage.stream.seek(0)
    raw_body = file_storage.stream.read()
    fallback_type = file_storage.mimetype or mimetypes.guess_type(f"upload.{extension}")[0] or "application/octet-stream"

    if prefix != "member" or Image is None or ImageOps is None:
        return raw_body, extension, fallback_type

    try:
        image = Image.open(BytesIO(raw_body))
        image = ImageOps.exif_transpose(image)
        resampling = getattr(Image, "Resampling", None)
        resample = resampling.LANCZOS if resampling else getattr(Image, "LANCZOS", 1)
        image = ImageOps.fit(
            image,
            MEMBER_PORTRAIT_SIZE,
            method=resample,
            centering=(0.5, 0.36),
        )
        if image.mode == "RGBA":
            background = Image.new("RGB", image.size, (7, 8, 12))
            background.paste(image, mask=image.getchannel("A"))
            image = background
        elif image.mode != "RGB":
            image = image.convert("RGB")

        output = BytesIO()
        image.save(output, format="WEBP", quality=96, method=6)
        return output.getvalue(), "webp", "image/webp"
    except (UnidentifiedImageError, OSError, ValueError):
        return raw_body, extension, fallback_type


def save_supabase_upload(body: bytes, filename: str, content_type: str) -> str | None:
    if not SUPABASE_ENABLED:
        return None
    object_path = f"uploads/{filename}"
    request_obj = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{object_path}",
        data=body,
        method="POST",
        headers=supabase_headers({"Content-Type": content_type, "x-upsert": "false"}),
    )
    try:
        with urllib.request.urlopen(request_obj, timeout=18):
            return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{object_path}"
    except urllib.error.URLError:
        return None


def save_upload(file_storage, prefix: str) -> str | None:
    if not file_storage or not file_storage.filename:
        return None
    if not allowed_file(file_storage.filename):
        flash("Formato inválido. Use PNG, JPG, JPEG ou WEBP.", "error")
        return None

    original = secure_filename(file_storage.filename)
    extension = original.rsplit(".", 1)[1].lower()
    body, extension, content_type = process_upload(file_storage, extension, prefix)
    filename = f"{prefix}-{uuid.uuid4().hex[:12]}.{extension}"
    supabase_url = save_supabase_upload(body, filename, content_type)
    if supabase_url:
        return supabase_url
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination = UPLOAD_DIR / filename
    destination.write_bytes(body)
    return f"uploads/{filename}"


def media_url(path: str) -> str:
    asset_path = str(path or "")
    if asset_path.startswith(("http://", "https://")):
        return asset_path
    if asset_path.startswith("uploads/"):
        return url_for("uploaded_file", filename=asset_path.removeprefix("uploads/"))
    return url_for("static", filename=asset_path)


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("is_admin"):
            return redirect(url_for("admin_login_alias", next=request.full_path))
        return view(*args, **kwargs)

    return wrapped


def csrf_token() -> str:
    token = session.get("csrf_token")
    if not token:
        token = uuid.uuid4().hex
        session["csrf_token"] = token
    return token


def validate_csrf() -> None:
    posted = request.form.get("csrf_token", "")
    stored = session.get("csrf_token", "")
    if not posted or not stored or not hmac.compare_digest(posted, stored):
        abort(400, description="Token de segurança inválido.")


def login_key() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    return (forwarded.split(",", 1)[0].strip() or request.remote_addr or "local")[:80]


def login_blocked(key: str) -> bool:
    now = time.time()
    attempts = [stamp for stamp in LOGIN_ATTEMPTS.get(key, []) if now - stamp < LOGIN_WINDOW_SECONDS]
    LOGIN_ATTEMPTS[key] = attempts
    return len(attempts) >= MAX_LOGIN_ATTEMPTS


def record_failed_login(key: str) -> None:
    LOGIN_ATTEMPTS.setdefault(key, []).append(time.time())


def valid_partner_id(member: dict[str, Any], by_id: dict[str, dict[str, Any]]) -> str:
    partner_id = str(member.get("partner_id") or "").strip()
    member_name_key = slugify(member.get("name", ""))
    spouse_raw = str(member.get("spouse") or "").strip()
    spouse_key = slugify(spouse_raw) if spouse_raw else ""

    def spouse_points_to(person: dict[str, Any], target: dict[str, Any]) -> bool:
        spouse_raw_value = str(person.get("spouse") or "").strip()
        if not spouse_raw_value:
            return True
        spouse = slugify(spouse_raw_value)
        return not spouse or spouse == slugify(target.get("name", ""))

    if partner_id and partner_id in by_id and partner_id != member["id"]:
        partner = by_id[partner_id]
        reciprocal_partner = partner.get("partner_id") == member["id"]
        spouse_consistent = spouse_points_to(member, partner) and spouse_points_to(partner, member)
        if reciprocal_partner and spouse_consistent:
            return partner_id

    if spouse_key:
        for candidate in by_id.values():
            if candidate["id"] == member["id"]:
                continue
            if slugify(candidate.get("name", "")) == spouse_key and slugify(candidate.get("spouse", "")) == member_name_key:
                return candidate["id"]
    return ""


def family_unit_key(member: dict[str, Any], by_id: dict[str, dict[str, Any]]) -> tuple[str, ...]:
    partner_id = valid_partner_id(member, by_id)
    if not partner_id:
        return (member["id"],)
    partner = by_id[partner_id]
    ordered = sort_members([member, partner])
    return tuple(person["id"] for person in ordered)


def build_family_links(members: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    member_ids = {member["id"] for member in members}
    by_id = {member["id"]: member for member in members}
    child_ids_by_parent = {member["id"]: [] for member in members}
    for child in members:
        for parent_id in child.get("parent_ids", []):
            if parent_id in member_ids and child["id"] != parent_id:
                child_ids_by_parent.setdefault(parent_id, []).append(child["id"])
    links = {}
    for member in members:
        partner_id = valid_partner_id(member, by_id)
        family_people = [member]
        if partner_id in by_id and partner_id != member["id"]:
            family_people.append(by_id[partner_id])
        editor_id = sort_members(family_people)[0]["id"]
        links[member["id"]] = {
            "partner_id": partner_id,
            "child_ids": child_ids_by_parent.get(member["id"], []),
            "editor_id": editor_id,
            "editor_name": by_id.get(editor_id, member).get("name", member.get("name", "")),
        }
    return links


def build_family_tree(members: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tree_members = [member for member in members if member.get("in_tree")]
    by_id = {member["id"]: member for member in tree_members}
    if not by_id:
        return []

    units: dict[tuple[str, ...], list[dict[str, Any]]] = {}
    unit_by_person: dict[str, tuple[str, ...]] = {}
    for member in tree_members:
        key = family_unit_key(member, by_id)
        units.setdefault(key, [])
        for person_id in key:
            if person_id in by_id and by_id[person_id] not in units[key]:
                units[key].append(by_id[person_id])
            unit_by_person[person_id] = key

    children_by_unit: dict[tuple[str, ...], dict[tuple[str, ...], str]] = {}
    secondary_links_by_unit: dict[tuple[str, ...], list[dict[str, str]]] = {}
    root_units: set[tuple[str, ...]] = set(units)

    def unit_sort_key(key: tuple[str, ...]) -> tuple[int, int, str]:
        people = sort_members([by_id[person_id] for person_id in key if person_id in by_id])
        first = people[0] if people else {"sort_order": 999, "name": ""}
        return (as_int(first.get("sort_order"), 999), generation_rank(first), str(first.get("name", "")).lower())

    def parent_unit_for(member: dict[str, Any]) -> tuple[str, ...] | None:
        child_unit = unit_by_person.get(member["id"])
        parent_ids = []
        for parent_id in member.get("parent_ids", []):
            if parent_id in by_id and parent_id != member["id"] and parent_id not in parent_ids:
                parent_ids.append(parent_id)
        if not parent_ids:
            return None

        parent_set = set(parent_ids)
        candidates = []
        for parent_id in parent_ids:
            unit = unit_by_person.get(parent_id)
            if not unit or unit == child_unit:
                continue
            unit_set = set(unit)
            match_count = len(parent_set & unit_set)
            contains_all = int(parent_set.issubset(unit_set))
            has_partner_pair = int(any(valid_partner_id(by_id[parent], by_id) in unit_set for parent in parent_set if parent in by_id))
            nearest_generation = max((generation_rank(by_id[parent]) for parent in parent_set & unit_set), default=-1)
            candidates.append((contains_all, has_partner_pair, match_count, nearest_generation, unit))

        if not candidates:
            return None

        candidates.sort(key=lambda candidate: (-candidate[0], -candidate[2], -candidate[3], -candidate[1], unit_sort_key(candidate[4])))
        return candidates[0][4]

    candidate_links_by_child: dict[tuple[str, ...], list[tuple[tuple[str, ...], str]]] = {}
    for member in tree_members:
        parent_unit = parent_unit_for(member)
        child_unit = unit_by_person.get(member["id"])
        if not parent_unit or not child_unit or parent_unit == child_unit:
            continue
        candidate_links_by_child.setdefault(child_unit, []).append((parent_unit, member["id"]))

    def link_sort_key(candidate: tuple[tuple[str, ...], str]) -> tuple[int, int, tuple[int, int, str]]:
        parent_unit, member_id = candidate
        member = by_id.get(member_id, {})
        return (
            as_int(member.get("sort_order"), 999),
            generation_rank(member),
            unit_sort_key(parent_unit),
        )

    for child_unit, candidates in candidate_links_by_child.items():
        sorted_candidates = sorted(candidates, key=link_sort_key)
        parent_unit, link_member_id = sorted_candidates[0]
        children_by_unit.setdefault(parent_unit, {})
        children_by_unit[parent_unit].setdefault(child_unit, link_member_id)
        root_units.discard(child_unit)
        seen_secondary: set[tuple[tuple[str, ...], str]] = set()
        for secondary_parent_unit, secondary_member_id in sorted_candidates[1:]:
            secondary_key = (secondary_parent_unit, secondary_member_id)
            if secondary_parent_unit == parent_unit or secondary_key in seen_secondary:
                continue
            seen_secondary.add(secondary_key)
            secondary_links_by_unit.setdefault(child_unit, []).append(
                {
                    "parent_unit_id": "|".join(secondary_parent_unit),
                    "member_id": secondary_member_id,
                }
            )

    def line_position(people: list[dict[str, Any]], link_member_id: str | None) -> str:
        if not link_member_id or len(people) < 2:
            return "50%"
        for index, person in enumerate(people):
            if person["id"] == link_member_id:
                return "25%" if index == 0 else "75%"
        return "50%"

    def branch(key: tuple[str, ...], seen: set[tuple[str, ...]], link_member_id: str | None = None) -> dict[str, Any]:
        people = sort_members(units.get(key, []))
        if key in seen:
            return {
                "member": people[0] if people else {},
                "members": people,
                "unit_id": "|".join(key),
                "children": [],
                "link_member_id": link_member_id,
                "line_position": line_position(people, link_member_id),
                "secondary_parent_links": secondary_links_by_unit.get(key, []),
            }
        next_seen = seen | {key}
        child_links = children_by_unit.get(key, {})
        child_keys = sorted(child_links, key=unit_sort_key)
        return {
            "member": people[0] if people else {},
            "members": people,
            "unit_id": "|".join(key),
            "children": [branch(child_key, next_seen, child_links.get(child_key)) for child_key in child_keys],
            "link_member_id": link_member_id,
            "line_position": line_position(people, link_member_id),
            "secondary_parent_links": secondary_links_by_unit.get(key, []),
        }

    roots = sorted(root_units, key=unit_sort_key)
    reachable_roots = set()

    def collect_reachable(key: tuple[str, ...], seen: set[tuple[str, ...]] | None = None) -> None:
        seen = seen or set()
        if key in seen:
            return
        seen.add(key)
        reachable_roots.add(key)
        for child_key in children_by_unit.get(key, {}):
            collect_reachable(child_key, seen)

    for root in roots:
        collect_reachable(root)

    for key in sorted(set(units) - reachable_roots, key=unit_sort_key):
        roots.append(key)
        collect_reachable(key)

    return [branch(root, set()) for root in roots]


def build_family_tree_payload(branches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def member_payload(member: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": member.get("id", ""),
            "name": member.get("name", ""),
            "title": member.get("title", ""),
            "branch": member.get("branch", "Casa Velkaris"),
            "generation": member.get("generation", ""),
            "status": member.get("status", ""),
            "statusClass": slugify(member.get("status", "")),
            "image": media_url(member.get("image", "")),
        }

    def branch_payload(branch: dict[str, Any]) -> dict[str, Any]:
        members = [member_payload(member) for member in branch.get("members", [])]
        branch_id = branch.get("unit_id") or "-".join(member.get("id", "") for member in branch.get("members", [])) or item_id("tree")
        secondary_links = [
            {
                "parentUnitId": link.get("parent_unit_id", ""),
                "memberId": link.get("member_id", ""),
            }
            for link in branch.get("secondary_parent_links", [])
            if link.get("parent_unit_id") and link.get("member_id")
        ]
        return {
            "id": branch_id,
            "members": members,
            "linkMemberId": branch.get("link_member_id"),
            "linePosition": branch.get("line_position", "50%"),
            "secondaryLinks": secondary_links,
            "children": [branch_payload(child) for child in branch.get("children", [])],
        }

    return [branch_payload(branch) for branch in branches]


def members_in_tree_order(members: list[dict[str, Any]], branches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ordered: list[dict[str, Any]] = []
    included_ids: set[str] = set()

    def include_branch(branch: dict[str, Any]) -> None:
        for member in branch.get("members", []):
            member_id = member.get("id", "")
            if member_id and member_id not in included_ids:
                ordered.append(member)
                included_ids.add(member_id)
        for child in branch.get("children", []):
            include_branch(child)

    for branch in branches:
        include_branch(branch)
    ordered.extend(member for member in members if member.get("id") not in included_ids)
    return ordered


def ancestor_members_for_house(members: list[dict[str, Any]], house: dict[str, Any]) -> list[dict[str, Any]]:
    by_id = {member["id"]: member for member in members}
    selected: list[dict[str, Any]] = []
    selected_ids: set[str] = set()
    for member_id in house.get("ancestor_order", []):
        if member_id in by_id and member_id not in selected_ids:
            selected.append(by_id[member_id])
            selected_ids.add(member_id)
    selected.extend(member for member in members if member["id"] not in selected_ids)
    return selected[:4]


@app.context_processor
def inject_globals() -> dict[str, Any]:
    try:
        asset_version = int((STATIC_DIR / "css" / "styles.css").stat().st_mtime)
    except OSError:
        asset_version = int(time.time())
    return {
        "csrf_token": csrf_token,
        "admin_logged_in": bool(session.get("is_admin")),
        "site_house": load_house(),
        "media_url": media_url,
        "asset_version": asset_version,
    }


@app.get("/uploads/<path:filename>")
def uploaded_file(filename: str):
    for directory in dict.fromkeys((UPLOAD_DIR, BUNDLED_UPLOAD_DIR)):
        root = directory.resolve()
        candidate = (root / filename).resolve()
        if root not in candidate.parents or not candidate.is_file():
            continue
        return send_from_directory(root, filename)
    abort(404)


@app.get("/")
def index():
    members = load_members()
    house = load_house()
    family_tree = build_family_tree(members)
    return render_template(
        "index.html",
        members=members,
        house=house,
        timeline_events=sorted(house["timeline"], key=timeline_sort_value),
        featured_members=ancestor_members_for_house(members, house),
        portrait_members=members_in_tree_order(members, family_tree),
        family_tree=family_tree,
        family_tree_payload=build_family_tree_payload(family_tree),
        generation_options=GENERATION_OPTIONS,
    )


@app.get("/linhagem/<slug>")
def member_detail(slug: str):
    members = load_members()
    member = next((item for item in members if item.get("slug") == slug or item.get("id") == slug), None)
    if not member:
        abort(404)
    parent_ids = set(member.get("parent_ids", []))
    parents = [item for item in members if item.get("id") in parent_ids]
    children = [item for item in members if member.get("id") in item.get("parent_ids", [])]
    siblings = [
        item
        for item in members
        if item.get("id") != member.get("id") and parent_ids.intersection(item.get("parent_ids", []))
    ][:4]
    return render_template(
        "member_detail.html",
        house=load_house(),
        member=member,
        parents=parents,
        children=children,
        siblings=siblings,
    )


@app.get("/api/members")
def members_api():
    return jsonify(load_members())


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        validate_csrf()
        key = login_key()
        if login_blocked(key):
            flash("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.", "error")
            return render_template("admin_login.html"), 429
        username_ok = hmac.compare_digest(request.form.get("username", ""), ADMIN_USERNAME)
        password_ok = hmac.compare_digest(request.form.get("password", ""), ADMIN_PASSWORD)
        if username_ok and password_ok:
            LOGIN_ATTEMPTS.pop(key, None)
            session["is_admin"] = True
            flash("Acesso concedido ao arquivo interno.", "success")
            return redirect(request.args.get("next") or url_for("admin", audio=request.args.get("audio")))
        record_failed_login(key)
        flash("Credenciais inválidas.", "error")
    return render_template("admin_login.html")


@app.route("/velkaris-admin", methods=["GET", "POST"])
def admin_login_alias():
    return admin_login()


@app.post("/admin/logout")
@admin_required
def admin_logout():
    validate_csrf()
    session.clear()
    flash("Sessão encerrada.", "success")
    return redirect(url_for("index"))


@app.get("/admin")
@admin_required
def admin():
    members = load_members()
    house = load_house()
    return render_template(
        "admin.html",
        members=members,
        house=house,
        ancestor_members=ancestor_members_for_house(members, house),
        placeholders=PLACEHOLDERS,
        generation_options=GENERATION_OPTIONS,
        status_options=STATUS_OPTIONS,
        map_marker_types=MAP_MARKER_TYPES,
        map_marker_colors=MAP_MARKER_COLORS,
        map_marker_icons=MAP_MARKER_ICONS,
        family_links=build_family_links(members),
    )


@app.post("/admin/ancestors")
@admin_required
def update_ancestor_order():
    validate_csrf()
    members = load_members()
    valid_ids = {member["id"] for member in members}
    ancestor_order = []
    for member_id in request.form.getlist("ancestor_ids"):
        if member_id in valid_ids and member_id not in ancestor_order:
            ancestor_order.append(member_id)
    house = load_house()
    house["ancestor_order"] = ancestor_order[:4]
    write_json(HOUSE_FILE, house)
    flash("Ancestrais da Casa atualizados sem alterar a ordem dos demais familiares.", "success")
    return redirect(url_for("admin", _anchor="ancestrais"))


@app.post("/admin/house")
@admin_required
def update_house_identity():
    validate_csrf()
    house = load_house()
    for field in (
        "name",
        "motto",
        "subtitle",
        "about_heading",
        "members_heading",
        "tree_heading",
        "territories_heading",
        "archives_heading",
        "timeline_heading",
        "eras_heading",
        "newspapers_heading",
        "gallery_heading",
    ):
        house[field] = request.form.get(field, "").strip()

    for field, prefix in (
        ("crest_image", "crest"),
        ("hero_image", "hero"),
        ("territory_map", "map"),
    ):
        uploaded = save_upload(request.files.get(field), prefix)
        if uploaded:
            house[field] = uploaded

    write_json(HOUSE_FILE, house)
    flash("Textos e imagens principais do site foram atualizados.", "success")
    return redirect(url_for("admin", _anchor="conteudo"))


@app.post("/admin/map/upload")
@admin_required
def update_interactive_map_image():
    validate_csrf()
    house = load_house()
    uploaded = save_upload(request.files.get("interactive_map"), "interactive-map")
    if uploaded:
        house["territory_map"] = uploaded
        write_json(HOUSE_FILE, house)
        flash("Mapa interativo atualizado.", "success")
    else:
        flash("Envie uma imagem PNG, JPG, JPEG ou WEBP para trocar o mapa.", "error")
    return redirect(url_for("admin", _anchor="mapa-interativo"))


@app.post("/admin/house/<collection>")
@admin_required
def create_collection_item(collection: str):
    validate_csrf()
    if collection not in COLLECTION_FIELDS:
        abort(404)
    house = load_house()
    item = {"id": item_id(collection)}
    for field in COLLECTION_FIELDS[collection]:
        item[field] = request.form.get(field, "").strip()
    if collection == "territories":
        sanitize_map_marker(item)
        item["images"] = [
            saved
            for upload in request.files.getlist("images")
            if (saved := save_upload(upload, "territory"))
        ]
    if collection == "gallery":
        item["image"] = save_upload(request.files.get("image"), "gallery") or "assets/gallery-castle.png"
    if collection == "newspapers":
        item["image"] = save_upload(request.files.get("image"), "newspaper")
        if not item["image"]:
            flash("Envie uma imagem para publicar o jornal.", "error")
            return redirect(url_for("admin", _anchor="newspapers"))
    if collection == "timeline":
        item["images"] = [
            saved
            for upload in request.files.getlist("images")
            if (saved := save_upload(upload, "timeline"))
        ]
    if collection in STRATEGIC_COLLECTIONS:
        item["image"] = save_upload(request.files.get("image"), collection) or ""
    house[collection].append(item)
    write_json(HOUSE_FILE, house)
    flash("Novo item adicionado ao site.", "success")
    return redirect(url_for("admin", _anchor=collection))


@app.post("/admin/house/<collection>/<entry_id>")
@admin_required
def update_collection_item(collection: str, entry_id: str):
    validate_csrf()
    if collection not in COLLECTION_FIELDS:
        abort(404)
    house = load_house()
    item = next((entry for entry in house[collection] if entry.get("id") == entry_id), None)
    if not item:
        abort(404)
    for field in COLLECTION_FIELDS[collection]:
        item[field] = request.form.get(field, "").strip()
    if collection == "territories":
        sanitize_map_marker(item)
        removed_images = set(request.form.getlist("remove_images"))
        item["images"] = [
            image for image in item.get("images", []) if image not in removed_images
        ]
        item["images"].extend(
            saved
            for upload in request.files.getlist("images")
            if (saved := save_upload(upload, "territory"))
        )
    if collection == "gallery":
        uploaded = save_upload(request.files.get("image"), "gallery")
        if uploaded:
            item["image"] = uploaded
    if collection == "newspapers":
        uploaded = save_upload(request.files.get("image"), "newspaper")
        if uploaded:
            item["image"] = uploaded
    if collection == "timeline":
        removed_images = set(request.form.getlist("remove_images"))
        item["images"] = [
            image for image in item.get("images", []) if image not in removed_images
        ]
        item["images"].extend(
            saved
            for upload in request.files.getlist("images")
            if (saved := save_upload(upload, "timeline"))
        )
    if collection in STRATEGIC_COLLECTIONS:
        uploaded = save_upload(request.files.get("image"), collection)
        if uploaded:
            item["image"] = uploaded
    write_json(HOUSE_FILE, house)
    flash("Item atualizado.", "success")
    return redirect(url_for("admin", _anchor=collection))


@app.post("/admin/house/<collection>/<entry_id>/delete")
@admin_required
def delete_collection_item(collection: str, entry_id: str):
    validate_csrf()
    if collection not in COLLECTION_FIELDS:
        abort(404)
    house = load_house()
    house[collection] = [entry for entry in house[collection] if entry.get("id") != entry_id]
    write_json(HOUSE_FILE, house)
    flash("Item removido do site.", "success")
    return redirect(url_for("admin", _anchor=collection))


def member_from_form(existing: dict[str, Any] | None, index: int) -> dict[str, Any]:
    member = dict(existing or {})
    member["id"] = member.get("id") or item_id("member")
    member["name"] = request.form.get("name", "").strip() or "Novo Velkaris"
    member["slug"] = request.form.get("slug", "").strip() or slugify(member["name"])
    member["title"] = request.form.get("title", "").strip() or "Retrato reservado"
    member["generation"] = request.form.get("generation", GENERATION_OPTIONS[0]).strip() or GENERATION_OPTIONS[0]
    member["description"] = request.form.get("description", "").strip() or "Registro aguardando confirmação dos arquivos da Casa."
    member["status"] = normalize_status(request.form.get("status"))
    member["death_cause"] = request.form.get("death_cause", "").strip() if member["status"] == "Morto" else ""
    member["branch"] = request.form.get("branch", "").strip() or "Ramo principal"
    member["territory"] = request.form.get("territory", "").strip()
    member["birth_year"] = request.form.get("birth_year", "").strip()
    member["spouse"] = request.form.get("spouse", "").strip()
    member["partner_id"] = request.form.get("partner_id", member.get("partner_id", "")).strip()
    if member["partner_id"] == member["id"]:
        member["partner_id"] = ""
    member.setdefault("epithet", "")
    member["quote"] = request.form.get("quote", "").strip()
    member["biography"] = request.form.get("biography", "").strip() or member["description"]
    member["traits"] = request.form.get("traits", "").strip()
    member["sort_order"] = as_int(request.form.get("sort_order"), index + 1)
    member.setdefault("featured", False)
    member["in_tree"] = "in_tree" in request.form
    member["parent_ids"] = [parent_id for parent_id in (request.form.get("parent_1"), request.form.get("parent_2")) if parent_id and parent_id != member["id"]]

    image_path = save_upload(request.files.get("portrait"), "member")
    if image_path:
        member["image"] = image_path
    else:
        member.setdefault("image", PLACEHOLDERS[index % len(PLACEHOLDERS)])
    return member


def update_member_fields_from_sources(member: dict[str, Any], index: int, form, files, prefix: str = "") -> dict[str, Any]:
    updated = dict(member)
    updated["name"] = form.get(f"{prefix}name", "").strip() or "Novo Velkaris"
    updated["slug"] = form.get(f"{prefix}slug", "").strip() or slugify(updated["name"])
    updated["title"] = form.get(f"{prefix}title", "").strip() or "Retrato reservado"
    updated["generation"] = form.get(f"{prefix}generation", GENERATION_OPTIONS[0]).strip() or GENERATION_OPTIONS[0]
    updated["description"] = form.get(f"{prefix}description", "").strip() or "Registro aguardando confirmação dos arquivos da Casa."
    updated["status"] = normalize_status(form.get(f"{prefix}status"))
    updated["death_cause"] = form.get(f"{prefix}death_cause", "").strip() if updated["status"] == "Morto" else ""
    updated["branch"] = form.get(f"{prefix}branch", "").strip() or "Ramo principal"
    updated["territory"] = form.get(f"{prefix}territory", "").strip()
    updated["birth_year"] = form.get(f"{prefix}birth_year", "").strip()
    updated["spouse"] = form.get(f"{prefix}spouse", "").strip()
    updated["partner_id"] = form.get(f"{prefix}partner_id", updated.get("partner_id", "")).strip()
    if updated["partner_id"] == updated["id"]:
        updated["partner_id"] = ""
    updated.setdefault("epithet", "")
    updated["quote"] = form.get(f"{prefix}quote", "").strip()
    updated["biography"] = form.get(f"{prefix}biography", "").strip() or updated["description"]
    updated["traits"] = form.get(f"{prefix}traits", "").strip()
    updated["sort_order"] = as_int(form.get(f"{prefix}sort_order"), index + 1)
    updated.setdefault("featured", False)
    updated["in_tree"] = f"{prefix}in_tree" in form
    updated["parent_ids"] = [
        parent_id
        for parent_id in (form.get(f"{prefix}parent_1"), form.get(f"{prefix}parent_2"))
        if parent_id and parent_id != updated["id"]
    ]
    image_path = save_upload(files.get(f"{prefix}portrait"), "member")
    if image_path:
        updated["image"] = image_path
    return updated


def update_member_tree_fields_from_sources(member: dict[str, Any], index: int, form, files, prefix: str = "") -> dict[str, Any]:
    updated = dict(member)
    updated["title"] = form.get(f"{prefix}title", updated.get("title", "Retrato reservado")).strip() or "Retrato reservado"
    updated["generation"] = form.get(f"{prefix}generation", updated.get("generation", GENERATION_OPTIONS[0])).strip() or GENERATION_OPTIONS[0]
    updated["status"] = normalize_status(form.get(f"{prefix}status", updated.get("status", "Vivo")))
    updated["death_cause"] = form.get(f"{prefix}death_cause", "").strip() if updated["status"] == "Morto" else ""
    updated["sort_order"] = as_int(form.get(f"{prefix}sort_order"), index + 1)
    updated["partner_id"] = form.get(f"{prefix}partner_id", updated.get("partner_id", "")).strip()
    if updated["partner_id"] == updated["id"]:
        updated["partner_id"] = ""
    updated["in_tree"] = f"{prefix}in_tree" in form
    updated.setdefault("featured", False)
    updated["parent_ids"] = [
        parent_id
        for parent_id in (form.get(f"{prefix}parent_1"), form.get(f"{prefix}parent_2"))
        if parent_id and parent_id != updated["id"]
    ]
    image_path = save_upload(files.get(f"{prefix}portrait"), "member")
    if image_path:
        updated["image"] = image_path
    return updated


def update_member_tree_fields(member: dict[str, Any], index: int) -> dict[str, Any]:
    return update_member_tree_fields_from_sources(member, index, request.form, request.files)


def sync_partner_links(members: list[dict[str, Any]], member_id: str, partner_id: str) -> None:
    by_id = {member["id"]: member for member in members}
    member = by_id.get(member_id)
    if not member:
        return
    partner_id = partner_id if partner_id in by_id and partner_id != member_id else ""

    for other in members:
        if other["id"] != partner_id and other.get("partner_id") == member_id:
            other["partner_id"] = ""
            other["spouse"] = ""

    previous_partner_id = member.get("partner_id", "")
    if previous_partner_id and previous_partner_id != partner_id and previous_partner_id in by_id:
        previous_partner = by_id[previous_partner_id]
        if previous_partner.get("partner_id") == member_id:
            previous_partner["partner_id"] = ""
            previous_partner["spouse"] = ""

    member["partner_id"] = partner_id
    if partner_id:
        partner = by_id[partner_id]
        old_partner_id = partner.get("partner_id", "")
        if old_partner_id and old_partner_id != member_id and old_partner_id in by_id:
            by_id[old_partner_id]["partner_id"] = ""
            by_id[old_partner_id]["spouse"] = ""
        partner["partner_id"] = member_id
        member["spouse"] = partner.get("name", "")
        partner["spouse"] = member.get("name", "")
    else:
        member["spouse"] = ""


def sync_family_children(members: list[dict[str, Any]], parent_id: str, partner_id: str, child_ids: list[str]) -> None:
    by_id = {member["id"]: member for member in members}
    if parent_id not in by_id:
        return
    partner_id = partner_id if partner_id in by_id and partner_id != parent_id else ""
    parent_pair = [parent_id] + ([partner_id] if partner_id else [])
    selected_ids = {child_id for child_id in child_ids if child_id in by_id and child_id not in parent_pair}

    for member in members:
        if member["id"] in parent_pair:
            continue
        current_parents = [parent for parent in member.get("parent_ids", []) if parent in by_id and parent != member["id"]]
        if member["id"] in selected_ids:
            member["parent_ids"] = parent_pair.copy()
        elif any(parent in parent_pair for parent in current_parents):
            member["parent_ids"] = [parent for parent in current_parents if parent not in parent_pair]


@app.post("/admin/members")
@admin_required
def create_member():
    validate_csrf()
    members = load_members()
    members.append(member_from_form(None, len(members)))
    write_json(MEMBERS_FILE, sort_members(members))
    flash("Novo familiar adicionado à linhagem.", "success")
    return redirect(url_for("admin", _anchor="membros"))


@app.post("/admin/members/<member_id>")
@admin_required
def update_member(member_id: str):
    validate_csrf()
    members = load_members()
    for index, member in enumerate(members):
        if member["id"] == member_id:
            members[index] = member_from_form(member, index)
            sync_partner_links(members, members[index]["id"], members[index].get("partner_id", ""))
            write_json(MEMBERS_FILE, sort_members(members))
            flash(f"Registro de {members[index]['name']} atualizado.", "success")
            return redirect(url_for("admin", _anchor="membros"))
    abort(404)


@app.post("/admin/members/bulk")
@admin_required
def bulk_update_members():
    validate_csrf()
    members = load_members()
    member_ids = [member_id for member_id in request.form.getlist("member_ids") if member_id]
    index_by_id = {member["id"]: index for index, member in enumerate(members)}
    updated_count = 0

    for member_id in member_ids:
        if member_id not in index_by_id:
            continue
        index = index_by_id[member_id]
        prefix = f"{member_id}__"
        members[index] = update_member_fields_from_sources(members[index], index, request.form, request.files, prefix)
        updated_count += 1

    for member_id in member_ids:
        if member_id in index_by_id:
            member = members[index_by_id[member_id]]
            sync_partner_links(members, member_id, member.get("partner_id", ""))

    write_json(MEMBERS_FILE, sort_members(members))
    flash(f"{updated_count} familiares foram salvos de uma vez.", "success")
    return {"redirect": url_for("admin", _anchor="editar-familiares")}


@app.post("/admin/members/<member_id>/tree")
@admin_required
def update_member_tree(member_id: str):
    validate_csrf()
    members = load_members()
    for index, member in enumerate(members):
        if member["id"] == member_id:
            members[index] = update_member_tree_fields(member, index)
            sync_partner_links(members, member_id, members[index].get("partner_id", ""))
            if "children_editor" in request.form:
                sync_family_children(members, member_id, members[index].get("partner_id", ""), request.form.getlist("child_ids"))
            write_json(MEMBERS_FILE, sort_members(members))
            flash(f"Árvore atualizada para {member['name']}.", "success")
            return redirect(url_for("admin", _anchor="arvore"))
    abort(404)


@app.post("/admin/tree/bulk")
@admin_required
def bulk_update_tree():
    validate_csrf()
    members = load_members()
    member_ids = [member_id for member_id in request.form.getlist("member_ids") if member_id]
    index_by_id = {member["id"]: index for index, member in enumerate(members)}

    for member_id in member_ids:
        if member_id not in index_by_id:
            continue
        index = index_by_id[member_id]
        prefix = f"{member_id}__"
        members[index] = update_member_tree_fields_from_sources(members[index], index, request.form, request.files, prefix)

    for member_id in member_ids:
        if member_id in index_by_id:
            member = members[index_by_id[member_id]]
            sync_partner_links(members, member_id, member.get("partner_id", ""))

    for member_id in member_ids:
        if member_id not in index_by_id:
            continue
        prefix = f"{member_id}__"
        if f"{prefix}children_editor" not in request.form:
            continue
        member = members[index_by_id[member_id]]
        sync_family_children(members, member_id, member.get("partner_id", ""), request.form.getlist(f"{prefix}child_ids"))

    write_json(MEMBERS_FILE, sort_members(members))
    flash("Toda a árvore genealógica foi salva de uma vez.", "success")
    return {"redirect": url_for("admin", _anchor="arvore")}


@app.post("/admin/members/reorder")
@admin_required
def reorder_members():
    validate_csrf()
    order_ids = [item for item in request.form.get("member_order", "").split(",") if item]
    order_map = {member_id: index + 1 for index, member_id in enumerate(order_ids)}
    members = []
    for member in load_members():
        if member["id"] in order_map:
            member["sort_order"] = order_map[member["id"]]
        members.append(member)
    write_json(MEMBERS_FILE, sort_members(members))
    flash("Ordem visual dos familiares publicada.", "success")
    return redirect(url_for("admin", _anchor="ordenacao"))


@app.post("/admin/members/<member_id>/delete")
@admin_required
def delete_member(member_id: str):
    validate_csrf()
    members = []
    for member in load_members():
        if member["id"] == member_id:
            continue
        member["parent_ids"] = [parent_id for parent_id in member.get("parent_ids", []) if parent_id != member_id]
        if member.get("partner_id") == member_id:
            member["partner_id"] = ""
        members.append(member)
    write_json(MEMBERS_FILE, sort_members(members))
    flash("Familiar removido da linhagem e da árvore.", "success")
    return redirect(url_for("admin", _anchor="membros"))


@app.post("/admin/publish")
@admin_required
def publish_site():
    validate_csrf()
    manifest = {
        "published_at": int(time.time()),
        "house": load_house().get("name", "Velkaris"),
        "members": len(load_members()),
    }
    write_json(DATA_DIR / "publish.json", manifest)
    flash("Alterações publicadas no site público.", "success")
    return redirect(url_for("admin", _anchor="conteudo"))


@app.get("/healthz")
def healthz():
    return {"status": "ok", "house": load_house().get("name", "Velkaris")}


@app.after_request
def add_security_headers(response):
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", use_reloader=False)
