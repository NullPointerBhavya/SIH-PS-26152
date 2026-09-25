"""
MuRIL Fine-Tuning Trainer for Emotion/Stance and Sarcasm Detection.

===========================================================================
OVERVIEW
===========================================================================
This module provides two Trainer classes that fine-tune the MuRIL backbone
(google/muril-base-cased) for the two NLP tasks required by the project:

  Task 1 — EmotionStanceTrainer
      Fine-tunes MuRIL for multi-label sequence classification.
      Labels: Anxiety | Anger | Support | Oppose
      Loss: Binary Cross-Entropy with sigmoid (BCEWithLogitsLoss)
      Input: single tweet text

  Task 2 — SarcasmPairTrainer
      Fine-tunes MuRIL on sentence-pair inputs for binary sarcasm detection.
      Input format: [CLS] parent_text [SEP] reply_text [SEP]
      Loss: CrossEntropyLoss (binary)
      Signal: Contextual dissonance (tragic parent + celebratory reply = sarcasm)

===========================================================================
DATA FORMAT EXPECTED
===========================================================================

  Task 1 — Emotion/Stance
  A CSV with columns: text, Anxiety, Anger, Support, Oppose
  Each label column contains 0 or 1 (multi-hot encoding).
  Example:
    text,Anxiety,Anger,Support,Oppose
    "Yaar ye sab khatam kab hoga",1,0,0,0
    "I totally support this move",0,0,1,0
    "Ye sarkar bilkul galat hai",0,1,0,1

  Task 2 — Sarcasm Pairs
  A CSV with columns: parent_text, reply_text, label
  label: 0 = not sarcastic, 1 = sarcastic
  Example:
    parent_text,reply_text,label
    "5 people killed in terror attack","Great work!! Very happy",1
    "New hospital opened in Delhi","Wonderful news for the city",0

===========================================================================
USAGE
===========================================================================

  # Fine-tune emotion/stance head
  python -m analytics.muril_trainer \
      --task emotion \
      --data path/to/emotion_data.csv \
      --checkpoint-dir models_cache/muril_checkpoints \
      --epochs 5 \
      --batch-size 16 \
      --lr 2e-5 \
      --device cpu

  # Fine-tune sarcasm head (sentence-pair)
  python -m analytics.muril_trainer \
      --task sarcasm \
      --data path/to/sarcasm_pairs.csv \
      --checkpoint-dir models_cache/muril_checkpoints \
      --epochs 5 \
      --batch-size 16 \
      --lr 2e-5 \
      --device cpu

  # Both tasks sequentially
  python -m analytics.muril_trainer \
      --task both \
      --emotion-data path/to/emotion.csv \
      --sarcasm-data path/to/sarcasm.csv \
      --checkpoint-dir models_cache/muril_checkpoints

===========================================================================
LIBRARY: PyTorch + HuggingFace Transformers
===========================================================================
"""

from __future__ import annotations

import argparse
import csv
import logging
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

# ==============================================================================
# Constants
# ==============================================================================

EMOTION_LABELS: List[str] = ["Anxiety", "Anger", "Support", "Oppose"]
MURIL_MODEL_ID  = "google/muril-base-cased"
INDICBERT_FALLBACK = "ai4bharat/indic-bert"

MAX_SINGLE_LEN = 128
MAX_PAIR_LEN   = 256

DEFAULT_EPOCHS     = 5
DEFAULT_BATCH_SIZE = 16
DEFAULT_LR         = 2e-5
DEFAULT_WARMUP     = 0.1        # fraction of total steps
GRADIENT_CLIP      = 1.0


# ==============================================================================
# Dataset Helpers
# ==============================================================================

def _clean_text(text: str) -> str:
    """Minimal preprocessing — preserve Devanagari, Romanized Hindi, emojis."""
    import re
    if not text:
        return ""
    text = re.sub(r"https?://\S+", "[URL]", text)
    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:512]


def load_emotion_csv(path: str) -> Tuple[List[str], List[List[int]]]:
    """
    Load emotion/stance dataset from CSV.

    Expected columns: text, Anxiety, Anger, Support, Oppose
    Returns (texts, labels) where labels is a list of [0/1, 0/1, 0/1, 0/1].
    """
    texts: List[str] = []
    labels: List[List[int]] = []

    with open(path, encoding="utf-8", errors="ignore", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            text = _clean_text(row.get("text", "").strip())
            if not text:
                continue
            label_vec = [
                int(float(row.get(lbl, 0) or 0))
                for lbl in EMOTION_LABELS
            ]
            texts.append(text)
            labels.append(label_vec)

    logger.info("emotion_csv_loaded path=%s samples=%d", path, len(texts))
    return texts, labels


def load_sarcasm_csv(path: str) -> Tuple[List[str], List[str], List[int]]:
    """
    Load sarcasm sentence-pair dataset from CSV.

    Expected columns: parent_text, reply_text, label (0/1)
    Returns (parent_texts, reply_texts, labels).
    """
    parents: List[str] = []
    replies: List[str] = []
    labels:  List[int] = []

    with open(path, encoding="utf-8", errors="ignore", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parent = _clean_text(row.get("parent_text", "").strip())
            reply  = _clean_text(row.get("reply_text",  "").strip())
            if not reply:
                continue
            label = int(float(row.get("label", 0) or 0))
            parents.append(parent)
            replies.append(reply)
            labels.append(label)

    logger.info("sarcasm_csv_loaded path=%s samples=%d", path, len(replies))
    return parents, replies, labels


# ==============================================================================
# PyTorch Datasets
# ==============================================================================

def _make_emotion_dataset(tokenizer, texts: List[str], labels: List[List[int]]):
    """Build a PyTorch Dataset for emotion/stance multi-label classification."""
    import torch
    from torch.utils.data import Dataset

    class EmotionDataset(Dataset):
        def __init__(self, tok, texts, labels):
            self.encodings = tok(
                texts,
                max_length=MAX_SINGLE_LEN,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            )
            self.labels = torch.tensor(labels, dtype=torch.float32)

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, idx):
            return (
                {k: v[idx] for k, v in self.encodings.items()},
                self.labels[idx],
            )

    return EmotionDataset(tokenizer, texts, labels)


def _make_sarcasm_dataset(
    tokenizer,
    parents: List[str],
    replies: List[str],
    labels: List[int],
):
    """Build a PyTorch Dataset for sarcasm sentence-pair binary classification."""
    import torch
    from torch.utils.data import Dataset

    class SarcasmDataset(Dataset):
        def __init__(self, tok, parents, replies, labels):
            # Sentence-pair encoding: [CLS] parent [SEP] reply [SEP]
            self.encodings = tok(
                parents,
                replies,
                max_length=MAX_PAIR_LEN,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            )
            self.labels = torch.tensor(labels, dtype=torch.long)

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, idx):
            return (
                {k: v[idx] for k, v in self.encodings.items()},
                self.labels[idx],
            )

    return SarcasmDataset(tokenizer, parents, replies, labels)


# ==============================================================================
# Backbone + Head builder
# ==============================================================================

def _load_backbone_and_tokenizer(
    device_str: str,
    hf_cache: str = "models_cache",
):
    """
    Load MuRIL tokenizer and backbone (falls back to IndicBERT on failure).
    Returns (tokenizer, backbone, device, hidden_size).
    """
    import torch
    from transformers import AutoTokenizer, AutoModel

    device = torch.device(
        device_str
        if (device_str == "cpu" or torch.cuda.is_available())
        else "cpu"
    )

    try:
        logger.info("Loading MuRIL backbone: %s", MURIL_MODEL_ID)
        tokenizer = AutoTokenizer.from_pretrained(
            MURIL_MODEL_ID, cache_dir=hf_cache, use_fast=True
        )
        backbone = AutoModel.from_pretrained(
            MURIL_MODEL_ID, cache_dir=hf_cache
        ).to(device)
    except Exception as e:
        logger.warning("MuRIL load failed (%s), trying IndicBERT", e)
        tokenizer = AutoTokenizer.from_pretrained(
            INDICBERT_FALLBACK, cache_dir=hf_cache, use_fast=True
        )
        backbone = AutoModel.from_pretrained(
            INDICBERT_FALLBACK, cache_dir=hf_cache
        ).to(device)

    hidden_size = backbone.config.hidden_size
    logger.info("Backbone ready | device=%s | hidden_size=%d", device, hidden_size)
    return tokenizer, backbone, device, hidden_size


# ==============================================================================
# Training utilities
# ==============================================================================

def _get_linear_schedule_with_warmup(optimizer, num_warmup_steps: int, num_training_steps: int):
    """Linear LR warmup then linear decay."""
    from torch.optim.lr_scheduler import LambdaLR

    def lr_lambda(current_step: int) -> float:
        if current_step < num_warmup_steps:
            return float(current_step) / float(max(1, num_warmup_steps))
        progress = float(current_step - num_warmup_steps) / float(
            max(1, num_training_steps - num_warmup_steps)
        )
        return max(0.0, 1.0 - progress)

    return LambdaLR(optimizer, lr_lambda)


def _train_loop(
    backbone,
    head,
    dataloader,
    optimizer,
    scheduler,
    loss_fn,
    device,
    epochs: int,
    task_name: str,
) -> None:
    """Generic training loop for a backbone + single head."""
    import torch

    backbone.train()
    head.train()

    for epoch in range(epochs):
        total_loss = 0.0
        t0 = time.time()

        for step, (batch_enc, batch_labels) in enumerate(dataloader):
            batch_enc   = {k: v.to(device) for k, v in batch_enc.items()}
            batch_labels = batch_labels.to(device)

            # Forward pass through backbone then head
            with torch.set_grad_enabled(True):
                out    = backbone(**batch_enc)
                cls    = out.last_hidden_state[:, 0, :]   # [CLS] token
                logits = head(cls)
                loss   = loss_fn(logits, batch_labels)

            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(
                list(backbone.parameters()) + list(head.parameters()),
                GRADIENT_CLIP,
            )
            optimizer.step()
            scheduler.step()

            total_loss += loss.item()

            if (step + 1) % 50 == 0:
                logger.info(
                    "[%s] epoch=%d step=%d loss=%.4f",
                    task_name, epoch + 1, step + 1, loss.item(),
                )

        avg_loss = total_loss / max(len(dataloader), 1)
        elapsed  = time.time() - t0
        logger.info(
            "[%s] epoch=%d avg_loss=%.4f time=%.1fs",
            task_name, epoch + 1, avg_loss, elapsed,
        )

    backbone.eval()
    head.eval()


def _save_head(head, checkpoint_dir: Path, filename: str) -> None:
    """Save head state-dict to checkpoint directory."""
    import torch

    checkpoint_dir.mkdir(parents=True, exist_ok=True)
    path = checkpoint_dir / filename
    torch.save(head.state_dict(), str(path))
    logger.info("Checkpoint saved: %s", path)


def _save_backbone(backbone, checkpoint_dir: Path) -> None:
    """Save the fine-tuned backbone for later use or sharing."""
    out_dir = checkpoint_dir / "backbone"
    backbone.save_pretrained(str(out_dir))
    logger.info("Backbone saved: %s", out_dir)


# ==============================================================================
# Task 1: Emotion / Stance Fine-Tuning
# ==============================================================================

class EmotionStanceTrainer:
    """
    Fine-tunes MuRIL backbone + a linear emotion head for multi-label
    classification of: Anxiety | Anger | Support | Oppose.

    Loss: BCEWithLogitsLoss (sigmoid applied internally; no explicit sigmoid here).
    """

    def __init__(
        self,
        data_path: str,
        checkpoint_dir: str = "models_cache/muril_checkpoints",
        device: str = "cpu",
        hf_cache: str = "models_cache",
        epochs: int = DEFAULT_EPOCHS,
        batch_size: int = DEFAULT_BATCH_SIZE,
        lr: float = DEFAULT_LR,
        warmup_ratio: float = DEFAULT_WARMUP,
        freeze_backbone_epochs: int = 0,
    ):
        self.data_path            = data_path
        self.checkpoint_dir       = Path(checkpoint_dir)
        self.device_str           = device
        self.hf_cache             = hf_cache
        self.epochs               = epochs
        self.batch_size           = batch_size
        self.lr                   = lr
        self.warmup_ratio         = warmup_ratio
        self.freeze_backbone_eps  = freeze_backbone_epochs

    def train(self) -> None:
        """Run the full emotion/stance fine-tuning pipeline."""
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader
        from torch.optim import AdamW

        logger.info("=" * 60)
        logger.info("TASK 1: Emotion/Stance Fine-Tuning")
        logger.info("=" * 60)

        # 1. Load data
        texts, labels = load_emotion_csv(self.data_path)
        if not texts:
            raise ValueError(f"No samples found in {self.data_path}")

        # 2. Load backbone
        tokenizer, backbone, device, hidden_size = _load_backbone_and_tokenizer(
            self.device_str, self.hf_cache
        )

        # 3. Build dataset + dataloader
        dataset    = _make_emotion_dataset(tokenizer, texts, labels)
        dataloader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        # 4. Build head
        head = nn.Linear(hidden_size, len(EMOTION_LABELS)).to(device)

        # 5. Loss: multi-label binary cross-entropy
        loss_fn = nn.BCEWithLogitsLoss()

        # 6. Optimizer + scheduler
        total_steps  = len(dataloader) * self.epochs
        warmup_steps = int(total_steps * self.warmup_ratio)
        params = list(backbone.parameters()) + list(head.parameters())
        optimizer = AdamW(params, lr=self.lr, weight_decay=0.01)
        scheduler = _get_linear_schedule_with_warmup(optimizer, warmup_steps, total_steps)

        # 7. Optional: freeze backbone for first N epochs (head-only warm-up)
        if self.freeze_backbone_eps > 0:
            logger.info("Freezing backbone for first %d epochs", self.freeze_backbone_eps)
            for p in backbone.parameters():
                p.requires_grad = False

            # Train head only
            head_only_loader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)
            _train_loop(
                backbone, head, head_only_loader,
                optimizer, scheduler, loss_fn, device,
                epochs=self.freeze_backbone_eps,
                task_name="EmotionHead-warm-up",
            )

            # Unfreeze backbone for full fine-tuning
            for p in backbone.parameters():
                p.requires_grad = True
            remaining = self.epochs - self.freeze_backbone_eps
        else:
            remaining = self.epochs

        # 8. Full fine-tuning
        if remaining > 0:
            _train_loop(
                backbone, head, dataloader,
                optimizer, scheduler, loss_fn, device,
                epochs=remaining,
                task_name="EmotionStance",
            )

        # 9. Save checkpoints
        _save_head(head, self.checkpoint_dir, "emotion_head.pt")
        _save_backbone(backbone, self.checkpoint_dir)
        logger.info("Emotion/Stance training complete.")


# ==============================================================================
# Task 2: Contextual Sarcasm Fine-Tuning (Sentence-Pair)
# ==============================================================================

class SarcasmPairTrainer:
    """
    Fine-tunes MuRIL backbone + a binary sarcasm head using sentence-pair inputs.

    Input format: [CLS] parent_text [SEP] reply_text [SEP]
    This allows the model to detect contextual dissonance between the parent
    post and the reply — the key signal for sarcasm in social media threads.

    Loss: CrossEntropyLoss (binary: 0 = not sarcastic, 1 = sarcastic).
    """

    def __init__(
        self,
        data_path: str,
        checkpoint_dir: str = "models_cache/muril_checkpoints",
        device: str = "cpu",
        hf_cache: str = "models_cache",
        epochs: int = DEFAULT_EPOCHS,
        batch_size: int = DEFAULT_BATCH_SIZE,
        lr: float = DEFAULT_LR,
        warmup_ratio: float = DEFAULT_WARMUP,
        freeze_backbone_epochs: int = 0,
        pos_weight: float = 1.5,   # upweight sarcastic class (usually minority)
    ):
        self.data_path            = data_path
        self.checkpoint_dir       = Path(checkpoint_dir)
        self.device_str           = device
        self.hf_cache             = hf_cache
        self.epochs               = epochs
        self.batch_size           = batch_size
        self.lr                   = lr
        self.warmup_ratio         = warmup_ratio
        self.freeze_backbone_eps  = freeze_backbone_epochs
        self.pos_weight           = pos_weight

    def train(self) -> None:
        """Run the full sarcasm sentence-pair fine-tuning pipeline."""
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader
        from torch.optim import AdamW

        logger.info("=" * 60)
        logger.info("TASK 2: Sarcasm Sentence-Pair Fine-Tuning")
        logger.info("=" * 60)

        # 1. Load data
        parents, replies, labels = load_sarcasm_csv(self.data_path)
        if not replies:
            raise ValueError(f"No samples found in {self.data_path}")

        # 2. Load backbone
        tokenizer, backbone, device, hidden_size = _load_backbone_and_tokenizer(
            self.device_str, self.hf_cache
        )

        # 3. Dataset + dataloader
        dataset    = _make_sarcasm_dataset(tokenizer, parents, replies, labels)
        dataloader = DataLoader(dataset, batch_size=self.batch_size, shuffle=True)

        # 4. Binary classification head (2 output classes)
        head    = nn.Linear(hidden_size, 2).to(device)
        loss_fn = nn.CrossEntropyLoss()

        # 5. Optimizer + scheduler
        total_steps  = len(dataloader) * self.epochs
        warmup_steps = int(total_steps * self.warmup_ratio)
        params       = list(backbone.parameters()) + list(head.parameters())
        optimizer    = AdamW(params, lr=self.lr, weight_decay=0.01)
        scheduler    = _get_linear_schedule_with_warmup(optimizer, warmup_steps, total_steps)

        # 6. Optional backbone freeze for head warm-up
        if self.freeze_backbone_eps > 0:
            logger.info("Freezing backbone for first %d epochs", self.freeze_backbone_eps)
            for p in backbone.parameters():
                p.requires_grad = False
            _train_loop(
                backbone, head, dataloader,
                optimizer, scheduler, loss_fn, device,
                epochs=self.freeze_backbone_eps,
                task_name="SarcasmHead-warm-up",
            )
            for p in backbone.parameters():
                p.requires_grad = True
            remaining = self.epochs - self.freeze_backbone_eps
        else:
            remaining = self.epochs

        # 7. Full fine-tuning
        if remaining > 0:
            _train_loop(
                backbone, head, dataloader,
                optimizer, scheduler, loss_fn, device,
                epochs=remaining,
                task_name="SarcasmPair",
            )

        # 8. Save checkpoints
        _save_head(head, self.checkpoint_dir, "sarcasm_head.pt")
        _save_backbone(backbone, self.checkpoint_dir)
        logger.info("Sarcasm sentence-pair training complete.")


# ==============================================================================
# Evaluation helpers
# ==============================================================================

def evaluate_emotion(
    tokenizer,
    backbone,
    head,
    texts: List[str],
    labels: List[List[int]],
    device,
    threshold: float = 0.40,
) -> Dict[str, float]:
    """
    Compute multi-label evaluation metrics for the emotion/stance head.
    Returns: {exact_match, f1_macro, f1_per_label_*}
    """
    import torch
    from sklearn.metrics import f1_score

    backbone.eval()
    head.eval()

    all_preds, all_true = [], []

    with torch.no_grad():
        for i in range(0, len(texts), 32):
            batch_texts  = texts[i:i+32]
            batch_labels = labels[i:i+32]

            enc = tokenizer(
                batch_texts,
                max_length=MAX_SINGLE_LEN,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            )
            enc = {k: v.to(device) for k, v in enc.items()}
            out = backbone(**enc)
            cls = out.last_hidden_state[:, 0, :]
            logits = head(cls)
            probs  = torch.sigmoid(logits).cpu().numpy()
            preds  = (probs >= threshold).astype(int)

            all_preds.extend(preds.tolist())
            all_true.extend(batch_labels)

    import numpy as np
    y_true = np.array(all_true)
    y_pred = np.array(all_preds)

    exact_match = float(np.all(y_true == y_pred, axis=1).mean())
    f1_macro    = float(f1_score(y_true, y_pred, average="macro", zero_division=0))

    metrics = {"exact_match": exact_match, "f1_macro": f1_macro}
    for i, lbl in enumerate(EMOTION_LABELS):
        metrics[f"f1_{lbl.lower()}"] = float(
            f1_score(y_true[:, i], y_pred[:, i], zero_division=0)
        )

    return metrics


def evaluate_sarcasm(
    tokenizer,
    backbone,
    head,
    parents: List[str],
    replies: List[str],
    labels: List[int],
    device,
) -> Dict[str, float]:
    """
    Compute binary classification metrics for the sarcasm sentence-pair head.
    Returns: {accuracy, f1, precision, recall}
    """
    import torch
    import numpy as np
    from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

    backbone.eval()
    head.eval()

    all_preds, all_true = [], []

    with torch.no_grad():
        for i in range(0, len(replies), 32):
            b_parents = parents[i:i+32]
            b_replies = replies[i:i+32]
            b_labels  = labels[i:i+32]

            enc = tokenizer(
                b_parents, b_replies,
                max_length=MAX_PAIR_LEN,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            )
            enc = {k: v.to(device) for k, v in enc.items()}
            out = backbone(**enc)
            cls = out.last_hidden_state[:, 0, :]
            logits = head(cls)
            preds  = torch.argmax(logits, dim=-1).cpu().numpy()

            all_preds.extend(preds.tolist())
            all_true.extend(b_labels)

    y_true = np.array(all_true)
    y_pred = np.array(all_preds)

    return {
        "accuracy":  float(accuracy_score(y_true, y_pred)),
        "f1":        float(f1_score(y_true, y_pred, zero_division=0)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall":    float(recall_score(y_true, y_pred, zero_division=0)),
    }


# ==============================================================================
# Synthetic data generator (for testing without labelled data)
# ==============================================================================

def generate_synthetic_emotion_csv(output_path: str, n_samples: int = 500) -> None:
    """
    Generate a synthetic emotion/stance CSV for testing the training pipeline.
    NOT intended for production — use real annotated data in production.
    """
    import random, re as _re

    samples = [
        ("Yaar ye sab khatam kab hoga, bahut dar lag raha hai", [1,0,0,0]),
        ("I am so worried about what is happening in the country", [1,0,0,0]),
        ("Darr lag raha hai yaar, kuch bhi ho sakta hai", [1,0,0,0]),
        ("Ye sarkar bilkul ghatiya hai, furious hoon", [0,1,0,0]),
        ("Itna gussa aa raha hai inpe, kameene", [0,1,0,0]),
        ("I fully support this initiative by the government", [0,0,1,0]),
        ("Sahi kadam hai, hum saath hain", [0,0,1,0]),
        ("Bilkul galat hai ye decision, hum virodh karte hain", [0,0,0,1]),
        ("This policy should be opposed by everyone", [0,0,0,1]),
        ("Worried and scared about tomorrow's results", [1,0,0,0]),
        ("Great move by the administration, well done", [0,0,1,0]),
        ("Disgusting behaviour, how can they do this", [0,1,0,0]),
        ("We stand against this injustice", [0,0,0,1]),
        ("Panic ho raha hai yaar", [1,0,0,0]),
        ("Bahut acha hua, congratulations", [0,0,1,0]),
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text"] + EMOTION_LABELS)
        for _ in range(n_samples):
            text, label_vec = random.choice(samples)
            writer.writerow([text] + label_vec)

    logger.info("Synthetic emotion CSV generated: %s (%d samples)", output_path, n_samples)


def generate_synthetic_sarcasm_csv(output_path: str, n_samples: int = 400) -> None:
    """
    Generate a synthetic sarcasm sentence-pair CSV for testing.
    NOT intended for production.
    """
    import random

    sarcastic_pairs = [
        ("5 people killed in terror attack today", "Oh great, another wonderful day in our country!"),
        ("Floods destroy 1000 homes in Kerala", "Amazing work by the authorities, truly impressive"),
        ("Prices rise by 20% this month", "Wow, economy is doing SO well. Really proud"),
        ("Hospital strikes due to salary unpaid", "Such a brilliant healthcare system we have"),
        ("Earthquake kills dozens in remote area", "Lovely!! Everything is just perfect"),
    ]
    non_sarcastic_pairs = [
        ("New metro line launched in Delhi", "This is great news for commuters!"),
        ("School wins national science award", "Congratulations, well deserved"),
        ("Rain finally arrives in drought-hit regions", "Such a relief, farmers will benefit"),
        ("New hospital opens in rural area", "Wonderful news for the community"),
        ("Team India wins the series", "Amazing performance by the whole team"),
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["parent_text", "reply_text", "label"])
        for _ in range(n_samples):
            if random.random() < 0.5:
                p, r = random.choice(sarcastic_pairs)
                writer.writerow([p, r, 1])
            else:
                p, r = random.choice(non_sarcastic_pairs)
                writer.writerow([p, r, 0])

    logger.info("Synthetic sarcasm CSV generated: %s (%d samples)", output_path, n_samples)


# ==============================================================================
# CLI Entry Point
# ==============================================================================

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="MuRIL Fine-Tuner for Emotion/Stance and Sarcasm tasks"
    )
    parser.add_argument(
        "--task",
        choices=["emotion", "sarcasm", "both"],
        required=True,
        help="Which task to fine-tune: emotion | sarcasm | both",
    )
    parser.add_argument("--data",         type=str, help="Path to data CSV (for single task)")
    parser.add_argument("--emotion-data", type=str, help="Path to emotion/stance CSV (for --task both)")
    parser.add_argument("--sarcasm-data", type=str, help="Path to sarcasm pairs CSV (for --task both)")
    parser.add_argument("--checkpoint-dir", type=str, default="models_cache/muril_checkpoints")
    parser.add_argument("--hf-cache",    type=str, default="models_cache")
    parser.add_argument("--device",      type=str, default="cpu")
    parser.add_argument("--epochs",      type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch-size",  type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--lr",          type=float, default=DEFAULT_LR)
    parser.add_argument(
        "--generate-synthetic",
        action="store_true",
        help="Generate synthetic test data instead of training",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    if args.generate_synthetic:
        generate_synthetic_emotion_csv("synthetic_emotion.csv")
        generate_synthetic_sarcasm_csv("synthetic_sarcasm.csv")
        logger.info("Synthetic data generated. Use --data synthetic_emotion.csv / synthetic_sarcasm.csv")
        return

    kwargs = dict(
        checkpoint_dir=args.checkpoint_dir,
        device=args.device,
        hf_cache=args.hf_cache,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
    )

    if args.task in ("emotion", "both"):
        data = args.emotion_data or args.data
        if not data:
            raise ValueError("Provide --data or --emotion-data for emotion task")
        EmotionStanceTrainer(data_path=data, **kwargs).train()

    if args.task in ("sarcasm", "both"):
        data = args.sarcasm_data or args.data
        if not data:
            raise ValueError("Provide --data or --sarcasm-data for sarcasm task")
        SarcasmPairTrainer(data_path=data, **kwargs).train()


if __name__ == "__main__":
    main()
