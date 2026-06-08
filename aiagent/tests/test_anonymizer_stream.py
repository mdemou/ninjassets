"""StreamDeanonymizer must restore placeholders split across SSE chunks (§9.5)."""

from ai_service.infrastructure.adapters.anonymizer import AnonSession, Anonymizer


def _session_with(mapping: dict[str, str]) -> AnonSession:
    session = AnonSession(Anonymizer(spacy_model_en="x", spacy_model_es="y"))
    session.mapping = mapping
    return session


def test_placeholder_split_across_chunks_is_restored():
    session = _session_with({"[[PII_1]]": "alice@example.com"})
    deanon = session.stream_deanonymizer()
    out = ""
    for token in ["Email ", "[[PI", "I_1]]", " now"]:
        out += deanon.push(token)
    out += deanon.flush()
    assert out == "Email alice@example.com now"


def test_no_placeholders_passthrough():
    session = _session_with({})
    deanon = session.stream_deanonymizer()
    out = deanon.push("plain text") + deanon.flush()
    assert out == "plain text"
