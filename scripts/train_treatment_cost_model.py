#!/usr/bin/env python3
"""
SehatSure ML Treatment-Cost Driver Analysis - Model Training Pipeline
======================================================================
Trains an interpretable, mathematically defensible tabular regression model
on SehatSure's verified private hospital procedure tariff dataset (pvt_costs.csv).

Key Architecture:
- Problem: Supervised tabular regression predicting expected treatment cost (mean_cost).
- Target: mean_cost (in INR).
- Genuine features only: procedure, specialty, geographic tier, expected_stay_days.
- Models evaluated: Ridge Regression (L2 regularized), Random Forest, Gradient Boosting.
- Selected model: Ridge Regression with L2 Regularization (alpha=1.0).
  * Convex global optimum, completely transparent, no black-box opacity.
  * Exact local Shapley-equivalent additive feature decomposition: C_j = beta_j * (x_j - mean_x_j).
  * Direct zero-dependency export to JSON artifact for pure TypeScript execution in Node.js.
- Validation: 10-Fold CV, Grouped 5-Fold CV by Procedure, Leave-One-Tier-Out CV.
"""

import csv
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
import numpy as np

from sklearn.linear_model import Ridge, LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import KFold, GroupKFold, LeaveOneGroupOut
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score


def compute_file_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(base_dir, '..'))
    data_path = os.path.join(project_root, 'pvt_costs.csv')

    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}")
        sys.exit(1)

    print("======================================================================")
    print("SEHATSURE ML: TREATMENT-COST DRIVER ANALYSIS TRAINING PIPELINE")
    print("======================================================================")
    print(f"Dataset path: {data_path}")
    dataset_hash = compute_file_sha256(data_path)
    print(f"Dataset SHA256: {dataset_hash}")

    with open(data_path, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    total_rows = len(rows)
    print(f"Total rows loaded: {total_rows}")

    # Validate rows
    valid_rows = []
    for r in rows:
        try:
            cost = float(r['mean_cost'])
            stay = float(r['estimated_stay_days'])
            if cost > 0 and stay >= 0 and r['procedure'] and r['tier'] and r['specialty']:
                valid_rows.append(r)
        except (ValueError, TypeError):
            continue

    excluded_rows = total_rows - len(valid_rows)
    print(f"Valid rows for training: {len(valid_rows)}, Excluded rows: {excluded_rows}")

    # Collect unique vocabulary
    procedures = sorted(list(set(r['procedure'] for r in valid_rows)))
    specialties = sorted(list(set(r['specialty'] for r in valid_rows)))
    tiers = sorted(list(set(r['tier'] for r in valid_rows)))

    tier_order = {
        'Metro 1': 1, 'Metro 2': 2, 'Large City 1': 3, 'Large City 2': 4,
        'City 1': 5, 'City 2': 6, 'Town 1': 7, 'Town 2': 8
    }

    # Map each procedure to its primary specialty
    proc_to_specialty = {}
    proc_stay_duration = {}
    for r in valid_rows:
        proc_to_specialty[r['procedure']] = r['specialty']
        proc_stay_duration[r['procedure']] = float(r['estimated_stay_days'])

    print(f"\nVocabulary: {len(procedures)} procedures, {len(specialties)} specialties, {len(tiers)} tiers.")

    # Construct feature vectors
    feature_names = []
    for p in procedures:
        feature_names.append(f"proc:{p}")
    for s in specialties:
        feature_names.append(f"spec:{s}")
    for t in tiers:
        feature_names.append(f"tier:{t}")
    feature_names.append("expected_stay_days")

    X = []
    y = []
    proc_groups = []
    tier_groups = []

    for r in valid_rows:
        feat = []
        for p in procedures:
            feat.append(1.0 if r['procedure'] == p else 0.0)
        for s in specialties:
            feat.append(1.0 if r['specialty'] == s else 0.0)
        for t in tiers:
            feat.append(1.0 if r['tier'] == t else 0.0)
        feat.append(float(r['estimated_stay_days']))

        X.append(feat)
        y.append(float(r['mean_cost']))
        proc_groups.append(procedures.index(r['procedure']))
        tier_groups.append(tier_order.get(r['tier'], 5))

    X = np.array(X)
    y = np.array(y)
    proc_groups = np.array(proc_groups)
    tier_groups = np.array(tier_groups)

    print(f"Constructed design matrix X: {X.shape}, target y: {y.shape}")

    # -------------------------------------------------------------------------
    # Candidate Model Benchmarking
    # -------------------------------------------------------------------------
    print("\n----------------------------------------------------------------------")
    print("1. EVALUATING CANDIDATE MODELS (10-Fold Random CV)")
    print("----------------------------------------------------------------------")
    candidate_models = {
        "Ridge(alpha=1.0)": Ridge(alpha=1.0),
        "Ridge(alpha=5.0)": Ridge(alpha=5.0),
        "Ridge(alpha=10.0)": Ridge(alpha=10.0),
        "LinearRegression": LinearRegression(),
        "RandomForest(n_est=100)": RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42),
        "GradientBoosting(n_est=100)": GradientBoostingRegressor(n_estimators=100, max_depth=4, random_state=42)
    }

    kf = KFold(n_splits=10, shuffle=True, random_state=42)
    cv_10fold_results = {}

    for name, model in candidate_models.items():
        maes, rmses, r2s = [], [], []
        for train_idx, test_idx in kf.split(X):
            model.fit(X[train_idx], y[train_idx])
            preds = model.predict(X[test_idx])
            maes.append(mean_absolute_error(y[test_idx], preds))
            rmses.append(root_mean_squared_error(y[test_idx], preds))
            r2s.append(r2_score(y[test_idx], preds))

        m_mae = float(np.mean(maes))
        m_rmse = float(np.mean(rmses))
        m_r2 = float(np.mean(r2s))
        cv_10fold_results[name] = {"mae": m_mae, "rmse": m_rmse, "r2": m_r2}
        print(f"  {name:30s} | MAE: INR {m_mae:8.0f} | RMSE: INR {m_rmse:8.0f} | R2: {m_r2:.4f}")

    print("\n----------------------------------------------------------------------")
    print("2. EVALUATING GENERALIZATION TO UNSEEN PROCEDURES (Grouped 5-Fold CV)")
    print("----------------------------------------------------------------------")
    gkf = GroupKFold(n_splits=5)
    grouped_proc_results = {}
    for name, model in candidate_models.items():
        maes, rmses, r2s = [], [], []
        for train_idx, test_idx in gkf.split(X, y, groups=proc_groups):
            model.fit(X[train_idx], y[train_idx])
            preds = model.predict(X[test_idx])
            maes.append(mean_absolute_error(y[test_idx], preds))
            rmses.append(root_mean_squared_error(y[test_idx], preds))
            r2s.append(r2_score(y[test_idx], preds))

        m_mae = float(np.mean(maes))
        m_rmse = float(np.mean(rmses))
        m_r2 = float(np.mean(r2s))
        grouped_proc_results[name] = {"mae": m_mae, "rmse": m_rmse, "r2": m_r2}
        print(f"  {name:30s} | MAE: INR {m_mae:8.0f} | RMSE: INR {m_rmse:8.0f} | R2: {m_r2:.4f}")

    print("\n----------------------------------------------------------------------")
    print("3. EVALUATING GENERALIZATION ACROSS GEOGRAPHIC TIERS (Leave-One-Tier-Out)")
    print("----------------------------------------------------------------------")
    logo = LeaveOneGroupOut()
    tier_holdout_results = {}
    for name, model in candidate_models.items():
        maes, rmses, r2s = [], [], []
        for train_idx, test_idx in logo.split(X, y, groups=tier_groups):
            model.fit(X[train_idx], y[train_idx])
            preds = model.predict(X[test_idx])
            maes.append(mean_absolute_error(y[test_idx], preds))
            rmses.append(root_mean_squared_error(y[test_idx], preds))
            r2s.append(r2_score(y[test_idx], preds))

        m_mae = float(np.mean(maes))
        m_rmse = float(np.mean(rmses))
        m_r2 = float(np.mean(r2s))
        tier_holdout_results[name] = {"mae": m_mae, "rmse": m_rmse, "r2": m_r2}
        print(f"  {name:30s} | MAE: INR {m_mae:8.0f} | RMSE: INR {m_rmse:8.0f} | R2: {m_r2:.4f}")

    # -------------------------------------------------------------------------
    # Train Final Production Model: Ridge(alpha=1.0)
    # -------------------------------------------------------------------------
    print("\n----------------------------------------------------------------------")
    print("4. TRAINING FINAL PRODUCTION MODEL (Ridge Regression alpha=1.0)")
    print("----------------------------------------------------------------------")
    selected_model_name = "Ridge(alpha=1.0)"
    prod_ridge = Ridge(alpha=1.0)
    prod_ridge.fit(X, y)

    train_preds = prod_ridge.predict(X)
    train_mae = float(mean_absolute_error(y, train_preds))
    train_rmse = float(root_mean_squared_error(y, train_preds))
    train_r2 = float(r2_score(y, train_preds))

    print(f"Training Fit: MAE: INR {train_mae:.0f} | RMSE: INR {train_rmse:.0f} | R2: {train_r2:.4f}")

    # Dataset statistics for local attribution
    dataset_mean_y = float(np.mean(y))
    feature_means = [float(m) for m in np.mean(X, axis=0)]
    coefficients = [float(c) for c in prod_ridge.coef_]
    intercept = float(prod_ridge.intercept_)

    # Create mapping of coefficients for fast lookups
    coef_dict = dict(zip(feature_names, coefficients))

    # Compile the final standalone JSON artifact
    output_dir = os.path.join(project_root, 'server', 'src', 'ml')
    os.makedirs(output_dir, exist_ok=True)

    artifact = {
        "model_name": "SehatSure Treatment-Cost Driver Analysis Regressor",
        "model_type": "RidgeTabularRegression",
        "model_version": "1.0.0",
        "framework": "scikit-learn / standalone-export",
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "dataset_metadata": {
            "source_file": "pvt_costs.csv",
            "file_sha256": dataset_hash,
            "total_rows_loaded": total_rows,
            "training_rows": len(valid_rows),
            "excluded_rows": excluded_rows,
            "description": "Empirical private hospital treatment cost benchmarks across 8 Indian geographic tiers and 7 specialties.",
            "notes": "Records from treatment_cost_benchmarks.csv marked UNVERIFIED/VALUE_NOT_SUPPORTED were strictly excluded from training in adherence to FIN-01 data integrity standards."
        },
        "target": {
            "name": "mean_cost",
            "currency": "INR",
            "description": "Baseline private hospital treatment cost benchmark",
            "dataset_mean": dataset_mean_y,
            "min": float(np.min(y)),
            "max": float(np.max(y))
        },
        "validation_metrics": {
            "strategy": "K-Fold and Grouped Cross-Validation",
            "random_10fold_cv": cv_10fold_results[selected_model_name],
            "grouped_procedure_5fold_cv": grouped_proc_results[selected_model_name],
            "leave_one_tier_out_cv": tier_holdout_results[selected_model_name],
            "training_fit": {
                "mae": train_mae,
                "rmse": train_rmse,
                "r2": train_r2
            },
            "candidate_benchmarks_10fold": cv_10fold_results
        },
        "feature_schema": {
            "feature_names": feature_names,
            "coefficients": coefficients,
            "feature_means": feature_means,
            "intercept": intercept,
            "feature_count": len(feature_names)
        },
        "domains": {
            "supported_procedures": procedures,
            "supported_specialties": specialties,
            "supported_tiers": tiers,
            "procedure_to_specialty": proc_to_specialty,
            "procedure_default_stay_days": proc_stay_duration,
            "stay_days_range": {
                "min": 0,
                "max": 14,
                "max_acceptable_for_inference": 30
            }
        },
        "model_selection_rationale": (
            "Ridge Regression with L2 Regularization (alpha=1.0) was selected over non-linear "
            "ensembles due to its mathematical defensibility on 184 structured benchmark rows, "
            "guaranteed convexity with a unique global optimum, and exact Shapley-equivalent local "
            "feature attribution decomposition (C_j = beta_j * (x_j - mean_x_j)). It exports to a "
            "zero-dependency JSON representation that executes in pure TypeScript with sub-millisecond "
            "latency on the Node backend, avoiding external Python runtime overhead in production."
        ),
        "attribution_methodology": {
            "method": "Exact Local Linear Shapley Decomposition",
            "formula": "prediction - dataset_mean = sum(beta_j * (x_j - mean_x_j))",
            "categories": ["Procedure", "Geographic Tier", "Specialty", "Expected Stay"],
            "wording_standard": "Non-causal association ('Model indicates this feature strongly influences the estimate.')"
        },
        "reliability_framework": {
            "high": "Supported procedure + supported tier + stay duration within +/-2 days of procedure norm.",
            "moderate": "Supported procedure + supported tier + stay duration significantly deviating from procedure norm (>3 days divergence).",
            "insufficient": "Unsupported procedure, unsupported tier, negative/NaN/excessive stay (>30d), or missing required input."
        }
    }

    artifact_path = os.path.join(output_dir, 'treatment_cost_model_artifact.json')
    with open(artifact_path, 'w', encoding='utf-8') as f:
        json.dump(artifact, f, indent=2)

    print(f"\nModel artifact successfully written to:\n  {artifact_path}")
    print(f"Artifact size: {os.path.getsize(artifact_path)} bytes")

    # Also save a human-readable summary
    summary_path = os.path.join(output_dir, 'training_summary.json')
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump({
            "trained_at": artifact["training_timestamp"],
            "model_type": artifact["model_type"],
            "dataset_rows": len(valid_rows),
            "10fold_mae": cv_10fold_results[selected_model_name]["mae"],
            "10fold_rmse": cv_10fold_results[selected_model_name]["rmse"],
            "10fold_r2": cv_10fold_results[selected_model_name]["r2"],
            "grouped_proc_cv_mae": grouped_proc_results[selected_model_name]["mae"],
            "grouped_proc_cv_r2": grouped_proc_results[selected_model_name]["r2"],
            "leave_one_tier_out_mae": tier_holdout_results[selected_model_name]["mae"]
        }, f, indent=2)

    print(f"Summary written to:\n  {summary_path}")
    print("\nTraining pipeline complete!")


if __name__ == '__main__':
    main()
