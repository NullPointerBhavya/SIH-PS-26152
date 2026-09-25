"""
Application configuration via pydantic-settings.

All config is loaded from environment variables / .env file.
Scraper credentials are in a separate accounts.txt — never in .env.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration loaded from .env (never hardcode secrets)."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Database ──────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/audience_intel"
    sync_database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432/audience_intel"

    # ── Scraper ───────────────────────────────────────────────
    accounts_file: str = "accounts.txt"
    scrape_delay_min: float = 2.0
    scrape_delay_max: float = 5.0
    circuit_breaker_threshold: int = 5   # errors in window before tripping
    circuit_breaker_timeout: int = 300   # seconds to pause after tripping
    scrape_comments: bool = True         # Whether to scrape comments/replies on each post
    max_comments_per_post: int = 10      # Maximum comments/replies scraped per post
    scrape_comments_delay: float = 1.0   # Polite delay between reply extractions

    # ── NLP / Models ──────────────────────────────────────────
    device: str = "cpu"                  # "cpu" or "cuda"
    hf_cache_dir: str = "models_cache"
    sentiment_model: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"
    emotion_model: str = "j-hartmann/emotion-english-distilroberta-base"
    zeroshot_model: str = "facebook/bart-large-mnli"
    spacy_model: str = "en_core_web_sm"
    google_translate_api_key: str = ""   # optional; deep-translator free tier used if empty
    emotion_csv_path: str = "emotions/tweet_emotions.csv"

    # ── MuRIL — Primary Multilingual Sentiment Engine ─────────
    # Core model: google/muril-base-cased (pre-trained on 17 Indian languages
    # + Romanized Hindi / Hinglish code-mixed data via HuggingFace Transformers)
    muril_model_id: str = "google/muril-base-cased"
    # Directory for fine-tuned head checkpoints (emotion_head.pt, sarcasm_head.pt)
    muril_checkpoint_dir: str = "models_cache/muril_checkpoints"
    # Batch size for MuRIL inference (lower on CPU, higher on GPU)
    muril_inference_batch_size: int = 8


    # ── Telegram Ingestion (Phase 1) ───────────────────────────
    # Credentials from https://my.telegram.org/apps
    # Set in .env — NEVER hardcode
    telegram_api_id: str = ""        # TELEGRAM_API_ID
    telegram_api_hash: str = ""      # TELEGRAM_API_HASH
    telegram_session_file: str = "telegram_session"
    # Comma-separated list of public Telegram channels to ingest
    telegram_channels: str = "BBCHindi,ndtvhindi,aajtak"   # override in .env

    # ── X / Twitter (Phase 1) ──────────────────────────────────
    # Official API credentials (free/basic tier)
    # Use tweepy for live sliver; pre-pull fixture JSON for demo backfill
    twitter_bearer_token: str = ""   # TWITTER_BEARER_TOKEN
    # Directory containing pre-pulled JSON fixture files for demo backfill
    fixture_data_dir: str = "fixtures"
    # ── Trends ────────────────────────────────────────────────
    trend_window_minutes: int = 15
    trend_top_n: int = 20

    # ── Logging ───────────────────────────────────────────────
    log_level: str = "INFO"

    # ── API ───────────────────────────────────────────────────
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # ── Helpers ───────────────────────────────────────────────
    @property
    def accounts_path(self) -> Path:
        return Path(self.accounts_file)


@lru_cache
def get_settings() -> Settings:
    """Singleton accessor — import this instead of constructing Settings()."""
    return Settings()
