"""PII anonymization (Presidio) — required in v1 (SPEC §7.6, §9.4).

Anonymize the query + retrieved context BEFORE the external LLM, then deanonymize
the answer so the admin sees real values but the provider never does.

We use a **placeholder mapping** (`[[PII_n]]` → original) rather than Presidio's
reversible encryption, because the fixed `[[…]]` shape is trivial to deanonymize
mid-stream: we only have to hold back a trailing, not-yet-closed placeholder
across SSE chunk boundaries (§9.5).

Entities: Presidio built-ins (PERSON, EMAIL_ADDRESS, PHONE_NUMBER, LOCATION,
IP_ADDRESS, IBAN_CODE, CREDIT_CARD) + a custom `ASSET_SERIAL` recognizer + Spanish
ID recognizers (ES_DNI/NIF/NIE/CIF). Recognizers are tunable in P6.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from ai_service.logging import logger

if TYPE_CHECKING:  # avoid importing presidio at module import time
    from presidio_analyzer import AnalyzerEngine

_BUILTIN_ENTITIES = [
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "LOCATION",
    "IP_ADDRESS",
    "IBAN_CODE",
    "CREDIT_CARD",
]
_CUSTOM_ENTITIES = ["ASSET_SERIAL"]
_ES_ENTITIES = ["ES_DNI", "ES_NIF", "ES_NIE", "ES_CIF"]


# ─────────────────────────────────────────────────────────────────────────────
# Custom recognizers
# ─────────────────────────────────────────────────────────────────────────────
def _serial_recognizer(language: str):
    """Asset serial numbers. Heuristic — tune the pattern/score in P6 (§7.6)."""
    from presidio_analyzer import Pattern, PatternRecognizer

    return PatternRecognizer(
        supported_entity="ASSET_SERIAL",
        supported_language=language,
        name="AssetSerialRecognizer",
        patterns=[
            # 2+ char alphanumerics containing at least one digit and one letter,
            # optionally dash-separated (e.g. SN-4A8821, C02XmyXX).
            Pattern(
                name="serial_alnum",
                regex=r"\b(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9]{2,}(?:-[A-Za-z0-9]{2,})*\b",
                score=0.4,
            ),
        ],
        context=["serial", "serial number", "s/n", "sn", "número de serie", "nº de serie"],
    )


def _spanish_id_recognizers():
    from presidio_analyzer import Pattern, PatternRecognizer

    return [
        PatternRecognizer(
            supported_entity="ES_DNI", supported_language="es", name="SpanishDNI",
            patterns=[Pattern(name="dni", regex=r"\b\d{8}[A-Za-z]\b", score=0.85)],
            context=["dni", "documento nacional", "identidad"],
        ),
        PatternRecognizer(
            supported_entity="ES_NIE", supported_language="es", name="SpanishNIE",
            patterns=[Pattern(name="nie", regex=r"\b[XYZxyz]\d{7}[A-Za-z]\b", score=0.9)],
            context=["nie", "extranjero", "residencia"],
        ),
        PatternRecognizer(
            supported_entity="ES_NIF", supported_language="es", name="SpanishNIF",
            patterns=[Pattern(name="nif", regex=r"\b[KLMklm]\d{7}[A-Za-z]\b", score=0.85)],
            context=["nif", "fiscal", "hacienda"],
        ),
        PatternRecognizer(
            supported_entity="ES_CIF", supported_language="es", name="SpanishCIF",
            patterns=[Pattern(name="cif", regex=r"\b[A-Wa-w]\d{7}[A-Za-z0-9]\b", score=0.8)],
            context=["cif", "empresa", "sociedad"],
        ),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Anonymizer
# ─────────────────────────────────────────────────────────────────────────────
class Anonymizer:
    def __init__(self, *, spacy_model_en: str, spacy_model_es: str) -> None:
        self._spacy_model_en = spacy_model_en
        self._spacy_model_es = spacy_model_es
        self._analyzer: AnalyzerEngine | None = None

    def _engine(self) -> AnalyzerEngine:
        if self._analyzer is not None:
            return self._analyzer

        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        provider = NlpEngineProvider(
            nlp_configuration={
                "nlp_engine_name": "spacy",
                "models": [
                    {"lang_code": "en", "model_name": self._spacy_model_en},
                    {"lang_code": "es", "model_name": self._spacy_model_es},
                ],
            }
        )
        analyzer = AnalyzerEngine(nlp_engine=provider.create_engine(), supported_languages=["en", "es"])
        for lang in ("en", "es"):
            analyzer.registry.add_recognizer(_serial_recognizer(lang))
        for rec in _spanish_id_recognizers():
            analyzer.registry.add_recognizer(rec)

        self._analyzer = analyzer
        logger.info("presidio analyzer ready (en=%s, es=%s)", self._spacy_model_en, self._spacy_model_es)
        return analyzer

    def entities_for(self, language: str) -> list[str]:
        ents = [*_BUILTIN_ENTITIES, *_CUSTOM_ENTITIES]
        if language == "es":
            ents += _ES_ENTITIES
        return ents

    def session(self) -> AnonSession:
        return AnonSession(self)


class AnonSession:
    """One mapping shared across all anonymize() calls of a single request."""

    def __init__(self, parent: Anonymizer) -> None:
        self._parent = parent
        self._counter = 0
        self.mapping: dict[str, str] = {}   # placeholder -> original
        self._by_value: dict[str, str] = {}  # original -> placeholder

    def _placeholder(self, original: str) -> str:
        if original in self._by_value:
            return self._by_value[original]
        self._counter += 1
        ph = f"[[PII_{self._counter}]]"
        self.mapping[ph] = original
        self._by_value[original] = ph
        return ph

    def anonymize(self, text: str, *, language: str) -> str:
        if not text.strip():
            return text
        results = self._parent._engine().analyze(
            text=text, language=language, entities=self._parent.entities_for(language)
        )
        for r in sorted(results, key=lambda x: x.start, reverse=True):
            ph = self._placeholder(text[r.start : r.end])
            text = text[: r.start] + ph + text[r.end :]
        return text

    def deanonymize(self, text: str) -> str:
        for ph, original in self.mapping.items():
            text = text.replace(ph, original)
        return text

    def stream_deanonymizer(self) -> StreamDeanonymizer:
        return StreamDeanonymizer(self)


class StreamDeanonymizer:
    """Deanonymize a token stream, holding back a not-yet-closed `[[…]]` tail."""

    _OPEN = "[["
    _CLOSE = "]]"

    def __init__(self, session: AnonSession) -> None:
        self._session = session
        self._buf = ""

    def push(self, token: str) -> str:
        self._buf += token
        last_close = self._buf.rfind(self._CLOSE)
        region_start = last_close + 2 if last_close != -1 else 0
        region = self._buf[region_start:]

        open_idx = region.find(self._OPEN)
        if open_idx != -1:                       # unclosed "[[" → hold from there
            cut = region_start + open_idx
        elif region.endswith("["):               # trailing single "[" might start one
            cut = len(self._buf) - 1
        else:
            cut = len(self._buf)

        safe, self._buf = self._buf[:cut], self._buf[cut:]
        return self._session.deanonymize(safe)

    def flush(self) -> str:
        out, self._buf = self._session.deanonymize(self._buf), ""
        return out


# Validation note: placeholders must never collide with real corpus text.
assert re.fullmatch(r"\[\[PII_\d+\]\]", "[[PII_1]]")
