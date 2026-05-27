from __future__ import annotations

import hmac
import json
import os
import uuid
from functools import wraps
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


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
BUNDLED_DATA_DIR = BASE_DIR / "data"
STORAGE_DIR = Path(os.environ.get("VELKARIS_STORAGE_DIR", BASE_DIR)).resolve()
DATA_DIR = Path(os.environ.get("VELKARIS_DATA_DIR", STORAGE_DIR / "data" if "VELKARIS_STORAGE_DIR" in os.environ else BUNDLED_DATA_DIR)).resolve()
UPLOAD_DIR = Path(os.environ.get("VELKARIS_UPLOAD_DIR", STORAGE_DIR / "uploads" if "VELKARIS_STORAGE_DIR" in os.environ else STATIC_DIR / "uploads")).resolve()
MEMBERS_FILE = DATA_DIR / "members.json"
HOUSE_FILE = DATA_DIR / "house.json"

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
GENERATION_OPTIONS = ["1ª Geração", "2ª Geração", "3ª Geração", "4ª Geração"]
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
    "territories_heading": "Domínios juramentados",
    "archives_heading": "Registros recentes",
    "gallery_heading": "Pinturas e banners",
    "crest_image": "assets/Velkaris.png",
    "hero_image": "assets/hero-castle.png",
    "territory_map": "assets/territory-map.png",
}

COLLECTION_FIELDS = {
    "about": ("text",),
    "symbols": ("name", "meaning"),
    "territories": ("name", "type", "description"),
    "archives": ("date", "title", "summary"),
    "gallery": ("title",),
}


app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
app.secret_key = os.environ.get("SECRET_KEY", "velkaris-dev-secret-change-me")

ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "velkaris-ascende")


def read_json(path: Path, fallback: Any) -> Any:
    if not path.exists():
        bundled_path = BUNDLED_DATA_DIR / path.name
        if path.parent != BUNDLED_DATA_DIR and bundled_path.exists():
            with bundled_path.open("r", encoding="utf-8") as handle:
                return json.load(handle)
        return fallback
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".tmp")
    with temp_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temp_path.replace(path)


def item_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def as_bool(value: Any) -> bool:
    return str(value).lower() in {"1", "true", "on", "yes", "sim"}


def as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return fallback


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
    if collection == "gallery":
        normalized["image"] = item.get("image") or ["assets/gallery-castle.png", "assets/territory-map.png", "assets/gallery-fortress.png"][index % 3]
    return normalized


def normalize_house(house: dict[str, Any]) -> dict[str, Any]:
    normalized = {**HOUSE_DEFAULTS, **(house or {})}
    for collection in COLLECTION_FIELDS:
        items = normalized.get(collection, [])
        if not isinstance(items, list):
            items = []
        normalized[collection] = [ensure_collection_item(collection, item, index) for index, item in enumerate(items)]
    return normalized


def load_house() -> dict[str, Any]:
    return normalize_house(read_json(HOUSE_FILE, {}))


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def save_upload(file_storage, prefix: str) -> str | None:
    if not file_storage or not file_storage.filename:
        return None
    if not allowed_file(file_storage.filename):
        flash("Formato inválido. Use PNG, JPG, JPEG ou WEBP.", "error")
        return None

    original = secure_filename(file_storage.filename)
    extension = original.rsplit(".", 1)[1].lower()
    filename = f"{prefix}-{uuid.uuid4().hex[:12]}.{extension}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    destination = UPLOAD_DIR / filename
    file_storage.save(destination)
    return f"uploads/{filename}"


def media_url(path: str) -> str:
    asset_path = str(path or "")
    if asset_path.startswith("uploads/"):
        return url_for("uploaded_file", filename=asset_path.removeprefix("uploads/"))
    return url_for("static", filename=asset_path)


def admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("is_admin"):
            return redirect(url_for("admin_login", next=request.full_path))
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


def build_family_tree(members: list[dict[str, Any]]) -> list[dict[str, Any]]:
    tree_members = [member for member in members if member.get("in_tree")]
    by_id = {member["id"]: member for member in tree_members}
    children_by_parent: dict[str, list[dict[str, Any]]] = {}
    roots: list[dict[str, Any]] = []

    for member in tree_members:
        parent_ids = [parent_id for parent_id in member.get("parent_ids", []) if parent_id in by_id and parent_id != member["id"]]
        primary_parent = parent_ids[0] if parent_ids else None
        if primary_parent:
            children_by_parent.setdefault(primary_parent, []).append(member)
        else:
            roots.append(member)
    if not roots and tree_members:
        roots = tree_members

    def branch(member: dict[str, Any], seen: set[str]) -> dict[str, Any]:
        if member["id"] in seen:
            return {"member": member, "children": []}
        next_seen = seen | {member["id"]}
        children = sort_members(children_by_parent.get(member["id"], []))
        return {"member": member, "children": [branch(child, next_seen) for child in children]}

    return [branch(root, set()) for root in sort_members(roots)]


@app.context_processor
def inject_globals() -> dict[str, Any]:
    return {
        "csrf_token": csrf_token,
        "admin_logged_in": bool(session.get("is_admin")),
        "site_house": load_house(),
        "media_url": media_url,
    }


@app.get("/uploads/<path:filename>")
def uploaded_file(filename: str):
    return send_from_directory(UPLOAD_DIR, filename)


@app.get("/")
def index():
    members = load_members()
    house = load_house()
    featured_members = [member for member in members if member.get("featured")]
    if not featured_members:
        featured_members = members[:5]
    return render_template(
        "index.html",
        members=members,
        house=house,
        featured_members=featured_members[:5],
        family_tree=build_family_tree(members),
        generation_options=GENERATION_OPTIONS,
    )


@app.get("/api/members")
def members_api():
    return jsonify(load_members())


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        validate_csrf()
        username_ok = hmac.compare_digest(request.form.get("username", ""), ADMIN_USERNAME)
        password_ok = hmac.compare_digest(request.form.get("password", ""), ADMIN_PASSWORD)
        if username_ok and password_ok:
            session["is_admin"] = True
            flash("Acesso concedido ao arquivo interno.", "success")
            return redirect(request.args.get("next") or url_for("admin"))
        flash("Credenciais inválidas.", "error")
    return render_template("admin_login.html")


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
    return render_template(
        "admin.html",
        members=load_members(),
        house=load_house(),
        placeholders=PLACEHOLDERS,
        generation_options=GENERATION_OPTIONS,
        status_options=STATUS_OPTIONS,
    )


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
    if collection == "gallery":
        item["image"] = save_upload(request.files.get("image"), "gallery") or "assets/gallery-castle.png"
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
    if collection == "gallery":
        uploaded = save_upload(request.files.get("image"), "gallery")
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
    member["title"] = request.form.get("title", "").strip() or "Retrato reservado"
    member["generation"] = request.form.get("generation", GENERATION_OPTIONS[0]).strip() or GENERATION_OPTIONS[0]
    member["description"] = request.form.get("description", "").strip() or "Registro aguardando confirmação dos arquivos da Casa."
    member["status"] = normalize_status(request.form.get("status"))
    member["death_cause"] = request.form.get("death_cause", "").strip() if member["status"] == "Morto" else ""
    member["branch"] = request.form.get("branch", "").strip() or "Ramo principal"
    member["territory"] = request.form.get("territory", "").strip()
    member["birth_year"] = request.form.get("birth_year", "").strip()
    member["spouse"] = request.form.get("spouse", "").strip()
    member["epithet"] = request.form.get("epithet", "").strip()
    member["quote"] = request.form.get("quote", "").strip()
    member["biography"] = request.form.get("biography", "").strip() or member["description"]
    member["traits"] = request.form.get("traits", "").strip()
    member["sort_order"] = as_int(request.form.get("sort_order"), index + 1)
    member["featured"] = "featured" in request.form
    member["in_tree"] = "in_tree" in request.form
    member["parent_ids"] = [parent_id for parent_id in (request.form.get("parent_1"), request.form.get("parent_2")) if parent_id and parent_id != member["id"]]

    image_path = save_upload(request.files.get("portrait"), "member")
    if image_path:
        member["image"] = image_path
    else:
        member.setdefault("image", PLACEHOLDERS[index % len(PLACEHOLDERS)])
    return member


def update_member_tree_fields(member: dict[str, Any], index: int) -> dict[str, Any]:
    updated = dict(member)
    updated["generation"] = request.form.get("generation", updated.get("generation", GENERATION_OPTIONS[0])).strip() or GENERATION_OPTIONS[0]
    updated["status"] = normalize_status(request.form.get("status", updated.get("status", "Vivo")))
    updated["death_cause"] = request.form.get("death_cause", "").strip() if updated["status"] == "Morto" else ""
    updated["sort_order"] = as_int(request.form.get("sort_order"), index + 1)
    updated["in_tree"] = "in_tree" in request.form
    updated["featured"] = "featured" in request.form
    updated["parent_ids"] = [
        parent_id
        for parent_id in (request.form.get("parent_1"), request.form.get("parent_2"))
        if parent_id and parent_id != updated["id"]
    ]
    image_path = save_upload(request.files.get("portrait"), "member")
    if image_path:
        updated["image"] = image_path
    return updated


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
            write_json(MEMBERS_FILE, sort_members(members))
            flash(f"Registro de {members[index]['name']} atualizado.", "success")
            return redirect(url_for("admin", _anchor="membros"))
    abort(404)


@app.post("/admin/members/<member_id>/tree")
@admin_required
def update_member_tree(member_id: str):
    validate_csrf()
    members = load_members()
    for index, member in enumerate(members):
        if member["id"] == member_id:
            members[index] = update_member_tree_fields(member, index)
            write_json(MEMBERS_FILE, sort_members(members))
            flash(f"Árvore atualizada para {member['name']}.", "success")
            return redirect(url_for("admin", _anchor="arvore"))
    abort(404)


@app.post("/admin/members/<member_id>/delete")
@admin_required
def delete_member(member_id: str):
    validate_csrf()
    members = []
    for member in load_members():
        if member["id"] == member_id:
            continue
        member["parent_ids"] = [parent_id for parent_id in member.get("parent_ids", []) if parent_id != member_id]
        members.append(member)
    write_json(MEMBERS_FILE, sort_members(members))
    flash("Familiar removido da linhagem e da árvore.", "success")
    return redirect(url_for("admin", _anchor="membros"))


@app.get("/healthz")
def healthz():
    return {"status": "ok", "house": load_house().get("name", "Velkaris")}


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", use_reloader=False)
