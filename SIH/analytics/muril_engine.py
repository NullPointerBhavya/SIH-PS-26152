"""
MuRIL-Based Multilingual Sentiment Analysis Engine.

Core Model: google/muril-base-cased (HuggingFace)
Fallback: ai4bharat/indic-bert (IndicBERT)

Why MuRIL over standard BERT:
- Pre-trained on 17 Indian languages + transliterated/Romanized (Hinglish) data
- Handles code-mixed Hindi-English natively without translation step
- Understands romanized Hindi tokens that BERT vocabulary cannot represent

Task 1  |  Emotion & Stance  (Multi-label Sequence Classification)
Labels : Anxiety | Anger | Support | Oppose
Output : sigmoid-activated per-label probabilities -> multi-label flags

Task 2  |  Contextual Sarcasm  (Sentence-Pair Classification)
Input  : [CLS] parent_text [SEP] reply_text [SEP]
         NOTE: MuRIL / IndicBERT are BERT-architecture models.
         Their tokenizers encode sentence pairs as:
             [CLS] sequence_A [SEP] sequence_B [SEP]
         automatically when two strings are passed to the tokenizer.
         There is NO [EOS] token in BERT vocabulary.
Signal : Detects contextual dissonance (e.g. parent is tragic, reply is celebratory)
Output : sarcasm probability [0, 1]

Architecture:
  MuRIL backbone (768-d)
      +- EmotionHead     -> Linear(768 -> 4)  + Sigmoid    (multi-label)
      +- SarcasmHead     -> Linear(768 -> 2)  + Softmax    (binary)

Library: PyTorch + HuggingFace Transformers
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import structlog

logger = structlog.get_logger(__name__)

# ---- Label Definitions -------------------------------------------------------

EMOTION_LABELS: List[str] = ["Anxiety", "Anger", "Support", "Oppose"]
EMOTION_THRESHOLDS: Dict[str, float] = {
    "Anxiety": 0.40,
    "Anger":   0.40,
    "Support": 0.45,
    "Oppose":  0.45,
}
SARCASM_THRESHOLD: float = 0.55

# Model identifiers
MURIL_MODEL_ID     = "google/muril-base-cased"
INDICBERT_FALLBACK = "ai4bharat/indic-bert"

# Token length limits
MAX_SINGLE_LEN = 128   # single-text tasks (emotion/stance)
MAX_PAIR_LEN   = 256   # sentence-pair tasks (sarcasm)


# ==============================================================================
# Data Structures
# ==============================================================================

@dataclass
class EmotionResult:
    """Multi-label emotion + stance output."""
    labels: List[str]                  # active labels above threshold
    probabilities: Dict[str, float]    # raw probability per label
    dominant: str                      # highest-confidence label
    dominant_score: float

    def to_legacy_emotion(self) -> Tuple[str, float]:
        """Map to (emotion_label, emotion_score) for the SentimentScore DB row."""
        if not self.labels:
            return "neutral", 0.5
        return self.dominant, round(self.dominant_score, 4)


@dataclass
class SarcasmResult:
    """Contextual sarcasm output from sentence-pair classification."""
    is_sarcastic_prob: float
    is_sarcastic: bool
    parent_text: Optional[str] = None
    reply_text: Optional[str] = None


@dataclass
class MuRILResult:
    """Combined output: emotion/stance + sarcasm for a single post."""
    emotion: EmotionResult
    sarcasm: SarcasmResult
    # pass-through fields for DB persistence
    sentiment_label: str = "neutral"
    sentiment_score: float = 0.5
    detected_language: str = "hi"


# ==============================================================================
# Dual-Head MuRIL Model
# ==============================================================================

class DualHeadMuRIL:
    """
    Wraps a MuRIL (or IndicBERT) backbone with two classification heads:

    1. EmotionHead  - Multi-label (Anxiety, Anger, Support, Oppose)
       * sigmoid activation; each label is independent
    2. SarcasmHead  - Binary sentence-pair (sarcastic / not-sarcastic)
       * softmax activation on [CLS] parent [SEP] reply [SEP] encoding

    Fine-tuning is handled externally by `muril_trainer.py`.
    This class is **inference-only** at runtime.

    Checkpoint discovery (in order):
      1. <checkpoint_dir>/emotion_head.pt   (fine-tuned weights)
      2. <checkpoint_dir>/sarcasm_head.pt   (fine-tuned weights)
      3. Zero-shot / rule-based fallback (no GPU required)
    """

    def __init__(
        self,
        device: str = "cpu",
        hf_cache_dir: str = "models_cache",
        checkpoint_dir: Optional[str] = None,
    ):
        self._device_str = device
        self._hf_cache = hf_cache_dir
        self._ckpt_dir = (
            Path(checkpoint_dir)
            if checkpoint_dir
            else Path("models_cache/muril_checkpoints")
        )
        self._tokenizer = None
        self._backbone = None
        self._emotion_head = None
        self._sarcasm_head = None
        self._torch = None
        self._loaded = False
        self._fallback_mode = False  # True when torch/transformers unavailable

    # --------------------------------------------------------------------------
    # Lazy loader
    # --------------------------------------------------------------------------

    def ensure_loaded(self) -> None:
        """Load backbone + heads on first call (lazy)."""
        if self._loaded:
            return
        try:
            self._load_model()
        except Exception as exc:
            logger.warning(
                "muril_engine.load_failed_using_fallback",
                error=str(exc),
                hint=(
                    "Run: pip install torch transformers  "
                    "and ensure internet access for first model download."
                ),
            )
            self._fallback_mode = True
        self._loaded = True

    def _load_model(self) -> None:
        """Download / cache MuRIL tokenizer + backbone and attach classification heads."""
        import torch
        import torch.nn as nn
        from transformers import AutoTokenizer, AutoModel

        self._torch = torch
        self._device = torch.device(
            self._device_str
            if (self._device_str == "cpu" or torch.cuda.is_available())
            else "cpu"
        )

        logger.info(
            "muril_engine.loading_backbone",
            model=MURIL_MODEL_ID,
            device=str(self._device),
        )

        # Primary: MuRIL — fallback: IndicBERT
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(
                MURIL_MODEL_ID, cache_dir=self._hf_cache, use_fast=True
            )
            self._backbone = AutoModel.from_pretrained(
                MURIL_MODEL_ID, cache_dir=self._hf_cache
            ).to(self._device)
        except Exception as primary_err:
            logger.warning(
                "muril_engine.muril_unavailable_trying_indicbert",
                error=str(primary_err),
            )
            self._tokenizer = AutoTokenizer.from_pretrained(
                INDICBERT_FALLBACK, cache_dir=self._hf_cache, use_fast=True
            )
            self._backbone = AutoModel.from_pretrained(
                INDICBERT_FALLBACK, cache_dir=self._hf_cache
            ).to(self._device)

        self._backbone.eval()
        hidden_size: int = self._backbone.config.hidden_size  # 768

        # Classification heads
        self._emotion_head = nn.Linear(hidden_size, len(EMOTION_LABELS)).to(self._device)
        self._sarcasm_head = nn.Linear(hidden_size, 2).to(self._device)

        # Load fine-tuned weights if present
        self._try_load_checkpoint("emotion_head.pt", self._emotion_head)
        self._try_load_checkpoint("sarcasm_head.pt", self._sarcasm_head)

        self._emotion_head.eval()
        self._sarcasm_head.eval()

        logger.info(
            "muril_engine.ready",
            emotion_labels=EMOTION_LABELS,
            checkpoint_dir=str(self._ckpt_dir),
        )

    def _try_load_checkpoint(self, filename: str, module) -> None:
        """Attempt to load a saved head state-dict; silently skip if absent."""
        path = self._ckpt_dir / filename
        if path.exists():
            try:
                state = self._torch.load(str(path), map_location=self._device_str)
                module.load_state_dict(state)
                logger.info("muril_engine.checkpoint_loaded", file=filename)
            except Exception as exc:
                logger.warning(
                    "muril_engine.checkpoint_load_failed",
                    file=filename,
                    error=str(exc),
                )

    # --------------------------------------------------------------------------
    # Encoding helpers
    # --------------------------------------------------------------------------

    def _encode_single(self, text: str):
        """Tokenise a single text and return [CLS]-pooled embedding (1, H)."""
        enc = self._tokenizer(
            _clean(text),
            max_length=MAX_SINGLE_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        enc = {k: v.to(self._device) for k, v in enc.items()}
        with self._torch.no_grad():
            out = self._backbone(**enc)
        return out.last_hidden_state[:, 0, :]  # [CLS]

    def _encode_pair(self, parent: str, reply: str):
        """
        Encode (parent, reply) as a sentence pair:
            [CLS] parent_text [SEP] reply_text [SEP]
        Returns [CLS]-pooled embedding capturing cross-utterance context.
        """
        enc = self._tokenizer(
            _clean(parent),
            _clean(reply),
            max_length=MAX_PAIR_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        enc = {k: v.to(self._device) for k, v in enc.items()}
        with self._torch.no_grad():
            out = self._backbone(**enc)
        return out.last_hidden_state[:, 0, :]  # [CLS]

    # --------------------------------------------------------------------------
    # Public inference
    # --------------------------------------------------------------------------

    def predict_emotion(self, text: str) -> EmotionResult:
        """
        Multi-label emotion/stance classification on a single text.

        Returns sigmoid-activated probabilities for each of:
            Anxiety | Anger | Support | Oppose
        Active labels are those above their per-label threshold.
        """
        self.ensure_loaded()
        if self._fallback_mode or self._backbone is None:
            return _fallback_emotion(text)

        import torch

        cls_emb = self._encode_single(text)
        with torch.no_grad():
            logits = self._emotion_head(cls_emb)           # (1, 4)
            probs  = torch.sigmoid(logits).squeeze(0).tolist()

        prob_dict = {
            label: round(float(p), 4)
            for label, p in zip(EMOTION_LABELS, probs)
        }
        active    = [lbl for lbl, p in prob_dict.items() if p >= EMOTION_THRESHOLDS[lbl]]
        dominant  = max(prob_dict, key=prob_dict.get)

        return EmotionResult(
            labels=active,
            probabilities=prob_dict,
            dominant=dominant,
            dominant_score=prob_dict[dominant],
        )

    def predict_sarcasm_pair(self, parent_text: str, reply_text: str) -> SarcasmResult:
        """
        Contextual sarcasm detection via sentence-pair classification.

        Encodes the pair using HuggingFace tokenizer sentence-pair API:
            [CLS] parent_text [SEP] reply_text [SEP]

        NOTE: MuRIL and IndicBERT are BERT-architecture models. Their tokenizers
        automatically produce [CLS] A [SEP] B [SEP] when two strings are passed.
        There is no [EOS] token in their vocabulary — do NOT pass '</s>' or '[EOS]'.

        Contextual dissonance examples:
          - parent: "5 people killed in terror attack"
          - reply:  "Great work!! Very happy about this"
          => high sarcasm probability

        Falls back to rule-based cues when parent_text is absent or model unloaded.
        """
        self.ensure_loaded()

        if not parent_text or not parent_text.strip():
            # No conversational context available; use mild rule-based score
            prob = _rule_based_sarcasm(reply_text) * 0.5  # downweight without context
            return SarcasmResult(
                is_sarcastic_prob=round(prob, 4),
                is_sarcastic=prob >= SARCASM_THRESHOLD,
                parent_text=parent_text,
                reply_text=reply_text,
            )

        if self._fallback_mode or self._backbone is None:
            prob = _rule_based_sarcasm(reply_text)
            return SarcasmResult(
                is_sarcastic_prob=round(prob, 4),
                is_sarcastic=prob >= SARCASM_THRESHOLD,
                parent_text=parent_text,
                reply_text=reply_text,
            )

        import torch

        cls_emb = self._encode_pair(parent_text, reply_text)
        with torch.no_grad():
            logits = self._sarcasm_head(cls_emb)          # (1, 2)
            probs  = torch.softmax(logits, dim=-1).squeeze(0).tolist()

        sarcasm_prob = round(float(probs[1]), 4)           # index 1 = sarcastic class

        return SarcasmResult(
            is_sarcastic_prob=sarcasm_prob,
            is_sarcastic=sarcasm_prob >= SARCASM_THRESHOLD,
            parent_text=parent_text,
            reply_text=reply_text,
        )

    def analyze(
        self,
        reply_text: str,
        parent_text: Optional[str] = None,
        sentiment_label: str = "neutral",
        sentiment_score: float = 0.5,
        detected_language: str = "hi",
    ) -> MuRILResult:
        """
        Full pipeline for a single post.

        Steps:
          1. Multi-label emotion/stance from reply_text  (Task 1)
          2. Contextual sarcasm from (parent_text, reply_text)  (Task 2)
          3. Heuristic dissonance boost if parent is tragic but reply is celebratory

        Args:
            reply_text:        The post / tweet to analyse.
            parent_text:       Text of the in_reply_to post (fetched from DB).
                               Pass None or "" for root posts.
            sentiment_label:   Pre-computed polarity label (pass-through to DB).
            sentiment_score:   Pre-computed polarity confidence (pass-through).
            detected_language: ISO language code (pass-through).
        """
        emotion = self.predict_emotion(reply_text)
        sarcasm = self.predict_sarcasm_pair(parent_text or "", reply_text)

        # Boost sarcasm probability when sentiment polarity of parent and reply conflict
        if parent_text:
            sarcasm = _boost_sarcasm_on_dissonance(parent_text, reply_text, sarcasm, emotion)

        return MuRILResult(
            emotion=emotion,
            sarcasm=sarcasm,
            sentiment_label=sentiment_label,
            sentiment_score=sentiment_score,
            detected_language=detected_language,
        )

    def analyze_batch(self, posts: List[Dict]) -> List[MuRILResult]:
        """
        Batch analysis.

        Each dict in `posts` must contain:
            "text"        : str   (reply / post text)
            "parent_text" : str   (parent post text, or "" for root posts)
        Optional pass-through keys:
            "sentiment_label", "sentiment_score", "detected_language"
        """
        return [
            self.analyze(
                reply_text=p["text"],
                parent_text=p.get("parent_text", ""),
                sentiment_label=p.get("sentiment_label", "neutral"),
                sentiment_score=p.get("sentiment_score", 0.5),
                detected_language=p.get("detected_language", "hi"),
            )
            for p in posts
        ]


# ==============================================================================
# Contextual Dissonance Booster
# ==============================================================================

_TRAGIC_KEYWORDS = re.compile(
    r"\b(died?|death|killed?|accident|tragedy|tragic|crash|victim|disaster|"
    r"earthquake|flood|terror|attack|murder|rape|protest|riot|violence|"
    r"dukh|dard|maut|haadsa|mre|mrge|"
    r"मृत्यु|मर गए|दुखद|हादसा|आतंक|मौत|बलात्कार|हिंसा)\b",
    re.IGNORECASE,
)
_CELEBRATORY_KEYWORDS = re.compile(
    r"\b(great|amazing|awesome|wonderful|fantastic|celebrate|congrats|"
    r"cheers|yay|hurray|excellent|brilliant|superb|love it|clapping|"
    r"zabardast|kamaal|mast|wah|shabash|"
    r"मस्त|ज़बरदस्त|वाह|शाबाश|बधाई)\b",
    re.IGNORECASE,
)


def _boost_sarcasm_on_dissonance(
    parent: str,
    reply: str,
    result: SarcasmResult,
    emotion: EmotionResult,
) -> SarcasmResult:
    """
    Add +0.20 to sarcasm probability when:
      - Parent text contains tragic/violent keywords, AND
      - Reply text contains celebratory keywords OR dominant emotion is Support
    Probability is capped at 0.95.
    """
    parent_tragic      = bool(_TRAGIC_KEYWORDS.search(parent))
    reply_celebratory  = bool(_CELEBRATORY_KEYWORDS.search(reply))
    reply_is_support   = (emotion.dominant == "Support" and emotion.dominant_score > 0.5)

    if parent_tragic and (reply_celebratory or reply_is_support):
        boosted = min(result.is_sarcastic_prob + 0.20, 0.95)
        return SarcasmResult(
            is_sarcastic_prob=round(boosted, 4),
            is_sarcastic=boosted >= SARCASM_THRESHOLD,
            parent_text=parent,
            reply_text=reply,
        )
    return result


# ==============================================================================
# Rule-based fallbacks (no model loaded)
# ==============================================================================

_ANXIETY_RE = re.compile(
    r"\b(worried|anxious|scared|panic|stress|fear|crisis|danger|afraid|"
    r"dar|darna|डर|घबरा|chinta|चिंता)\b",
    re.I,
)
_ANGER_RE = re.compile(
    r"\b(angry|mad|furious|outrage|hate|disgusting|bakwas|ganda|kameena|"
    r"harami|galat|gussa|नफरत|गुस्सा|क्रोध)\b",
    re.I,
)
_SUPPORT_RE = re.compile(
    r"\b(support|agree|congrats|proud|great|love|salute|respect|sahi|"
    r"accha|wah|shayad|साथ|समर्थन|वाह|शाबाश)\b",
    re.I,
)
_OPPOSE_RE = re.compile(
    r"\b(oppose|against|boycott|reject|wrong|galat|nahi|fraud|corrupt|"
    r"band karo|hatao|विरोध|गलत|बंद करो|हटाओ)\b",
    re.I,
)


def _fallback_emotion(text: str) -> EmotionResult:
    """
    Rule-based emotion classifier used when the neural model is unavailable.
    Scores each label independently using keyword regex patterns.
    """
    probs = {
        "Anxiety": 0.50 if _ANXIETY_RE.search(text) else 0.15,
        "Anger":   0.50 if _ANGER_RE.search(text)   else 0.15,
        "Support": 0.50 if _SUPPORT_RE.search(text) else 0.15,
        "Oppose":  0.50 if _OPPOSE_RE.search(text)  else 0.15,
    }
    active   = [lbl for lbl, p in probs.items() if p >= EMOTION_THRESHOLDS[lbl]]
    dominant = max(probs, key=probs.get)
    return EmotionResult(
        labels=active,
        probabilities=probs,
        dominant=dominant,
        dominant_score=probs[dominant],
    )


_SARCASM_CUES = re.compile(
    r"\b(oh great|wow thanks|just what i needed|how wonderful|so helpful|"
    r"yeah right|genius|wah wah|kya baat hai|sure sure|amazing how|"
    r"wah re wah|bahut acha|kya scene hai)\b",
    re.I,
)
_EXAGGERATION = re.compile(r"[!?]{2,}|[A-Z]{4,}")


def _rule_based_sarcasm(text: str) -> float:
    """Rule-based sarcasm probability when the neural model is unavailable."""
    score = 0.0
    if _SARCASM_CUES.search(text):
        score += 0.40
    if _EXAGGERATION.search(text):
        score += 0.15
    return min(round(score, 4), 0.80)


# ==============================================================================
# Preprocessing
# ==============================================================================

def _clean(text: str) -> str:
    """
    Minimal cleaning for MuRIL input.
    - Preserve Devanagari, Romanized Hindi, and emojis (MuRIL handles them).
    - Replace URLs with [URL] placeholder.
    - Normalize @mentions to @user.
    - Collapse whitespace.
    """
    if not text:
        return ""
    text = re.sub(r"https?://\S+", "[URL]", text)
    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:512]  # hard safety cap


# ==============================================================================
# Singleton accessor
# ==============================================================================

_engine_instance: Optional[DualHeadMuRIL] = None


def get_muril_engine(
    device: str = "cpu",
    hf_cache_dir: str = "models_cache",
    checkpoint_dir: Optional[str] = None,
) -> DualHeadMuRIL:
    """
    Singleton getter.
    The engine lazy-loads on first inference call; call ensure_loaded() for
    eager warm-up (e.g. on server startup).
    """
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = DualHeadMuRIL(
            device=device,
            hf_cache_dir=hf_cache_dir,
            checkpoint_dir=checkpoint_dir,
        )
    return _engine_instance


# ==============================================================================
# Parent-text DB lookup helper (Phase 2 wiring)
# ==============================================================================

async def fetch_parent_text(session, in_reply_to_post_id: Optional[int]) -> Optional[str]:
    """
    Look up the text of a parent post from the DB using in_reply_to_post_id.

    This is how the sarcasm sentence-pair input is populated at runtime:
        parent_text = await fetch_parent_text(session, post.in_reply_to_post_id)
        result = engine.analyze(reply_text=post.text, parent_text=parent_text)

    Returns None if in_reply_to_post_id is None or the parent is not in the DB
    (e.g. scraped before the parent was ingested).

    Usage in ingestion pipeline (store.py / api/main.py):
        from analytics.muril_engine import fetch_parent_text
        parent_txt = await fetch_parent_text(session, tweet.in_reply_to_post_id)
        muril_result = get_muril_engine().analyze(
            reply_text=tweet.text,
            parent_text=parent_txt,
        )
    """
    if not in_reply_to_post_id:
        return None
    try:
        from sqlalchemy import select
        from db.models import Post
        stmt = select(Post.text).where(Post.post_id == in_reply_to_post_id).limit(1)
        row = (await session.execute(stmt)).first()
        return row[0] if row else None
    except Exception as exc:
        logger.warning(
            "muril_engine.parent_lookup_failed",
            post_id=in_reply_to_post_id,
            error=str(exc),
        )
        return None


async def fetch_parent_texts_batch(session, post_ids: List[int]) -> Dict[int, str]:
    """
    Batch lookup parent texts in a single IN (...) query.
    Returns mapping {post_id: text}.
    """
    valid_ids = [pid for pid in post_ids if pid]
    if not valid_ids:
        return {}
    try:
        from sqlalchemy import select
        from db.models import Post
        stmt = select(Post.post_id, Post.text).where(Post.post_id.in_(valid_ids))
        res = await session.execute(stmt)
        return {row[0]: row[1] for row in res.all()}
    except Exception as exc:
        logger.warning("muril_engine.batch_parent_lookup_failed", count=len(valid_ids), error=str(exc))
        return {}


async def fetch_posts_with_parent_text(session, limit: int = 100) -> List[Tuple[Any, Optional[str]]]:
    """
    Performs a REAL SQL self-join in Postgres:
        SELECT reply.*, parent.text AS parent_text
        FROM posts reply
        LEFT OUTER JOIN posts parent ON reply.in_reply_to_post_id = parent.post_id
        ORDER BY reply.created_at DESC
        LIMIT :limit

    Returns a list of (Post, parent_text) tuples for sentence-pair sarcasm inference.
    """
    from sqlalchemy import select
    from sqlalchemy.orm import aliased
    from db.models import Post

    ParentPost = aliased(Post, name="parent_post")
    stmt = (
        select(Post, ParentPost.text)
        .outerjoin(ParentPost, Post.in_reply_to_post_id == ParentPost.post_id)
        .order_by(Post.created_at.desc())
        .limit(limit)
    )
    res = await session.execute(stmt)
    return [(row[0], row[1]) for row in res.all()]
