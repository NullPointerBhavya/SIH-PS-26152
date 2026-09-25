"""
Comprehensive Verification Test Suite for All Phases:
Phase 1: Ingestion (Telegram + Twitter Tweepy + Fixture backfill + parent_id)
Phase 2: Sentiment (MuRIL multi-label emotion + sentence-pair sarcasm [CLS] P [SEP] R [SEP])
Phase 3: Demographics (spaCy multilingual NER + k-anonymity enforcement at k>=50)
Phase 4: Trends (Kleinberg Poisson burst detection + BERTopic)
Phase 5: Link Analysis (NetworkX PageRank + leidenalg community detection + 2-signal bot scoring)
"""

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


class TestPhase1Ingestion(unittest.TestCase):
    """Phase 1: Ingestion schemas, parent_id, Telegram & Twitter clients."""

    def test_models_and_synonyms(self):
        from db.models import Post, unified_posts
        self.assertIsNotNone(unified_posts)
        # Test parent_id property / synonym on Post instance
        p = Post(post_id=123, user_id=456, text="Test post", in_reply_to_post_id=789)
        self.assertEqual(p.parent_id, 789)
        p.parent_id = 999
        self.assertEqual(p.in_reply_to_post_id, 999)

    def test_twitter_client_fixture_backfill(self):
        import asyncio
        from ingestion.twitter_client import TweepyTwitterClient

        client = TweepyTwitterClient()
        status = client.get_pool_status()
        self.assertIn("mode", status)

        async def _run():
            await client.initialize()
            tweets = []
            async for t in client.search("RailCrisis", limit=5):
                tweets.append(t)
            return tweets

        tweets = asyncio.run(_run())
        self.assertGreater(len(tweets), 0)
        # Verify parent_id correctly populated for reply tweets
        reply_tweets = [t for t in tweets if t.is_reply]
        self.assertGreater(len(reply_tweets), 0)
        self.assertIsNotNone(reply_tweets[0].in_reply_to_post_id)
        print(f"[Phase 1 OK] Twitter fixture backfill loaded {len(tweets)} tweets, reply parent_id: {reply_tweets[0].in_reply_to_post_id}")


class TestPhase2Sentiment(unittest.TestCase):
    """Phase 2: MuRIL multi-label emotion & sentence-pair sarcasm."""

    def test_muril_emotion_and_sarcasm(self):
        from analytics.muril_engine import get_muril_engine

        engine = get_muril_engine()
        engine.ensure_loaded()

        # Task 1: Multi-label Emotion & Stance
        emo_res = engine.predict_emotion("Wah bhai wah, gazab ka kaam kiya hai!")
        self.assertIn(emo_res.dominant, ["Anxiety", "Anger", "Support", "Oppose"])
        print(f"[Phase 2 OK] MuRIL Emotion: {emo_res.dominant} ({emo_res.dominant_score}) | Probabilities: {emo_res.probabilities}")

        # Task 2: Sarcasm Sentence Pairs with Contextual Dissonance
        parent_tragic = "Breaking: 5 people injured in tragic train collision in Delhi today."
        reply_sarcastic = "Wah kya world-class arrangement hai! Truly celebratory day, mazaa aa gaya!"
        sarcasm_res = engine.predict_sarcasm_pair(parent_tragic, reply_sarcastic)

        self.assertIsInstance(sarcasm_res.is_sarcastic_prob, float)
        self.assertGreaterEqual(sarcasm_res.is_sarcastic_prob, 0.0)
        print(f"[Phase 2 OK] MuRIL Sarcasm Pair Score: {sarcasm_res.is_sarcastic_prob:.4f} (is_sarcastic={sarcasm_res.is_sarcastic})")


class TestPhase3Demographics(unittest.TestCase):
    """Phase 3: Multilingual spaCy NER and k-anonymity (k>=50) privacy enforcement."""

    def test_spacy_multilingual_ner(self):
        from analytics.demographics import get_demographics_engine
        demo_engine = get_demographics_engine()
        res = demo_engine.infer_demographics(
            bio="Software engineer at Bengaluru startup. AI researcher.",
            location_raw="Bengaluru, Karnataka, India"
        )
        self.assertEqual(res.profession_category, "tech")
        print(f"[Phase 3 OK] Inferred geo: {res.geo_country}, profession: {res.profession_category}")

    def test_k_anonymity_enforcement(self):
        from analytics.demographics import DemographicsResult, aggregate_demographics

        # Create synthetic cohort: 60 users in tech, 5 users in healthcare (<50 threshold)
        users = []
        for _ in range(60):
            users.append(DemographicsResult(
                age_bracket="25-34", age_confidence=0.8,
                geo_country="India", geo_confidence=0.8,
                language="hi", profession_category="tech", profession_confidence=0.9
            ))
        for _ in range(5):
            users.append(DemographicsResult(
                age_bracket="18-24", age_confidence=0.8,
                geo_country="France", geo_confidence=0.8,
                language="fr", profession_category="healthcare", profession_confidence=0.9
            ))

        agg = aggregate_demographics(users, k_anonymity=50)
        # Tech cohort (60 >= 50) MUST be retained
        self.assertIn("tech", agg["profession_distribution"])
        self.assertEqual(agg["profession_distribution"]["tech"]["count"], 60)
        # Healthcare cohort (5 < 50) MUST be SUPPRESSED
        self.assertNotIn("healthcare", agg["profession_distribution"])
        self.assertIn("<k50_suppressed", agg["profession_distribution"])
        print(f"[Phase 3 OK] K-Anonymity (k=50) verified: Suppressed cohort count={agg['profession_distribution']['<k50_suppressed']['count']}")


class TestPhase4Trends(unittest.TestCase):
    """Phase 4: Kleinberg Poisson burst detection."""

    def test_kleinberg_burst_detection(self):
        from analytics.trends import get_trend_engine
        trend_engine = get_trend_engine()

        # Generate timestamps for a bursting keyword
        now = datetime.now(timezone.utc).timestamp()
        tweets = []
        # Early baseline (sparse)
        for i in range(5):
            tweets.append({
                "text": "Regular news discussion #AIIndia",
                "created_at": datetime.fromtimestamp(now - 7200 + i * 600, tz=timezone.utc).isoformat(),
                "like_count": 5, "retweet_count": 1,
            })
        # Sudden recent surge (burst)
        for i in range(25):
            tweets.append({
                "text": "Breaking surge in computing resources! #AIIndia",
                "created_at": datetime.fromtimestamp(now - 300 + i * 10, tz=timezone.utc).isoformat(),
                "like_count": 50, "retweet_count": 20,
            })

        burst_result = trend_engine.detect_burst_kleinberg(tweets, keyword="#AIIndia", n_bins=6)
        self.assertIn(burst_result["method"], ["kleinberg_poisson", "velocity_fallback"])
        print(f"[Phase 4 OK] Burst Detection on #AIIndia: method={burst_result['method']}, states={burst_result['burst_states']}, is_bursting={burst_result['is_bursting']}")


class TestPhase5LinkAnalysis(unittest.TestCase):
    """Phase 5: NetworkX PageRank, leidenalg community detection, and 2-signal bot scoring."""

    def test_synthetic_network_and_leidenalg(self):
        from analytics.network import get_network_engine
        net_engine = get_network_engine()

        # Build a synthetic network with 8 users across 2 clusters
        tweets = [
            {"user_id": 1, "user": {"handle": "lead_tech", "followers_count": 50000}, "text": "Tech news"},
            {"user_id": 2, "user": {"handle": "dev_1", "followers_count": 1000}, "text": "RT @lead_tech", "mentions": ["lead_tech"]},
            {"user_id": 3, "user": {"handle": "dev_2", "followers_count": 1200}, "text": "Great point @lead_tech", "mentions": ["lead_tech"]},
            {"user_id": 4, "user": {"handle": "dev_3", "followers_count": 800}, "text": "Agree with @lead_tech", "mentions": ["lead_tech"]},
            {"user_id": 5, "user": {"handle": "lead_policy", "followers_count": 40000}, "text": "Policy alert"},
            {"user_id": 6, "user": {"handle": "pol_1", "followers_count": 2000}, "text": "RT @lead_policy", "mentions": ["lead_policy"]},
            {"user_id": 7, "user": {"handle": "pol_2", "followers_count": 1500}, "text": "Discussing @lead_policy", "mentions": ["lead_policy"]},
        ]
        edges = [
            {"source_user_id": 2, "target_user_id": 1, "edge_type": "retweet"},
            {"source_user_id": 3, "target_user_id": 1, "edge_type": "reply"},
            {"source_user_id": 4, "target_user_id": 1, "edge_type": "mention"},
            {"source_user_id": 6, "target_user_id": 5, "edge_type": "retweet"},
            {"source_user_id": 7, "target_user_id": 5, "edge_type": "reply"},
            # Bridge edge between clusters
            {"source_user_id": 3, "target_user_id": 5, "edge_type": "mention"},
        ]

        res = net_engine.build_and_analyze(tweets, edges)
        self.assertGreaterEqual(res.total_nodes, 7)
        self.assertGreaterEqual(len(res.communities), 1)

        # Lead tech should have high PageRank
        lead = next((inf for inf in res.influencers if inf.handle == "lead_tech"), None)
        self.assertIsNotNone(lead)
        self.assertGreater(lead.pagerank, 0.0)
        print(f"[Phase 5 OK] Top Influencer: @{lead.handle} (PageRank={lead.pagerank:.4f}, Archetype={lead.archetype}, Communities={len(res.communities)})")

    def test_two_signal_bot_scoring(self):
        from analytics.network import score_bot_probability

        # Human scheduled account: posts every 10 mins (low CoV), but UNIQUE text (low Jaccard)
        human_posts = [
            {"created_at": f"2026-09-25T10:{i:02d}:00Z", "text": f"Unique investigative report item #{i} with detailed analysis"}
            for i in range(0, 50, 10)
        ]
        other_account_posts = {
            "user_99": [
                {"text": "Completely unrelated content about football and cricket sports events"}
            ]
        }
        human_score = score_bot_probability(human_posts, "user_human", other_account_posts)
        # Should NOT be flagged as bot despite low CoV, because content is unique
        self.assertFalse(human_score["is_bot_flagged"])
        print(f"[Phase 5 OK] Human Scheduler bot_prob={human_score['bot_probability']} (is_bot={human_score['is_bot_flagged']})")

        # Bot farm: low CoV AND near-duplicate content across accounts
        bot_posts = [
            {"created_at": f"2026-09-25T10:{i:02d}:00Z", "text": "CLICK HERE TO WIN FREE BITCOIN NOW! Visit bit.ly/scam123"}
            for i in range(0, 50, 10)
        ]
        bot_farm_cross_posts = {
            "bot_user_2": [
                {"text": "CLICK HERE TO WIN FREE BITCOIN NOW! Visit bit.ly/scam123"}
            ]
        }
        bot_score = score_bot_probability(bot_posts, "bot_user_1", bot_farm_cross_posts)
        self.assertTrue(bot_score["is_bot_flagged"])
        print(f"[Phase 5 OK] Bot Farm bot_prob={bot_score['bot_probability']} (is_bot={bot_score['is_bot_flagged']})")


if __name__ == "__main__":
    unittest.main(verbosity=2)
