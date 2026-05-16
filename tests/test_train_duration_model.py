"""
Tests for pipeline/train_duration_model.py.
All offline — mock DataFrame, tmp_path for model output.
"""
import os
import pytest
import pandas as pd
import numpy as np

from pipeline.train_duration_model import train, predict_duration, load_model

# ── helpers ───────────────────────────────────────────────────────────────────

def _make_df(n: int = 20, seed: int = 42) -> pd.DataFrame:
    """Synthetic outage_history DataFrame."""
    rng = np.random.default_rng(seed)
    return pd.DataFrame({
        "id":               range(n),
        "event_id":         [f"evt-{i:03d}" for i in range(n)],
        "region":           rng.choice(["maracaibo", "caracas", "valencia"], n),
        "outage_type":      rng.choice(["rationing", "transmission_fault", None], n),
        "started_at":       ["2026-05-01T12:00:00Z"] * n,
        "ended_at":         ["2026-05-01T16:00:00Z"] * n,
        "duration_min":     rng.integers(60, 360, n).astype(float),
        "day_of_week":      rng.integers(0, 7, n),
        "hour_started":     rng.integers(8, 20, n),
        "crowd_reports":    rng.integers(3, 50, n),
        "predicted_dur":    [None] * n,
        "prediction_error": [None] * n,
        # extra fields from outage_history schema
        "temperature_c":    rng.uniform(25, 38, n),
        "humidity_pct":     rng.uniform(40, 95, n),
        "inet_drop_depth":  rng.uniform(0, 1, n),
        "season":           rng.choice(["dry", "wet"], n),
    })


# ── train ─────────────────────────────────────────────────────────────────────

class TestTrain:
    def test_returns_fitted_model(self, tmp_path):
        df = _make_df(20)
        model = train(df, model_dir=str(tmp_path))
        assert model is not None

    def test_saves_model_pkl(self, tmp_path):
        train(_make_df(20), model_dir=str(tmp_path))
        assert os.path.exists(tmp_path / "duration_model.pkl")

    def test_saves_feature_cols_pkl(self, tmp_path):
        train(_make_df(20), model_dir=str(tmp_path))
        assert os.path.exists(tmp_path / "duration_features.pkl")

    def test_model_can_predict(self, tmp_path):
        df = _make_df(20)
        model = train(df, model_dir=str(tmp_path))
        # Must produce a finite float
        import joblib
        feature_cols = joblib.load(tmp_path / "duration_features.pkl")
        row = df.head(1).copy()
        row = pd.get_dummies(row, columns=["region", "outage_type", "season"])
        row = row.reindex(columns=feature_cols, fill_value=0)
        pred = model.predict(row)
        assert len(pred) == 1
        assert np.isfinite(pred[0])

    def test_mae_logged(self, tmp_path, caplog):
        import logging
        with caplog.at_level(logging.INFO, logger="pipeline.train_duration_model"):
            train(_make_df(20), model_dir=str(tmp_path))
        assert any("MAE" in r.message for r in caplog.records)

    def test_categorical_encoding_applied(self, tmp_path):
        import joblib
        train(_make_df(20), model_dir=str(tmp_path))
        feature_cols = joblib.load(tmp_path / "duration_features.pkl")
        # get_dummies on region → region_maracaibo etc. present
        assert any(c.startswith("region_") for c in feature_cols)

    def test_non_feature_cols_excluded(self, tmp_path):
        import joblib
        train(_make_df(20), model_dir=str(tmp_path))
        feature_cols = joblib.load(tmp_path / "duration_features.pkl")
        excluded = {"id", "event_id", "started_at", "ended_at", "duration_min",
                    "predicted_dur", "prediction_error", "crowd_reports"}
        for col in excluded:
            assert col not in feature_cols, f"{col} should be excluded from features"

    def test_sparse_data_no_crash(self, tmp_path):
        # 6 rows — CV folds auto-reduced
        train(_make_df(6), model_dir=str(tmp_path))
        assert os.path.exists(tmp_path / "duration_model.pkl")

    def test_null_outage_type_handled(self, tmp_path):
        df = _make_df(20)
        df["outage_type"] = None  # all null
        train(df, model_dir=str(tmp_path))
        assert os.path.exists(tmp_path / "duration_model.pkl")


# ── load_model ────────────────────────────────────────────────────────────────

class TestLoadModel:
    def test_returns_model_and_feature_cols(self, tmp_path):
        train(_make_df(20), model_dir=str(tmp_path))
        model, feature_cols = load_model(str(tmp_path))
        assert model is not None
        assert isinstance(feature_cols, list)
        assert len(feature_cols) > 0

    def test_missing_model_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_model(str(tmp_path))


# ── predict_duration ──────────────────────────────────────────────────────────

class TestPredictDuration:
    def _setup(self, tmp_path):
        train(_make_df(20), model_dir=str(tmp_path))
        return load_model(str(tmp_path))

    def test_returns_positive_float(self, tmp_path):
        model, feature_cols = self._setup(tmp_path)
        result = predict_duration(
            model, feature_cols,
            region="maracaibo",
            outage_type="rationing",
            season="dry",
            hour_started=14,
            day_of_week=1,
            temperature_c=35.0,
            humidity_pct=70.0,
            inet_drop_depth=0.3,
        )
        assert isinstance(result, float)
        assert result > 0

    def test_unknown_region_handled(self, tmp_path):
        model, feature_cols = self._setup(tmp_path)
        # Region not seen in training → reindex fills 0, still predicts
        result = predict_duration(
            model, feature_cols,
            region="zzz_unknown",
            outage_type="rationing",
            season="dry",
            hour_started=14,
            day_of_week=1,
            temperature_c=35.0,
            humidity_pct=70.0,
            inet_drop_depth=0.3,
        )
        assert isinstance(result, float)
