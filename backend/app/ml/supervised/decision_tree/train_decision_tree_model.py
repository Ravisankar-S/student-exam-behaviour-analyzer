from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from app.ml.supervised.decision_tree.decision_tree_behavior import (
    DEFAULT_ARTIFACT_DIR,
    DEFAULT_TARGET_COLUMN,
    FEATURE_COLUMNS,
    predict_from_dataframe,
    save_artifacts,
    train_decision_tree_from_dataframe,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and save Decision Tree behavior model artifacts")
    parser.add_argument("--csv-path", required=True, help="Path to training CSV")
    parser.add_argument("--artifact-dir", default=str(DEFAULT_ARTIFACT_DIR), help="Output directory for model artifacts")
    parser.add_argument("--target-column", default=DEFAULT_TARGET_COLUMN, help="Target label column")
    parser.add_argument("--test-size", type=float, default=0.2, help="Holdout split ratio for test evaluation")
    parser.add_argument("--random-state", type=int, default=42, help="Random seed")
    parser.add_argument("--cv-splits", type=int, default=5, help="Stratified CV folds")
    parser.add_argument("--scoring", default="accuracy", help="Grid-search scoring metric")
    parser.add_argument("--save-evaluated-csv", default=None, help="Optional path to save source rows with model predictions")
    args = parser.parse_args()

    csv_path = Path(args.csv_path)
    if not csv_path.exists():
        raise FileNotFoundError(f"Training CSV not found: {csv_path}")

    df = pd.read_csv(csv_path)

    result = train_decision_tree_from_dataframe(
        df=df,
        target_column=args.target_column,
        test_size=args.test_size,
        random_state=args.random_state,
        cv_splits=max(2, args.cv_splits),
        scoring=args.scoring,
    )

    metrics = result["metrics"]
    metadata = {
        "feature_columns": FEATURE_COLUMNS,
        "target_column": args.target_column,
        "metrics": metrics,
        "training_csv": str(csv_path),
        "label_mapping": {str(key): value for key, value in result["label_mapping"].items()},
    }

    paths = save_artifacts(
        model=result["model"],
        label_encoder=result["label_encoder"],
        artifact_dir=args.artifact_dir,
        metadata=metadata,
    )

    print("Training complete.")
    print(f"Rows: {metrics['rows']}")
    print(f"Train/Test rows: {metrics['train_rows']}/{metrics['test_rows']}")
    print(f"Classes: {metrics['n_classes']}")
    print(f"Test Accuracy: {metrics['test_accuracy']:.4f}")
    print(f"Best CV Accuracy: {metrics['best_cv_accuracy']}")
    print(f"CV Mean/Std: {metrics['cv_mean_accuracy']} / {metrics['cv_std_accuracy']}")
    print(f"Tree depth: {metrics['tree_depth']}")
    print(f"Leaf nodes: {metrics['n_leaves']}")
    print(f"Best params: {metrics['best_params']}")
    print(f"Model saved: {paths.model_path}")
    print(f"Label encoder saved: {paths.label_encoder_path}")
    print(f"Metadata saved: {paths.metadata_path}")

    if args.save_evaluated_csv:
        output_path = Path(args.save_evaluated_csv)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        evaluated = predict_from_dataframe(df, artifact_dir=args.artifact_dir)
        evaluated.to_csv(output_path, index=False)
        print(f"\nEvaluated training CSV saved: {output_path}")


if __name__ == "__main__":
    main()
