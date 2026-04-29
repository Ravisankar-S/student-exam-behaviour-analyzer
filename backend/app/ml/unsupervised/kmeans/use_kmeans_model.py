from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

from app.ml.unsupervised.kmeans.kmeans_behavior import DEFAULT_ARTIFACT_DIR, predict_from_dataframe


def main() -> None:
    parser = argparse.ArgumentParser(description="Run predictions using saved KMeans behavior artifacts")
    parser.add_argument("--input-csv", required=True, help="Input CSV containing feature columns")
    parser.add_argument("--artifact-dir", default=str(DEFAULT_ARTIFACT_DIR), help="Directory where model artifacts are stored")
    parser.add_argument("--output-csv", default=None, help="Optional output CSV path for predictions")
    args = parser.parse_args()

    input_path = Path(args.input_csv)
    if not input_path.exists():
        raise FileNotFoundError(f"Input CSV not found: {input_path}")

    df = pd.read_csv(input_path)
    predicted = predict_from_dataframe(df, artifact_dir=args.artifact_dir)

    print("Prediction complete.")
    print(f"Rows scored: {len(predicted)}")
    print("\nPredicted cluster counts:")
    print(predicted["predicted_cluster"].value_counts().sort_index().to_string())

    print("\nPreview:")
    print(predicted.head(10).to_string(index=False))

    if args.output_csv:
        output_path = Path(args.output_csv)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        predicted.to_csv(output_path, index=False)
        print(f"\nPredictions saved: {output_path}")


if __name__ == "__main__":
    main()
