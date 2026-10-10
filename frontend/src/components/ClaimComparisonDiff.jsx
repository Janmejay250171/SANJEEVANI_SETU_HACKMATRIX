import React from 'react';
import {
  GitCompare,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  CheckCircle,
  Clock,
  Layers,
  History
} from 'lucide-react';

function formatInr(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0.00';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export default function ClaimComparisonDiff({ comparison, onClose }) {
  if (!comparison) return null;

  const {
    claimId,
    priorAssessmentId,
    currentAssessmentId,
    comparedAt,
    totalClaimedDeltaPaise = 0,
    insurerPayableDeltaPaise = 0,
    patientResponsibilityDeltaPaise = 0,
    priorSummary = {},
    currentSummary = {},
    lineItemDiffs = [],
    newReviewReasons = [],
    resolvedReviewReasons = [],
    changeSummary
  } = comparison;

  const isPayableIncreased = insurerPayableDeltaPaise > 0;
  const isPayableDecreased = insurerPayableDeltaPaise < 0;

  return (
    <div className="claim-comparison-card animate-fade-in" aria-label="Before and After Assessment Comparison">
      <div className="comparison-header">
        <div className="comp-title-group">
          <GitCompare size={20} className="text-primary" />
          <div>
            <h3 className="comp-title">Assessment Recomputation Comparison</h3>
            <span className="comp-subtitle">
              Prior assessment preserved immutably • Claim ID: <span className="font-mono">{claimId}</span>
            </span>
          </div>
        </div>

        {onClose && (
          <button type="button" onClick={onClose} className="btn-close-comp" aria-label="Close comparison view">
            Dismiss Diff
          </button>
        )}
      </div>

      {/* Delta Banner */}
      <div className="delta-banner">
        <div className="delta-card">
          <span className="delta-label">Claimed Delta</span>
          <span className="delta-value font-mono">
            {totalClaimedDeltaPaise >= 0 ? `+${formatInr(totalClaimedDeltaPaise)}` : formatInr(totalClaimedDeltaPaise)}
          </span>
        </div>

        <div className={`delta-card ${isPayableIncreased ? 'delta-positive' : isPayableDecreased ? 'delta-negative' : ''}`}>
          <span className="delta-label">Insurer Payable Delta</span>
          <span className="delta-value font-mono font-bold">
            {isPayableIncreased && <TrendingUp size={16} />}
            {isPayableDecreased && <TrendingDown size={16} />}
            {insurerPayableDeltaPaise >= 0 ? `+${formatInr(insurerPayableDeltaPaise)}` : formatInr(insurerPayableDeltaPaise)}
          </span>
        </div>

        <div className="delta-card">
          <span className="delta-label">Patient Responsibility Delta</span>
          <span className="delta-value font-mono">
            {patientResponsibilityDeltaPaise >= 0 ? `+${formatInr(patientResponsibilityDeltaPaise)}` : formatInr(patientResponsibilityDeltaPaise)}
          </span>
        </div>
      </div>

      {/* Side-by-Side Summary Columns */}
      <div className="comparison-columns-grid">
        {/* Prior Assessment */}
        <div className="comp-snapshot-col prior-col">
          <div className="snapshot-header">
            <span className="snapshot-tag tag-prior">
              <History size={13} />
              Prior Snapshot (V1)
            </span>
            <span className="snapshot-id font-mono text-muted">{priorAssessmentId}</span>
          </div>

          <div className="snapshot-metrics-list">
            <div className="metric-row">
              <span className="metric-label">Claimed Total:</span>
              <span className="metric-val font-mono">{formatInr(priorSummary.claimedPaise)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Insurer Payable:</span>
              <span className="metric-val font-mono font-semibold text-primary">
                {formatInr(priorSummary.insurerPayablePaise)}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Patient Out-of-Pocket:</span>
              <span className="metric-val font-mono text-danger">
                {formatInr(priorSummary.patientResponsibilityPaise)}
              </span>
            </div>
          </div>
        </div>

        <div className="comp-arrow-divider">
          <ArrowRight size={24} className="text-primary" />
        </div>

        {/* Current Assessment */}
        <div className="comp-snapshot-col current-col">
          <div className="snapshot-header">
            <span className="snapshot-tag tag-current">
              <CheckCircle size={13} />
              Reassessed Snapshot (V2)
            </span>
            <span className="snapshot-id font-mono text-primary font-semibold">{currentAssessmentId}</span>
          </div>

          <div className="snapshot-metrics-list">
            <div className="metric-row">
              <span className="metric-label">Claimed Total:</span>
              <span className="metric-val font-mono">{formatInr(currentSummary.claimedPaise)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Insurer Payable:</span>
              <span className="metric-val font-mono font-bold text-success">
                {formatInr(currentSummary.insurerPayablePaise)}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Patient Out-of-Pocket:</span>
              <span className="metric-val font-mono text-danger">
                {formatInr(currentSummary.patientResponsibilityPaise)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Item Changes Table */}
      {lineItemDiffs && lineItemDiffs.length > 0 && (
        <div className="comp-item-diffs-section">
          <h4 className="diff-section-title">Modified Line Items ({lineItemDiffs.length})</h4>
          <div className="table-responsive">
            <table className="comp-diff-table">
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th className="text-right">Prior Claimed</th>
                  <th className="text-right">New Claimed</th>
                  <th className="text-right">Prior Payable</th>
                  <th className="text-right">New Payable</th>
                  <th>Difference Explanation</th>
                </tr>
              </thead>
              <tbody>
                {lineItemDiffs.map((diff, idx) => (
                  <tr key={`${diff.itemId}_${idx}`}>
                    <td className="font-medium">{diff.description}</td>
                    <td className="text-right font-mono text-muted">{formatInr(diff.priorClaimedPaise)}</td>
                    <td className="text-right font-mono font-semibold">{formatInr(diff.currentClaimedPaise)}</td>
                    <td className="text-right font-mono text-muted">{formatInr(diff.priorInsurerPayablePaise)}</td>
                    <td className="text-right font-mono font-bold text-primary">
                      {formatInr(diff.currentInsurerPayablePaise)}
                    </td>
                    <td className="text-sm text-secondary">{diff.differenceSummary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Change Reason Note */}
      <div className="comp-footer-note">
        <p>
          <strong>Reassessment Rationale:</strong> {changeSummary || 'Safe recomputation triggered from modified input parameters.'}
        </p>
      </div>
    </div>
  );
}
