from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from app.ml.unsupervised.kmeans.kmeans_behavior import (
    DEFAULT_ARTIFACT_DIR,
    FEATURE_COLUMNS,
    save_artifacts,
    train_kmeans_from_dataframe,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and save KMeans behavior model artifacts")
    parser.add_argument("--csv-path", required=True, help="Path to training CSV")
    parser.add_argument("--artifact-dir", default=str(DEFAULT_ARTIFACT_DIR), help="Output directory for model artifacts")
    parser.add_argument("--n-clusters", type=int, default=4, help="Number of KMeans clusters")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed for KMeans")
    parser.add_argument("--label-column", default="behavioural_label", help="Optional label column for cluster interpretation")
    parser.add_argument("--save-clustered-csv", default=None, help="Optional path to save training rows with assigned cluster")
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"Training CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)
    result = train_kmeans_from_dataframe(
        df=df,
        n_clusters=max(2, args.n_clusters),
        random_state=args.random_state,
        label_column=args.label_column,
    )

    metrics = result["metrics"]
    train_frame: pd.DataFrame = result["train_frame"]

    metadata = {
        "feature_columns": FEATURE_COLUMNS,
        "metrics": metrics,
        "label_column": args.label_column,
        "training_csv": str(csv_path),
    }
    paths = save_artifacts(
        kmeans=result["kmeans"],
        scaler=result["scaler"],
        cluster_map=result["cluster_map"],
        artifact_dir=args.artifact_dir,
        metadata=metadata,
    )

    print("Training complete.")
    print(f"Rows: {metrics['rows']}")
    print(f"Clusters: {metrics['n_clusters']}")
    print(f"Inertia: {metrics['inertia']:.4f}")
    print(f"Silhouette: {metrics['silhouette_score']}")
    print(f"Model saved: {paths.model_path}")
    print(f"Scaler saved: {paths.scaler_path}")
    print(f"Cluster map saved: {paths.cluster_map_path}")

    summary = train_frame.groupby("cluster")[FEATURE_COLUMNS].mean().round(4)
    print("\nCluster feature summary:")
    print(summary.to_string())

    if args.label_column in train_frame.columns:
        print("\nCluster x label crosstab:")
        print(pd.crosstab(train_frame["cluster"], train_frame[args.label_column]).to_string())

    if args.save_clustered_csv:
        output_path = Path(args.save_clustered_csv)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        train_frame.to_csv(output_path, index=False)
        print(f"\nClustered training CSV saved: {output_path}")


if __name__ == "__main__":
    main()
