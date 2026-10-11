import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Percent,
  Receipt,
  FileText,
  ChevronRight
} from 'lucide-react';
import ProvenanceBadge from './ProvenanceBadge';
import DecisionRadar from './DecisionRadar';

function formatINR(val) {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
}

export default function ScoreBreakdownModal({
  isOpen,
  onClose,
  data,
  policy,
  onOpenBillBreakdown,
  hasActualBill = false
}) {
  const { t } = useTranslation();

  if (!isOpen || !data) return null;

  const { hospital, score, estimate, networkInfo } = data;
  const granularScore = Number(score?.granularScore ?? score?.finalScore ?? 0).toFixed(1);
  const finalScoreNum = parseFloat(granularScore);

  // Four scoring pillars
  const coverageFit = Number(score?.coverageFit ?? 70);
  const patientCostFit = Number(score?.patientCostFit ?? 70);
  const hospitalTypeScore = Number(score?.hospitalTypeScore ?? 70);
  const coPayFit = Number(score?.coPayFit ?? 70);

  // Points earned out of their maximum weights
  const coveragePoints = (coverageFit * 0.50).toFixed(1); // 50 max
  const patientCostPoints = (patientCostFit * 0.25).toFixed(1); // 25 max
  const hospitalTypePoints = (hospitalTypeScore * 0.15).toFixed(1); // 15 max
  const coPayPoints = (coPayFit * 0.10).toFixed(1); // 10 max

  // Score tier assessment
  let scoreBadgeColor = '#15803d';
  let scoreBadgeBg = '#f0fdf4';
  let scoreBadgeBorder = '#bbf7d0';
  let scoreStatusText = 'Strong Match — High Cashless & Coverage Fit';

  if (finalScoreNum < 60) {
    scoreBadgeColor = '#b91c1c';
    scoreBadgeBg = '#fef2f2';
    scoreBadgeBorder = '#fecaca';
    scoreStatusText = 'Limited Match — High Out-of-Pocket or Non-Network';
  } else if (finalScoreNum < 78) {
    scoreBadgeColor = '#b45309';
    scoreBadgeBg = '#fffbeb';
    scoreBadgeBorder = '#fde68a';
    scoreStatusText = 'Moderate Match — Partial Coverage or Co-Pay Applicable';
  }

  const networkStatus = networkInfo?.networkStatus || score?.networkStatus || 'unknown';
  const isVerifiedNetwork = networkStatus === 'verified';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="modal-dialog modal-dialog-wide"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', gap: '18px' }}
      >
        {/* Modal Header */}
        <div className="modal-head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ShieldCheck size={22} style={{ color: 'var(--color-primary)' }} />
              <h2 className="modal-title" style={{ fontSize: '20px' }}>
                SehatSure Score Breakdown
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--color-text)' }}>
                {hospital?.hospital_name}
              </span>
              <span className="pill-label" style={{ fontSize: '11px', padding: '2px 8px' }}>
                {hospital?.hospital_type || 'Private'}
              </span>
              <span className="pill-label" style={{ fontSize: '11px', padding: '2px 8px' }}>
                {hospital?.tier || 'Tier 2'}
              </span>
              {hospital?.rating > 0 && (
                <span className="pill-label" style={{ fontSize: '11px', padding: '2px 8px', fontWeight: 700 }}>
                  ★ {Number(hospital.rating).toFixed(1)}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* SehatSure Decision Radar (Authentic 4-Pillar Visualization) */}
        <DecisionRadar
          score={score}
          networkStatus={networkStatus}
          showDetails={true}
        />


        {/* Financial Impact Quick Summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
            padding: '14px',
            background: '#f8fafc',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)'
          }}
        >
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Est. Total Cost
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--color-text)', marginTop: '2px' }}>
              {formatINR(estimate?.totalEstimate)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#15803d' }}>
              Est. Insurer Share
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
              {estimate?.costIntelligence && !estimate.costIntelligence.coveredReliable
                ? 'Unable to estimate'
                : formatINR(score?.insurerEstimatedShare)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#b91c1c' }}>
              Est. Patient Payable
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#b91c1c', marginTop: '2px' }}>
              {estimate?.costIntelligence && !estimate.costIntelligence.oopReliable
                ? 'Unable to estimate'
                : formatINR(score?.patientPayable)}
            </div>
          </div>
        </div>

        {/* Explanatory Formula Note */}
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.4, background: '#f1f5f9', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          <strong>Formula:</strong> (0.50 × Coverage) + (0.25 × Cost Fit) + (0.15 × Hospital Tier) + (0.10 × Co-Pay) = <strong>{granularScore} / 100</strong>.
          {' '}This score reflects financial and insurance compatibility with your policy clauses; it is not a clinical accreditation.
        </div>

        {/* Modal Action Buttons */}
        <div className="modal-actions" style={{ marginTop: '4px' }}>
          {onOpenBillBreakdown && (
            <button
              type="button"
              className="pill-btn pill-btn-ghost pill-btn-sm"
              onClick={() => {
                onClose();
                onOpenBillBreakdown();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Receipt size={14} />
              <span>{hasActualBill ? 'View Itemized Bill Breakdown' : 'View Cost Breakdown'}</span>
            </button>
          )}

          <button
            type="button"
            className="pill-btn pill-btn-primary pill-btn-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
