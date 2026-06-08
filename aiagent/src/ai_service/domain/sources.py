"""Corpus sources → raw documents (SPEC §8.1).

Three source types, all indexed into one Qdrant collection:
  - spec      : docs/spec-*.md                 markdown specs
  - user-doc  : frontend docs-pages.ts (or .json)
  - openapi   : exported openapi.json (file) or fetched from OPENAPI_URL at reindex

OpenAPI is never fetched at *query* time — only when (re)indexing.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from ai_service.config import Settings
from ai_service.logging import logger


@dataclass
class RawDoc:
    content: str
    metadata: dict[str, str] = field(default_factory=dict)


_SPEC_ID_RE = re.compile(r"\*\*Document ID:\*\*\s*(SPEC-[A-Z0-9-]+)")

# section/page/title (quoted), then a template-literal `content`. Internal backticks
# in the .ts are escaped (\`), so a "escaped-char | non-backtick" body stops exactly
# at the real closing backtick.
_DOCS_PAGE_RE = re.compile(
    r"section:\s*['\"](?P<section>[^'\"]+)['\"]\s*,\s*"
    r"page:\s*['\"](?P<page>[^'\"]+)['\"]\s*,\s*"
    r"title:\s*['\"](?P<title>[^'\"]+)['\"]\s*,\s*"
    r"content:\s*`(?P<content>(?:\\.|[^`])*)`",
    re.DOTALL,
)


def load_documents(settings: Settings) -> list[RawDoc]:
    root = Path(settings.corpus_root).resolve()
    docs: list[RawDoc] = []
    docs += _load_specs(root, settings.specs_glob)
    docs += _load_docs_pages(root / settings.docs_pages_file)
    docs += _load_openapi(root / settings.openapi_file)
    logger.info("loaded %d source documents from %s", len(docs), root)
    return docs


# ── specs ────────────────────────────────────────────────────────────────────
def _load_specs(root: Path, glob: str) -> list[RawDoc]:
    out: list[RawDoc] = []
    for path in sorted(root.glob(glob)):
        text = path.read_text(encoding="utf-8")
        m = _SPEC_ID_RE.search(text)
        out.append(
            RawDoc(
                content=text,
                metadata={
                    "document_id": path.stem,
                    "document_name": path.name,
                    "doc_type": "spec",
                    "spec_id": m.group(1) if m else "",
                    "source_path": str(path.relative_to(root)),
                },
            )
        )
    return out


# ── docs-pages ───────────────────────────────────────────────────────────────
def _unescape_template(s: str) -> str:
    """Undo the few JS template-literal escapes that appear in our docs content."""
    return s.replace("\\`", "`").replace("\\${", "${").replace("\\$", "$")


def _load_docs_pages(path: Path) -> list[RawDoc]:
    if not path.exists():
        logger.warning("docs-pages file not found: %s (skipping)", path)
        return []

    if path.suffix == ".json":
        entries = json.loads(path.read_text(encoding="utf-8"))
    else:
        text = path.read_text(encoding="utf-8")
        entries = [
            {
                "section": m.group("section"),
                "page": m.group("page"),
                "title": m.group("title"),
                "content": _unescape_template(m.group("content")).strip(),
            }
            for m in _DOCS_PAGE_RE.finditer(text)
        ]

    return [
        RawDoc(
            content=e["content"],
            metadata={
                "document_id": f"docs-{e['section']}-{e['page']}",
                "document_name": f"{e['title']} (docs)",
                "doc_type": "user-doc",
                "section": e["section"],
                "source_path": path.name,
            },
        )
        for e in entries
        if e.get("content", "").strip()
    ]


# ── openapi ──────────────────────────────────────────────────────────────────
def _load_openapi(path: Path) -> list[RawDoc]:
    """Read the OpenAPI JSON exported offline by `npm run export:openapi` (§8.1)."""
    if not path.exists():
        logger.warning("OpenAPI file not found: %s (run `npm run export:openapi`; skipping)", path)
        return []

    spec = json.loads(path.read_text(encoding="utf-8"))
    out: list[RawDoc] = []
    for route, methods in spec.get("paths", {}).items():
        for method, op in methods.items():
            if not isinstance(op, dict):
                continue
            out.append(
                RawDoc(
                    content=_render_operation(route, method, op),
                    metadata={
                        "document_id": f"openapi-{method}-{route}",
                        "document_name": f"{method.upper()} {route}",
                        "doc_type": "openapi",
                        "source_path": path.name,
                    },
                )
            )
    return out


def _schema_name(schema: dict | None) -> str:
    if not schema:
        return ""
    ref = schema.get("$ref") or schema.get("items", {}).get("$ref", "")
    return ref.rsplit("/", 1)[-1] if ref else schema.get("type", "")


def _render_operation(route: str, method: str, op: dict) -> str:
    """Render one route+method as a self-contained markdown section (SPEC §8.2)."""
    lines = [f"## {method.upper()} {route}"]
    if op.get("summary"):
        lines.append(op["summary"])
    if op.get("description"):
        lines.append(op["description"])

    params = op.get("parameters", [])
    if params:
        lines.append("\n**Parameters:**")
        for p in params:
            req = " (required)" if p.get("required") else ""
            lines.append(f"- `{p.get('name','')}` in {p.get('in','')}{req}: {_schema_name(p.get('schema'))}")

    body = op.get("requestBody", {}).get("content", {})
    if body:
        for ctype, media in body.items():
            lines.append(f"\n**Request body** ({ctype}): {_schema_name(media.get('schema'))}")

    responses = op.get("responses", {})
    if responses:
        lines.append("\n**Responses:**")
        for status, resp in responses.items():
            lines.append(f"- {status}: {resp.get('description','')}")

    return "\n".join(lines)
