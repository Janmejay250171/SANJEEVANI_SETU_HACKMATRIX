import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  Building2,
  AlertTriangle,
  ShieldCheck,
  Stethoscope,
  Info,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Database,
  ExternalLink,
  Cpu,
  CheckCircle2
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
      <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '660px' }}>
        {/* Head */}
        <div className="modal-head" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: hasModelEstimate ? '#f0fdfa' : '#fffbeb',
                border: hasModelEstimate ? '1px solid #99f6e4' : '1px solid #fde68a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {hasModelEstimate ? (
                  <Cpu size={20} style={{ color: '#0f766e' }} />
                ) : (
                  <AlertTriangle size={20} style={{ color: '#d97706' }} />
                )}
              </div>
              <div>
                <h2 className="modal-title" style={{ fontSize: '18px', margin: 0 }}>
                  {isProcedureMissing
                    ? 'Procedure Required for Cost Estimate'
                    : hasModelEstimate
                      ? 'Treatment-Cost Intelligence: Model Reference Available'
                      : 'Cost Estimate Unavailable'}
                </h2>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                  {hospName} {hospCity ? `• ${hospCity}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
              {specName && (
                <span className="pill-label" style={{ fontSize: '11px', background: '#f1f5f9', color: '#0f172a', border: '1px solid #cbd5e1' }}>
                  Specialty: {specName}
                </span>
              )}
              {procName && !isProcedureMissing && (
                <span className="pill-label" style={{ fontSize: '11px', background: '#f8fafc', color: '#0f766e', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                  Procedure: {procName}
                </span>
              )}
              {hasModelEstimate ? (
                <>
                  <span className="pill-label" style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', fontWeight: 700 }}>
                    Status: No Verified Benchmark
                  </span>
                  <span className="pill-label" style={{ fontSize: '11px', background: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4', fontWeight: 700 }}>
                    AI Model Estimate Available
                  </span>
                </>
              ) : (
                <span className="pill-label" style={{ fontSize: '11px', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
                  Status: No Reliable Cost Benchmark
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 0' }}>
          {hasModelEstimate ? (
            /* =========================================================================
               LEVEL 2 PRESENTATION: NO VERIFIED BENCHMARK + AI STATISTICAL ESTIMATE
               ========================================================================= */
            <>
              {/* Hierarchy Notice: No Verified Benchmark */}
              <div style={{
                background: '#fffbeb',
                border: '1.5px solid #fde68a',
                borderRadius: '6px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#92400e', fontWeight: 700, fontSize: '12.5px' }}>
                  <AlertTriangle size={15} style={{ color: '#d97706' }} />
                  <span>NO VERIFIED BENCHMARK</span>
                </div>
                <div style={{ fontSize: '12px', color: '#78350f', lineHeight: 1.45 }}>
                  Government or statutory healthcare tariff schedules (such as AB-PMJAY or CGHS) are currently unavailable for <strong>"{procName}"</strong> in authoritative reference documents. SehatSure will not substitute an unrelated clinical code.
                </div>
              </div>

              {/* Primary Metric: AI Statistical Cost Estimate */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #0f766e',
                borderRadius: '6px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f766e', fontWeight: 800, fontSize: '13px' }}>
                    <Cpu size={16} />
                    <span>AI STATISTICAL COST ESTIMATE</span>
                    <span style={{ fontSize: '10px', background: '#ccfbf1', color: '#0f766e', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      v{ml.modelVersion}
                    </span>
                  </div>
                  {reliabilityBadge}
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                      ESTIMATED TREATMENT EXPENSE (SCENARIO PATTERN)
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                      Based on structured private hospital tariff patterns for {tierName} {hospCity ? `(${hospCity})` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f766e' }}>
                      ~{ml.displayEstimate}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 600 }}>
                      Model-based estimate from structured treatment-cost data
                    </div>
                  </div>
                </div>

                {/* Scope Note: Not a hospital-specific quote */}
                <div style={{ fontSize: '11px', color: '#475569', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '7px 10px', lineHeight: 1.4 }}>
                  <strong>Scenario Scope:</strong> Estimated surgical expense for this scenario is ~{ml.displayEstimate}. This reflects generalized private facility tariffs in {tierName}, not a direct binding quote from {hospName}.
                </div>

                {/* Compact Provenance Section */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '5px',
                  padding: '10px 12px',
                  fontSize: '11.5px',
                  color: '#334155',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    Model Support & Provenance
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '6px' }}>
                    <div><strong>Model Support:</strong> {supportCount} relevant tariff records</div>
                    <div><strong>Geography / Tier:</strong> {tierName} {hospCity ? `(${hospCity})` : ''}</div>
                    <div><strong>Clinical Procedure:</strong> {ml.matchedProcedure || procName}</div>
                    <div><strong>Specialty:</strong> {ml.canonicalSpecialty || specName}</div>
                    <div><strong>Expected Stay:</strong> {ml.actualStayDays || 3} days (standard inpatient)</div>
                  </div>
                </div>

                {/* Top Cost Drivers (genuinely from model) */}
                {ml.costDrivers && ml.costDrivers.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                      Why this estimate? Top Cost Drivers:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ml.costDrivers.map((driver, idx) => {
                        const isAbove = driver.direction === 'above_baseline';
                        const sign = isAbove ? '+' : '−';
                        const impactFormatted = `₹${Math.abs(driver.impactAmount).toLocaleString('en-IN')}`;
                        const badgeBg = driver.influence === 'strong' ? '#f3e8ff' : driver.influence === 'moderate' ? '#eff6ff' : '#f1f5f9';
                        const badgeColor = driver.influence === 'strong' ? '#6b21a8' : driver.influence === 'moderate' ? '#1e40af' : '#475569';

                        return (
                          <div key={idx} style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '5px',
                            padding: '7px 10px',
                            fontSize: '11.5px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' }}>
                                <span style={{ color: '#64748b' }}>{idx + 1}.</span>
                                <span>{driver.feature}</span>
                                <span style={{
                                  fontSize: '9.5px',
                                  padding: '1px 6px',
                                  borderRadius: '8px',
                                  background: badgeBg,
                                  color: badgeColor,
                                  fontWeight: 700
                                }}>
                                  {driver.influence.toUpperCase()}
                                </span>
                              </div>
                              <div style={{ fontWeight: 800, color: isAbove ? '#166534' : '#b45309' }}>
                                {sign}{impactFormatted} ({driver.percentageContribution}%)
                              </div>
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                              {driver.explanation}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Small Disclaimer */}
                <div style={{ fontSize: '10.5px', color: '#64748b', fontStyle: 'italic', lineHeight: 1.35 }}>
                  Informational estimate — not a hospital quote, tariff, or guaranteed treatment cost.
                </div>
              </div>

              {/* Strict Architecture Separation: Insurance Adjudication Boundary */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '11.5px',
                color: '#334155',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                lineHeight: 1.45
              }}>
                <ShieldCheck size={18} style={{ color: '#0f766e', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Strict Separation of Architectural Concerns:</strong> Insurance coverage and patient out-of-pocket shares are calculated strictly by the deterministic financial engine and require itemized hospital billing or policy schedules. The ML model estimates surgical expense patterns only and never calculates insurance payouts.
                </div>
              </div>
            </>
          ) : (
            /* =========================================================================
               LEVEL 3 PRESENTATION: INSUFFICIENT COST DATA OR UNSELECTED PROCEDURE
               ========================================================================= */
            <>
              {/* Main Context Banner */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: 'var(--radius-sm, 6px)',
                padding: '14px 16px',
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#1e293b'
              }}>
                {isProcedureMissing ? (
                  <div>
                    <strong>A specific procedure is required to calculate treatment costs.</strong> Hospital matching operates at the specialty department level, but treatment tariffs in healthcare are strictly procedure-specific.
                  </div>
                ) : (
                  <div>
                    <strong>SehatSure refuses to guess or invent hospital prices.</strong> While <strong>{hospName}</strong> matches your medical department, verified procedure-level tariff benchmarks for <strong>"{procName}"</strong> are currently unavailable in authoritative reference schedules, and the ML model has insufficient training records to generalize reliably.
                  </div>
                )}
              </div>

              {/* Evidence & Match Summary Card */}
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Authoritative Matching & Evidence Summary
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: '#334155' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#2563eb', fontWeight: 800 }}>•</span>
                    <span>
                      <strong>{specialtyMatchedCount}</strong> hospitals match the selected specialty ({specName || 'All'}).
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#dc2626', fontWeight: 800 }}>•</span>
                    <span>
                      <strong>{procedureMatchedCount}</strong> hospitals have verified procedure-level cost tariffs for {isProcedureMissing ? 'an unselected procedure' : `"${procName}"`}.
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#16a34a', fontWeight: 800 }}>•</span>
                    <span>
                      <strong>SehatSure will not substitute another procedure's cost</strong> (e.g., Angiography ≠ Angioplasty, EEG ≠ Craniotomy).
                    </span>
                  </div>
                </div>
              </div>

              {/* FIN-01 Cost Safety Standards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  SehatSure Cost Safety Standards
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                      <span>🛡️</span>
                      <span>No Artificial Fabrication</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                      Generic platforms often display inaccurate averages. SehatSure strictly requires published government tariffs, CGHS packages, or verified hospital tariff cards.
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                      <span>⚖️</span>
                      <span>No Cross-Procedure Substitution</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', lineHeight: 1.4 }}>
                      A diagnostic test is never priced like a surgical intervention. Each clinical procedure must stand on its own verified tariff evidence.
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Notice */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldCheck size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>
                  <strong>Hospital matching & network analysis remain fully operational.</strong> You can still review hospital accreditation, bed count, room category options, and plan care journeys with cashless pre-authorization guidance.
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="modal-actions" style={{ justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onViewMethodology && (
              <button
                type="button"
                className="pill-btn pill-btn-ghost pill-btn-sm"
                onClick={() => {
                  onClose();
                  onViewMethodology();
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <BookOpen size={13} />
                <span>View Cost Methodology</span>
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <Stethoscope size={13} />
                <span>{isProcedureMissing ? 'Select a Procedure →' : 'Choose Another Procedure'}</span>
              </button>
            )}
            <button
              type="button"
              className="pill-btn pill-btn-ghost pill-btn-sm"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
