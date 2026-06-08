from ai_service.domain.chunking import split_text


def test_empty_text_yields_no_chunks():
    assert split_text("   ") == []


def test_long_text_is_split_into_overlapping_chunks():
    text = ("ninjasset is an ITAM platform. " * 200).strip()
    chunks = split_text(text)
    assert len(chunks) > 1
    assert all(len(c) <= 1000 for c in chunks)
