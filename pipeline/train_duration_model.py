"""
Duration model training — XGBoost weekly retrain on outage_history.

Run standalone (weekly cron) or import train() for tests.
Produces: models/duration_model.pkl, models/duration_features.pkl

prediction_score in status.json becomes non-null after first successful train.
"""
import logging
import os

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import cross_val_score
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)

_NON_FEATURE_COLS = frozenset({
    "id", "event_id", "started_at", "ended_at", "duration_min",
    "predicted_dur", "prediction_error", "crowd_reports",
})


def train(
    df: pd.DataFrame,
    model_dir: str = "models",
    n_estimators: int = 200,
    max_depth: int = 6,
    learning_rate: float = 0.05,
) -> XGBRegressor:
    """
    Fit XGBRegressor on outage_history DataFrame.
    Saves model + feature cols to model_dir.
    Returns fitted model.
    """
    # Encode categoricals
    df = df.copy()
    cat_cols = [c for c in ["region", "outage_type", "season"] if c in df.columns]
    df = pd.get_dummies(df, columns=cat_cols)

    feature_cols = [c for c in df.columns if c not in _NON_FEATURE_COLS]
    X = df[feature_cols].fillna(0)
    y = df["duration_min"]

    model = XGBRegressor(
        n_estimators=n_estimators,
        max_depth=max_depth,
        learning_rate=learning_rate,
        objective="reg:squarederror",
        verbosity=0,
    )

    cv_folds = min(5, len(df))
    if cv_folds >= 2:
        scores = cross_val_score(
            model, X, y, cv=cv_folds, scoring="neg_mean_absolute_error"
        )
        mae_mean = -scores.mean()
        mae_std  = scores.std()
        logger.info("MAE: %.1f +/- %.1f minutes (cv=%d)", mae_mean, mae_std, cv_folds)
    else:
        logger.info("MAE: skipped — too few samples (%d)", len(df))

    model.fit(X, y)

    os.makedirs(model_dir, exist_ok=True)
    joblib.dump(model,        os.path.join(model_dir, "duration_model.pkl"))
    joblib.dump(feature_cols, os.path.join(model_dir, "duration_features.pkl"))
    logger.info("model saved to %s/duration_model.pkl (%d features)", model_dir, len(feature_cols))

    return model


def load_model(model_dir: str = "models") -> tuple[XGBRegressor, list[str]]:
    """Load (model, feature_cols) from disk. Raises FileNotFoundError if missing."""
    model_path    = os.path.join(model_dir, "duration_model.pkl")
    features_path = os.path.join(model_dir, "duration_features.pkl")

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"No trained model at {model_path}. Run train() first.")

    model        = joblib.load(model_path)
    feature_cols = joblib.load(features_path)
    return model, feature_cols


def predict_duration(
    model: XGBRegressor,
    feature_cols: list[str],
    region: str,
    outage_type: str | None,
    season: str,
    hour_started: int,
    day_of_week: int,
    temperature_c: float,
    humidity_pct: float,
    inet_drop_depth: float,
) -> float:
    """
    Predict outage duration (minutes) for a new event.
    Unknown categories resolve to 0 via reindex fill.
    """
    row = pd.DataFrame([{
        "hour_started":   hour_started,
        "day_of_week":    day_of_week,
        "temperature_c":  temperature_c,
        "humidity_pct":   humidity_pct,
        "inet_drop_depth": inet_drop_depth,
        "region":         region,
        "outage_type":    outage_type or "unknown",
        "season":         season,
    }])
    row = pd.get_dummies(row, columns=["region", "outage_type", "season"])
    row = row.reindex(columns=feature_cols, fill_value=0)

    pred = model.predict(row)
    return float(max(pred[0], 1.0))


def main() -> None:
    """Entry point for weekly cron — reads from Supabase, trains, saves."""
    import os
    from supabase import create_client

    client = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    result = client.table("outage_history").select("*").execute()
    df = pd.DataFrame(result.data or [])

    if len(df) < 10:
        logger.warning("only %d outage_history rows — skipping retrain", len(df))
        return

    train(df)
    logger.info("duration model retrain complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    main()
