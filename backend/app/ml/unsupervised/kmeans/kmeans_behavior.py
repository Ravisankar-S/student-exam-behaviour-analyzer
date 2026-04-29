from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import json
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


FEATURE_COLUMNS = [
    "avg_time",
    "time_variance",
    "revision_count",
    "navigation_count",
    "accuracy",
    "rte_score",
]

DEFAULT_ARTIFACT_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "kmeans"


@dataclass
class ArtifactPaths:
    model_path: Path
    scaler_path: Path
    cluster_map_path: Path
    metadata_path: Path

    @classmethod
    def from_dir(cls, artifact_dir: str | Path) -> "ArtifactPaths":
        root = Path(artifact_dir)
        return cls(
            model_path=root / "kmeans_model.pkl",
            scaler_path=root / "scaler.pkl",
            cluster_map_path=root / "cluster_map.json",
            metadata_path=root / "metadata.json",
        )


def _validate_feature_columns(df: pd.DataFrame) -> None:
    missing = [column for column in FEATURE_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required feature columns: {missing}")


def _build_cluster_map(df: pd.DataFrame, clusters: np.ndarray, label_column: str) -> dict[int, str]:
    if label_column in df.columns:
        work = df[[label_column]].copy()
        work["cluster"] = clusters
        mapping: dict[int, str] = {}
        for cluster_id in sorted(work["cluster"].unique()):
            top_label = (
                work[work["cluster"] == cluster_id][label_column]
                .astype(str)
                .value_counts()
                .index[0]
            )
            mapping[int(cluster_id)] = str(top_label)
        return mapping

    return {int(cluster_id): f"Cluster_{int(cluster_id)}" for cluster_id in sorted(np.unique(clusters))}


def train_kmeans_from_dataframe(
    df: pd.DataFrame,
    n_clusters: int = 4,
    random_state: int = 42,
    label_column: str = "behavioural_label",
) -> dict[str, Any]:
    _validate_feature_columns(df)

    x = df[FEATURE_COLUMNS].astype(float)
    scaler = StandardScaler()
    x_scaled = scaler.fit_transform(x)

    kmeans = KMeans(n_clusters=n_clusters, random_state=random_state, n_init="auto")
    clusters = kmeans.fit_predict(x_scaled)

    silhouette = None
    if len(df) > n_clusters and n_clusters > 1:
        silhouette = float(silhouette_score(x_scaled, clusters))

    cluster_map = _build_cluster_map(df, clusters, label_column)

    enriched = df.copy()
    enriched["cluster"] = clusters

    return {
        "kmeans": kmeans,
        "scaler": scaler,
        "cluster_map": cluster_map,
        "train_frame": enriched,
        "metrics": {
            "rows": int(len(df)),
            "n_clusters": int(n_clusters),
            "inertia": float(kmeans.inertia_),
            "silhouette_score": silhouette,
        },
    }


def save_artifacts(
    kmeans: KMeans,
    scaler: StandardScaler,
    cluster_map: dict[int, str],
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
    metadata: dict[str, Any] | None = None,
) -> ArtifactPaths:
    paths = ArtifactPaths.from_dir(artifact_dir)
    paths.model_path.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(kmeans, paths.model_path)
    joblib.dump(scaler, paths.scaler_path)

    with paths.cluster_map_path.open("w", encoding="utf-8") as handle:
        json.dump({str(k): v for k, v in cluster_map.items()}, handle, indent=2)

    payload = metadata or {}
    with paths.metadata_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)

    return paths


def load_artifacts(artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR) -> dict[str, Any]:
    paths = ArtifactPaths.from_dir(artifact_dir)

    if not paths.model_path.exists() or not paths.scaler_path.exists() or not paths.cluster_map_path.exists():
        raise FileNotFoundError(
            "Model artifacts not found. Train first with app/ml/unsupervised/kmeans/train_kmeans_model.py"
        )

    kmeans: KMeans = joblib.load(paths.model_path)
    scaler: StandardScaler = joblib.load(paths.scaler_path)

    with paths.cluster_map_path.open("r", encoding="utf-8") as handle:
        cluster_map_raw = json.load(handle)

    cluster_map = {int(key): str(value) for key, value in cluster_map_raw.items()}
    return {
        "kmeans": kmeans,
        "scaler": scaler,
        "cluster_map": cluster_map,
        "paths": paths,
    }


def predict_from_dataframe(df: pd.DataFrame, artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR) -> pd.DataFrame:
    _validate_feature_columns(df)
    loaded = load_artifacts(artifact_dir)

    kmeans: KMeans = loaded["kmeans"]
    scaler: StandardScaler = loaded["scaler"]
    cluster_map: dict[int, str] = loaded["cluster_map"]

    x = df[FEATURE_COLUMNS].astype(float)
    x_scaled = scaler.transform(x)

    clusters = kmeans.predict(x_scaled)
    min_distances = kmeans.transform(x_scaled).min(axis=1)

    predicted = df.copy()
    predicted["predicted_cluster"] = clusters
    predicted["interpreted_behavior"] = [cluster_map.get(int(cluster_id), "Unknown") for cluster_id in clusters]
    predicted["min_distance"] = min_distances
    return predicted


def predict_single_feature_row(
    feature_row: dict[str, float],
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
) -> dict[str, Any]:
    frame = pd.DataFrame([feature_row])
    predicted = predict_from_dataframe(frame, artifact_dir=artifact_dir).iloc[0]
    return {
        "predicted_cluster": int(predicted["predicted_cluster"]),
        "interpreted_behavior": str(predicted["interpreted_behavior"]),
        "min_distance": float(predicted["min_distance"]),
    }
