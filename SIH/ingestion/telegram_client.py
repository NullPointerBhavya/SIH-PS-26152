"""
Telegram Channel Ingestion — Telethon-based public channel scraper.

Why Telegram first:
- Public channels have no authentication wall (only API credentials needed)
- Telethon is maintained, well-documented, and doesn't break on platform updates
- Reply threads provide parent_id natively (message.reply_to_msg_id)
- Gives real rows in Postgres before touching X quota

Architecture:
- Uses the same ScraperClient ABC from ingestion/client.py
- Converts Telethon Message objects to the same ScrapedTweet dataclass
  so the existing persist_tweet_pipeline() in store.py works unchanged
- source_platform = 'telegram', channel_id = channel username

Usage (async context):
    client = TelegramClient(channels=["@BBCHindi", "@ndtvhindi", "@aajtak"])
    await client.initialize()
    async for post in client.search("vaccine", limit=100):
        await persist_tweet_pipeline(session, post)

Setup:
    pip install telethon
    # Set in .env:
    TELEGRAM_API_ID=<your_api_id>
    TELEGRAM_API_HASH=<your_api_hash>
    TELEGRAM_SESSION_FILE=telegram_session  # auto-created
    # Get credentials at: https://my.telegram.org/apps
"""

from __future__ import annotations

import asyncio
import hashlib
import re
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, List, Optional

from ingestion.client import ScraperClient
from ingestion.models import ScrapedTweet, ScrapedUser
from logging_config import get_logger

logger = get_logger("ingestion.telegram")

# Synthetic "user_id" base for Telegram channels (no real user concept)
# We hash the channel username into a stable int to avoid collisions with X IDs
_CHANNEL_ID_OFFSET = 10_000_000_000_000  # 10 trillion — safely above X snowflake range


def _channel_to_uid(channel: str) -> int:
    """Derive a stable synthetic user_id from a channel name."""
    h = int(hashlib.sha256(channel.encode()).hexdigest()[:12], 16)
    return _CHANNEL_ID_OFFSET + (h % 1_000_000_000)


def _extract_mentions(text: str) -> List[str]:
    """Extract @mentions from message text."""
    return re.findall(r"@(\w+)", text or "")


def _extract_hashtags(text: str) -> List[str]:
    """Extract #hashtags from message text."""
    return re.findall(r"#(\w+)", text or "")


class TelegramChannelClient(ScraperClient):
    """
    Telethon-based public channel scraper conforming to the ScraperClient interface.

    Key behaviours:
    - message.id         → post_id  (unique within channel; prefixed with channel hash)
    - message.reply_to_msg_id → in_reply_to_post_id  (parent link for sarcasm detection)
    - channel username   → user_id (stable hash) and channel_id field
    - source_platform    = 'telegram' (stored in Post.source_platform)
    """

    def __init__(
        self,
        channels: List[str],
        api_id: Optional[int] = None,
        api_hash: Optional[str] = None,
        session_file: str = "telegram_session",
    ):
        """
        Args:
            channels:     List of public channel usernames (with or without @).
            api_id:       Telegram API ID from https://my.telegram.org/apps
            api_hash:     Telegram API hash.
            session_file: Path (without extension) for Telethon session persistence.
        """
        self.channels = [c.lstrip("@") for c in channels]
        self._session = session_file
        self._client = None
        self._initialized = False

        # Load credentials from args → env → settings
        import os
        from config import get_settings
        s = get_settings()
        self._api_id   = api_id   or int(os.getenv("TELEGRAM_API_ID",   getattr(s, "telegram_api_id",   "0") or "0"))
        self._api_hash = api_hash or     os.getenv("TELEGRAM_API_HASH", getattr(s, "telegram_api_hash", "") or "")

    async def initialize(self) -> bool:
        """
        Connect to Telegram using Telethon and authenticate.
        On first run, Telethon will prompt for phone + code (interactive).
        Subsequent runs use the saved session file.
        """
        if not self._api_id or not self._api_hash:
            logger.error(
                "telegram_credentials_missing",
                hint="Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env",
            )
            return False

        try:
            from telethon import TelegramClient as _TelegramClient
            self._client = _TelegramClient(
                self._session,
                self._api_id,
                self._api_hash,
            )
            await self._client.start()
            self._initialized = True
            me = await self._client.get_me()
            logger.info(
                "telegram_client_connected",
                user=getattr(me, "username", "bot"),
                channels=self.channels,
            )
            return True
        except ImportError:
            logger.error(
                "telethon_not_installed",
                hint="pip install telethon",
            )
            return False
        except Exception as exc:
            logger.error("telegram_init_failed", error=str(exc))
            return False

    def _msg_to_post_id(self, channel: str, msg_id: int) -> int:
        """
        Derive a globally unique post_id from (channel, message_id).
        Format: channel_hash_prefix (9 digits) + message_id (up to 9 digits)
        This avoids collisions between the same message ID in different channels.
        """
        prefix = _channel_to_uid(channel) % 1_000_000_000  # 9 digits
        return int(f"{prefix:09d}{msg_id:09d}")

    def _msg_to_scraped_tweet(self, msg, channel: str) -> Optional[ScrapedTweet]:
        """
        Convert a Telethon Message object to a ScrapedTweet dataclass.

        Critical fields for downstream phases:
          - in_reply_to_post_id: from msg.reply_to_msg_id (parent for sarcasm)
          - source_platform: 'telegram'
          - channel_id: channel username (stored via upsert_post)
        """
        # Only process text messages (skip photos/videos with no caption)
        text = getattr(msg, "raw_text", None) or getattr(msg, "message", "") or ""
        if not text.strip():
            return None

        uid    = _channel_to_uid(channel)
        msg_id = getattr(msg, "id", 0)
        post_id = self._msg_to_post_id(channel, msg_id)

        # Datetime
        dt = getattr(msg, "date", None)
        if dt is None:
            dt = datetime.now(timezone.utc)
        elif dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        # Parent link
        reply_to = getattr(msg, "reply_to_msg_id", None)
        parent_post_id: Optional[int] = None
        if reply_to:
            parent_post_id = self._msg_to_post_id(channel, reply_to)

        # Reactions as proxy for like_count
        reactions = getattr(msg, "reactions", None)
        like_count = 0
        if reactions and hasattr(reactions, "results"):
            like_count = sum(getattr(r, "count", 0) for r in reactions.results)

        # Forwards as proxy for retweet_count
        fwd_count = int(getattr(msg, "forwards", 0) or 0)

        user = ScrapedUser(
            user_id=uid,
            handle=channel,
            display_name=f"@{channel}",
            bio=None,
            location_raw=None,
            profile_created_at=None,
            followers_count=0,
            following_count=0,
            verified=False,
            language=None,
        )

        tweet = ScrapedTweet(
            post_id=post_id,
            user_id=uid,
            text=text,
            created_at=dt,
            lang=None,  # langdetect will handle this in sentiment pipeline
            like_count=like_count,
            retweet_count=fwd_count,
            reply_count=0,
            quote_count=0,
            is_retweet=False,
            is_quote=False,
            is_reply=bool(reply_to),
            in_reply_to_post_id=parent_post_id,
            in_reply_to_user_id=uid if reply_to else None,  # same channel
            hashtags=_extract_hashtags(text),
            mentions=_extract_mentions(text),
            user=user,
        )

        # Attach platform metadata for store.py upsert_post
        tweet._source_platform = "telegram"
        tweet._channel_id = channel

        return tweet

    async def search(
        self,
        query: str,
        limit: int = 100,
        since: Optional[str] = None,
    ) -> AsyncGenerator[ScrapedTweet, None]:
        """
        Search for messages matching `query` across all configured channels.
        Iterates channels in order and yields up to `limit` total posts.

        `since` is ignored for Telegram (channel.iter_messages fetches latest-first).
        """
        if not self._initialized or not self._client:
            logger.error("telegram_not_initialized", hint="Call await client.initialize() first")
            return

        yielded = 0

        for channel in self.channels:
            if yielded >= limit:
                break
            try:
                async for msg in self._client.iter_messages(
                    channel,
                    search=query,
                    limit=min(limit - yielded, 200),
                ):
                    if yielded >= limit:
                        break
                    post = self._msg_to_scraped_tweet(msg, channel)
                    if post is not None:
                        yield post
                        yielded += 1
                        await asyncio.sleep(0.05)  # gentle rate control
            except Exception as exc:
                logger.warning(
                    "telegram_channel_search_failed",
                    channel=channel,
                    error=str(exc),
                )

    async def iter_channel(
        self,
        channel: str,
        limit: int = 500,
    ) -> AsyncGenerator[ScrapedTweet, None]:
        """
        Pull the most recent `limit` messages from a specific channel.
        Use this to bulk-load historical messages for fixture/backfill.
        """
        if not self._initialized or not self._client:
            logger.error("telegram_not_initialized")
            return

        channel = channel.lstrip("@")
        try:
            async for msg in self._client.iter_messages(channel, limit=limit):
                post = self._msg_to_scraped_tweet(msg, channel)
                if post is not None:
                    yield post
                    await asyncio.sleep(0.02)
        except Exception as exc:
            logger.warning(
                "telegram_channel_iter_failed",
                channel=channel,
                error=str(exc),
            )

    async def get_user(self, handle_or_id: str) -> Optional[ScrapedUser]:
        """Return a synthetic user for a Telegram channel (channels have no user profile)."""
        channel = handle_or_id.lstrip("@")
        uid = _channel_to_uid(channel)
        return ScrapedUser(
            user_id=uid,
            handle=channel,
            display_name=f"@{channel}",
        )

    def get_pool_status(self) -> Dict:
        return {
            "platform": "telegram",
            "initialized": self._initialized,
            "channels": self.channels,
            "api_id_set": bool(self._api_id),
        }

    async def disconnect(self) -> None:
        """Gracefully close the Telethon client."""
        if self._client:
            await self._client.disconnect()
            logger.info("telegram_client_disconnected")


# ── Store-layer patch for source_platform ────────────────────────────────────
# upsert_post() in store.py doesn't yet write source_platform / channel_id.
# This helper wraps it to inject those fields.

async def upsert_post_telegram(session, tweet: ScrapedTweet) -> bool:
    """
    Extended upsert for Telegram posts that also writes source_platform and channel_id.
    Falls back to base upsert_post if the Post model doesn't have the columns yet.
    """
    from sqlalchemy.dialects.postgresql import insert
    from db.models import Post

    platform = getattr(tweet, "_source_platform", "telegram")
    channel  = getattr(tweet, "_channel_id", None)

    try:
        stmt = insert(Post).values(
            post_id=tweet.post_id,
            user_id=tweet.user_id,
            text=tweet.text,
            created_at=tweet.created_at,
            lang=tweet.lang,
            like_count=tweet.like_count,
            retweet_count=tweet.retweet_count,
            reply_count=tweet.reply_count,
            quote_count=tweet.quote_count,
            is_retweet=tweet.is_retweet,
            is_quote=tweet.is_quote,
            is_reply=tweet.is_reply,
            in_reply_to_post_id=tweet.in_reply_to_post_id,
            in_reply_to_user_id=tweet.in_reply_to_user_id,
            source_platform=platform,
            channel_id=channel,
            hashtags=tweet.hashtags,
            mentions=tweet.mentions,
        )
        stmt = stmt.on_conflict_do_nothing(index_elements=[Post.post_id])
        res = await session.execute(stmt)
        return res.rowcount > 0
    except Exception:
        # Column may not exist yet if migration hasn't run — fall back
        from ingestion.store import upsert_post
        return await upsert_post(session, tweet)
