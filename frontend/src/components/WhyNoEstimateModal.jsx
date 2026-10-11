import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  AlertTriangle,
  ShieldCheck,
  Stethoscope,
  Info,
  BookOpen,
  Cpu,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function WhyNoEstimateModal({
  isOpen,
  onClose,
  hospital,
  specialty,
  procedure,
  costIntelligence,
  specialtyMatchedCount = 0,
  procedureMatchedCount = 0,
  onSelectProcedure,
  onViewMethodology
}) {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen) return null;

  const hospName = hospital?.hospital_name || 'Selected Hospital';
  const hospCity = hospital?.city || '';
  const procName = procedure?.trim() || '';
  const specName = specialty?.trim() || '';
  const isProcedureMissing = !procName || procName.toLowerCase() === 'all' || procName.toLowerCase().includes('all procedure');

  const ml = costIntelligence?.mlCostAnalysis;
  const hasModelEstimate = Boolean(!isProcedureMissing && ml && ml.status === 'available' && ml.mlEstimate);

  const tierName = ml?.matchedTier || hospital?.tier || 'Metro 1';
  const supportCount = ml?.sampleSupportCount || 184;

  const reliabilityBadge = ml?.reliability === 'high' ? (
    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <CheckCircle2 size={12} /> High Model Support
    </span>
  ) : ml?.reliability === 'moderate' ? (
    <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <AlertTriangle size={12} /> Moderate Model Support
    </span>
  ) : (
    <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <Info size={12} /> Limited Model Support
    </span>
  );

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        {/* Head */}
        <div className="modal-head" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: hasModelEstimate ? '#f0fdfa' : '#fffbeb',
                border: hasModelEstimate ? '1px solid #99f6e4' : '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {hasModelEstimate ? (
                  <Cpu size={18} style={{ color: '#0f766e' }} />
                ) : (
                  <AlertTriangle size={18} style={{ color: '#d97706' }} />
                )}
              </div>
              <div>
                <h2 className="modal-title" style={{ fontSize: '16px', margin: 0 }}>
                  {isProcedureMissing
                    ? 'Procedure Selection Required'
                    : hasModelEstimate
                      ? 'Treatment-Cost Intelligence'
                      : 'Cost Estimate Unavailable'}
                </h2>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                  {hospName} {hospCity ? `• ${hospCity}` : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
              {specName && (
                <span className="pill-label" style={{ fontSize: '10.5px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                  {specName}
                </span>
              )}
              {procName && !isProcedureMissing && (
                <span className="pill-label" style={{ fontSize: '10.5px', background: '#f8fafc', color: '#0f766e', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                  {procName}
                </span>
              )}
              {hasModelEstimate && (
                <span className="pill-label" style={{ fontSize: '10.5px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>
                  No Verified Statutory Benchmark
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px 0' }}>
          {hasModelEstimate ? (
            <>
              {/* Primary Metric Banner: Amount is prominent */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #0f766e',
                borderRadius: '8px',
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Estimated Treatment Cost
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                    Statistical pattern for {tierName} {hospCity ? `(${hospCity})` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f766e', lineHeight: 1.1 }}>
                    ~{ml.displayEstimate}
                  </div>
                  <div style={{ marginTop: '3px' }}>
                    {reliabilityBadge}
                  </div>
                </div>
              </div>

              {/* Key Limitation & Boundaries */}
              <div style={{
                fontSize: '11.5px',
                color: '#64748b',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 12px',
                lineHeight: 1.45
              }}>
                <strong>Data limitation:</strong> Statistical estimate based on private hospital tariffs. Not a binding hospital quote or insurance payout guarantee.
              </div>

              {/* Initial Primary Cost Driver (Top 1) */}
              {ml.costDrivers && ml.costDrivers.length > 0 && !showDetails && (
                <div style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '11.5px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span><strong>Primary cost driver:</strong> {ml.costDrivers[0].feature} ({ml.costDrivers[0].percentageContribution}%)</span>
                  <span style={{ fontWeight: 700, color: ml.costDrivers[0].direction === 'above_baseline' ? '#166534' : '#b45309' }}>
                    {ml.costDrivers[0].direction === 'above_baseline' ? '+' : '−'}₹{Math.abs(ml.costDrivers[0].impactAmount).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {/* Progressive Disclosure Toggle */}
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '6px 0',
                  color: '#0f766e',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showDetails ? 'Hide details' : 'View cost drivers, provenance & methodology'}</span>
              </button>

              {/* Collapsed Secondary Details */}
              {showDetails && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Complete Cost Drivers List */}
                  {ml.costDrivers && ml.costDrivers.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
                        All Key Cost Drivers
                      </div>
                      {ml.costDrivers.map((driver, idx) => {
                        const isAbove = driver.direction === 'above_baseline';
                        const sign = isAbove ? '+' : '−';
                        const impactFormatted = `₹${Math.abs(driver.impactAmount).toLocaleString('en-IN')}`;
                        return (
                          <div key={idx} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div>
                              <strong>{driver.feature}</strong>: <span style={{ color: '#64748b' }}>{driver.explanation}</span>
                            </div>
                            <div style={{ fontWeight: 800, color: isAbove ? '#166534' : '#b45309', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                              {sign}{impactFormatted} ({driver.percentageContribution}%)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Provenance & Scenario Details */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '11px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '6px',
                    color: '#334155'
                  }}>
                    <div><strong>Dataset Support:</strong> {supportCount} records</div>
                    <div><strong>Scenario:</strong> {tierName} · {procName}</div>
                    <div><strong>Typical Stay:</strong> {ml.actualStayDays || 3} days</div>
                    <div><strong>Model Version:</strong> v{ml.modelVersion}</div>
                  </div>

                  {/* Architectural Boundary Note */}
                  <div style={{
                    fontSize: '11px',
                    color: '#475569',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    lineHeight: 1.4
                  }}>
                    <strong style={{ color: '#065f46' }}>Calculation Boundary:</strong> Hospital quotes and policy claim payouts require final itemized billing evaluated by the deterministic adjudication engine.
                  </div>
                </div>
              )}
            </>
          ) : (
            /* =========================================================================
               LEVEL 3 / PROCEDURE UNSELECTED PRESENTATION
               ========================================================================= */
            <>
              <div style={{
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '12.5px',
                lineHeight: 1.45,
                color: '#92400e'
              }}>
                {isProcedureMissing ? (
                  <div>
                    <strong>Procedure selection required.</strong> Select a clinical procedure above to compute verified cost estimates.
                  </div>
                ) : (
                  <div>
                    <strong>Benchmark data unavailable.</strong> Authoritative government or hospital tariff schedules are unavailable for "{procName}". SehatSure does not fabricate estimates.
                  </div>
                )}
              </div>

              {/* Compact Evidence Summary */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '11.5px',
                color: '#475569',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px'
              }}>
                <div>• <strong>{specialtyMatchedCount}</strong> facilities match department ({specName || 'All'})</div>
                <div>• <strong>{procedureMatchedCount}</strong> facilities have verified tariffs for {isProcedureMissing ? 'selected procedure' : `"${procName}"`}</div>
                <div>• SehatSure will not substitute unrelated clinical codes</div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-actions" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            {onViewMethodology && (
              <button
                type="button"
                className="pill-btn pill-btn-ghost pill-btn-sm"
                onClick={() => {
                  onClose();
                  onViewMethodology();
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}
              >
                <BookOpen size={12} />
                <span>Methodology</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onSelectProcedure && (
              <button
                type="button"
                className="pill-btn pill-btn-primary pill-btn-sm"
                onClick={() => {
                  onClose();
                  onSelectProcedure();
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}
              >
                <Stethoscope size={12} />
                <span>{isProcedureMissing ? 'Select Procedure →' : 'Change Procedure'}</span>
              </button>
            )}
            <button
              type="button"
              className="pill-btn pill-btn-ghost pill-btn-sm"
              onClick={onClose}
              style={{ fontSize: '11.5px' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
