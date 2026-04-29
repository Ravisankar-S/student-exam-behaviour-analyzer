from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier


FEATURE_COLUMNS = [
    "avg_time",
    "time_variance",
    "revision_count",
    "wr_ratio",
    "rw_ratio",
    "navigation_count",
    "rte_score",
    "accuracy",
]

DEFAULT_TARGET_COLUMN = "behavioural_label"
DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "decision_tree"

DEFAULT_PARAM_GRID = {
    "max_depth": [3, 4, 5, 6, 7, 8, None],
    "min_samples_leaf": [1, 2, 3, 5, 8, 10],
    "criterion": ["gini", "entropy"],
    "class_weight": [None, "balanced"],
}


@dataclass
class ArtifactPaths:
    model_path: Path
    label_encoder_path: Path
    metadata_path: Path

    @classmethod
    def from_dir(cls, artifact_dir: str | Path) -> "ArtifactPaths":
        root = Path(artifact_dir)
        return cls(
            model_path=root / "decision_tree_model.pkl",
            label_encoder_path=root / "label_encoder.pkl",
            metadata_path=root / "metadata.json",
        )


def _validate_feature_columns(df: pd.DataFrame) -> None:
    missing = [column for column in FEATURE_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required feature columns: {missing}")


def _validate_training_columns(df: pd.DataFrame, target_column: str) -> None:
    _validate_feature_columns(df)
    if target_column not in df.columns:
        raise ValueError(f"Missing target column: {target_column}")


def _n_splits_for_stratified_cv(y_encoded: np.ndarray, requested_splits: int) -> int:
    if requested_splits < 2:
        return 0
    counts = np.bincount(y_encoded)
    counts = counts[counts > 0]
    if len(counts) < 2:
        return 0
    min_class_count = int(counts.min())
    if min_class_count < 2:
        return 0
    return min(int(requested_splits), min_class_count)


def _label_mapping(label_encoder: LabelEncoder) -> dict[int, str]:
    return {
        int(index): str(label)
        for index, label in enumerate(label_encoder.classes_)
    }


def train_decision_tree_from_dataframe(
    df: pd.DataFrame,
    target_column: str = DEFAULT_TARGET_COLUMN,
    test_size: float = 0.2,
    random_state: int = 42,
    cv_splits: int = 5,
    scoring: str = "accuracy",
    param_grid: dict[str, list[Any]] | None = None,
) -> dict[str, Any]:
    _validate_training_columns(df, target_column)

    x = df[FEATURE_COLUMNS].astype(float)
    y_raw = df[target_column].astype(str)

    label_encoder = LabelEncoder()
    y_encoded = np.asarray(label_encoder.fit_transform(y_raw), dtype=int)

    if len(label_encoder.classes_) < 2:
        raise ValueError("Decision Tree training requires at least 2 target classes")

    stratify_labels = y_encoded if y_raw.value_counts().min() >= 2 else None

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y_encoded,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify_labels,
    )

    model = DecisionTreeClassifier(random_state=random_state)
    fit_cv_splits = _n_splits_for_stratified_cv(y_train, cv_splits)
    best_cv_accuracy = None
    best_params = None

    if fit_cv_splits >= 2:
        cv = StratifiedKFold(n_splits=fit_cv_splits, shuffle=True, random_state=random_state)
        search = GridSearchCV(
            estimator=model,
            param_grid=param_grid or DEFAULT_PARAM_GRID,
            cv=cv,
            scoring=scoring,
            n_jobs=-1,
            verbose=0,
        )
        search.fit(x_train, y_train)
        model = search.best_estimator_
        best_cv_accuracy = float(search.best_score_)
        best_params = search.best_params_
    else:
        model.fit(x_train, y_train)

    y_test_pred = model.predict(x_test)
    test_accuracy = float((y_test_pred == y_test).mean())

    full_cv_scores: list[float] = []
    eval_cv_splits = _n_splits_for_stratified_cv(y_encoded, cv_splits)
    if eval_cv_splits >= 2:
        eval_cv = StratifiedKFold(n_splits=eval_cv_splits, shuffle=True, random_state=random_state)
        for train_idx, val_idx in eval_cv.split(x, y_encoded):
            eval_model = DecisionTreeClassifier(random_state=random_state, **(best_params or {}))
            eval_model.fit(x.iloc[train_idx], y_encoded[train_idx])
            score = float(eval_model.score(x.iloc[val_idx], y_encoded[val_idx]))
            full_cv_scores.append(score)

    return {
        "model": model,
        "label_encoder": label_encoder,
        "metrics": {
            "rows": int(len(df)),
            "train_rows": int(len(x_train)),
            "test_rows": int(len(x_test)),
            "n_classes": int(len(label_encoder.classes_)),
            "test_accuracy": test_accuracy,
            "best_cv_accuracy": best_cv_accuracy,
            "cv_scores": full_cv_scores,
            "cv_mean_accuracy": float(np.mean(full_cv_scores)) if full_cv_scores else None,
            "cv_std_accuracy": float(np.std(full_cv_scores)) if full_cv_scores else None,
            "tree_depth": int(model.get_depth()),
            "n_leaves": int(model.get_n_leaves()),
            "best_params": best_params,
            "stratified_split": stratify_labels is not None,
        },
        "label_mapping": _label_mapping(label_encoder),
    }


def save_artifacts(
    model: DecisionTreeClassifier,
    label_encoder: LabelEncoder,
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
    metadata: dict[str, Any] | None = None,
) -> ArtifactPaths:
    paths = ArtifactPaths.from_dir(artifact_dir)
    paths.model_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, paths.model_path)
    joblib.dump(label_encoder, paths.label_encoder_path)

    payload = metadata or {}
    payload.setdefault("feature_columns", FEATURE_COLUMNS)
    payload.setdefault("label_mapping", {str(k): v for k, v in _label_mapping(label_encoder).items()})

    with paths.metadata_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    return paths


def load_artifacts(artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR) -> dict[str, Any]:
    paths = ArtifactPaths.from_dir(artifact_dir)

    if not paths.model_path.exists() or not paths.label_encoder_path.exists():
        raise FileNotFoundError(
            "Decision Tree artifacts not found. Train first with app/ml/supervised/decision_tree/train_decision_tree_model.py"
        )

    model: DecisionTreeClassifier = joblib.load(paths.model_path)
    label_encoder: LabelEncoder = joblib.load(paths.label_encoder_path)

    metadata: dict[str, Any] = {}
    if paths.metadata_path.exists():
        with paths.metadata_path.open("r", encoding="utf-8") as handle:
            metadata = json.load(handle)

    mapping_raw = metadata.get("label_mapping") if isinstance(metadata, dict) else None
    if isinstance(mapping_raw, dict) and mapping_raw:
        label_mapping = {int(key): str(value) for key, value in mapping_raw.items()}
    else:
        label_mapping = _label_mapping(label_encoder)

    return {
        "model": model,
        "label_encoder": label_encoder,
        "label_mapping": label_mapping,
        "metadata": metadata,
        "paths": paths,
    }


def predict_from_dataframe(df: pd.DataFrame, artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR) -> pd.DataFrame:
    _validate_feature_columns(df)

    loaded = load_artifacts(artifact_dir)
    model: DecisionTreeClassifier = loaded["model"]
    label_encoder: LabelEncoder = loaded["label_encoder"]

    x = df[FEATURE_COLUMNS].astype(float)
    class_ids = np.asarray(model.predict(x), dtype=int)
    labels = label_encoder.inverse_transform(class_ids.astype(int))

    predicted = df.copy()
    predicted["predicted_label"] = labels
    predicted["predicted_class_id"] = class_ids.astype(int)

    if hasattr(model, "predict_proba"):
        probabilities = np.asarray(model.predict_proba(x), dtype=float)
        predicted["confidence"] = probabilities.max(axis=1)

    return predicted


def predict_single_feature_row(
    feature_row: dict[str, float],
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
) -> dict[str, Any]:
    frame = pd.DataFrame([feature_row])
    predicted = predict_from_dataframe(frame, artifact_dir=artifact_dir).iloc[0]

    result = {
        "predicted_label": str(predicted["predicted_label"]),
        "predicted_class_id": int(predicted["predicted_class_id"]),
    }
    if "confidence" in predicted:
        result["confidence"] = float(predicted["confidence"])
    return result
