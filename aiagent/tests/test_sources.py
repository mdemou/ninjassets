"""Source loading: specs, docs-pages.ts (escaped backticks), OpenAPI → RawDoc."""

import json

from ai_service.config import Settings
from ai_service.domain.sources import load_documents

_DOCS_PAGES_TS = r"""
export const docsSections = [];
const pages = [
  {
    section: 'features',
    page: 'assets',
    title: 'Asset Management',
    content: `
# Assets

Lifecycle: Stock -> Assigned. Run \`npm run dev\` to start.

\`\`\`
GET /api/p/assets
\`\`\`
`,
  },
  {
    section: 'features',
    page: 'handover',
    title: 'Handover',
    content: `Magic-link custody handover.`,
  },
];
"""

_OPENAPI = {
    "paths": {
        "/api/p/assets": {
            "get": {
                "summary": "List assets",
                "parameters": [{"name": "page", "in": "query", "required": False, "schema": {"type": "integer"}}],
                "responses": {"200": {"description": "OK"}},
            }
        }
    }
}


def _settings(tmp_path) -> Settings:
    return Settings(
        corpus_root=str(tmp_path),
        specs_glob="spec-*.md",
        docs_pages_file="docs-pages.ts",
        openapi_file="openapi.json",
        pii_enabled=False,
    )


def test_loads_all_three_source_types(tmp_path):
    (tmp_path / "spec-foo.md").write_text(
        "# Foo\n- **Document ID:** SPEC-FOO-001\nbody", encoding="utf-8"
    )
    (tmp_path / "docs-pages.ts").write_text(_DOCS_PAGES_TS, encoding="utf-8")
    (tmp_path / "openapi.json").write_text(json.dumps(_OPENAPI), encoding="utf-8")

    docs = load_documents(_settings(tmp_path))
    by_type: dict[str, list] = {}
    for d in docs:
        by_type.setdefault(d.metadata["doc_type"], []).append(d)

    # spec
    assert len(by_type["spec"]) == 1
    assert by_type["spec"][0].metadata["spec_id"] == "SPEC-FOO-001"

    # docs-pages: both pages, backticks unescaped, code fence preserved
    assert len(by_type["user-doc"]) == 2
    assets_doc = next(d for d in by_type["user-doc"] if d.metadata["document_id"] == "docs-features-assets")
    assert "`npm run dev`" in assets_doc.content
    assert "```" in assets_doc.content
    assert "\\`" not in assets_doc.content  # no leftover escapes

    # openapi: route rendered with params + responses
    assert len(by_type["openapi"]) == 1
    op = by_type["openapi"][0]
    assert "GET /api/p/assets" in op.content
    assert "`page`" in op.content
    assert "200" in op.content


def test_missing_sources_are_skipped(tmp_path):
    # empty dir → no specs, no docs-pages, no openapi, no crash
    assert load_documents(_settings(tmp_path)) == []
