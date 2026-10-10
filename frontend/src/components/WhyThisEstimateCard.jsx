import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, ShieldCheck, AlertCircle, ExternalLink, Database, Cpu, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export default function WhyThisEstimateCard({ costIntelligence, hospitalName, policy }) {
  const [expanded, setExpanded] = useState(false);
  const [showMLDetails, setShowMLDetails] = useState(false);

  if (!costIntelligence) return null;

  const {
    available,
    procedure,
    procedureCode,
    benchmarkLevel,
    treatmentCostRange,
    potentiallyCoveredRange,
    estimatedPatientOopRange,
    oopReliable,
    missingInformation,
    provenance,
    whyThisEstimate,
    disclaimer,
    mlCostAnalysis
  } = costIntelligence;

  const isModelRef = costIntelligence?.costEstimateLevel === 'model_reference';
  const effectiveLevel = isModelRef ? 'model_reference' : benchmarkLevel;

  const levelLabels = {
    hospital_specific: 'Hospital-Specific Verified Tariff (Level A)',
    maharashtra_regional: 'Maharashtra State Benchmark (Level B)',
    state_benchmark: 'Maharashtra State Benchmark (Level B)',
    regional_benchmark: 'Regional Benchmark (Level B)',
    national: 'National Healthcare Benchmark (Level C)',
    national_benchmark: 'National Healthcare Benchmark (Level C)',
    government_package: 'Government Scheme Package Reference (Level D)',
    academic_estimate: 'Academic Study Estimate (Level E)',
    model_reference: 'AI Model Statistical Reference (Level 2)',
    unavailable: 'Insufficient Data (Level F)'
  };

  const levelBadgeColors = {
    hospital_specific: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
    maharashtra_regional: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    state_benchmark: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    regional_benchmark: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
    national: { bg: '#f8fafc', text: '#334155', border: '#cbd5e1' },
    national_benchmark: { bg: '#f8fafc', text: '#334155', border: '#cbd5e1' },
    government_package: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
    academic_estimate: { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
    model_reference: { bg: '#ccfbf1', text: '#0f766e', border: '#99f6e4' },
    unavailable: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' }
  };

  const badgeStyle = levelBadgeColors[effectiveLevel] || levelBadgeColors.national_benchmark;

  return (
    <div style={{
      marginTop: '8px',
      border: '1px solid #e2e8f0',
      borderRadius: 'var(--radius-sm, 6px)',
      background: '#ffffff',
      overflow: 'hidden',
      fontSize: '12.5px'
    }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: '#f8fafc',
          border: 'none',
          cursor: 'pointer',
          color: '#334155',
          fontWeight: 700,
          textAlign: 'left'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <HelpCircle size={14} style={{ color: '#0284c7' }} />
          {(costIntelligence.isGovernmentPackageOnly || benchmarkLevel === 'government_package')
            ? 'WHY THIS REFERENCE?'
            : 'Why this estimate?'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: '12px',
            background: badgeStyle.bg,
            color: badgeStyle.text,
            border: `1px solid ${badgeStyle.border}`,
            fontWeight: 700
          }}>
            {levelLabels[effectiveLevel] || effectiveLevel}
          </span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #e2e8f0' }}>
          {/* Explicit Fallback Notice (Requirement 4) */}
          {costIntelligence.fallbackNotice && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '4px',
              padding: '8px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '13px' }}>ℹ️</span>
              <span>{costIntelligence.fallbackNotice}</span>
            </div>
          )}

          {/* Factor list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {whyThisEstimate && whyThisEstimate.length > 0 ? (
              whyThisEstimate.map((item, idx) => (
                <div key={idx} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  color: item.startsWith('⚠️') ? '#b45309' : '#1e293b',
                  fontWeight: item.startsWith('✓') ? 600 : 500,
                  lineHeight: 1.4
                }}>
                  <span>{item}</span>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b' }}>Benchmark details computed deterministically.</div>
            )}
          </div>

          {/* ML-BASED TREATMENT-COST DRIVER ANALYSIS (FIN-01) */}
          {mlCostAnalysis && mlCostAnalysis.status === 'available' && (
            <div style={{
              background: '#f8fafc',
              border: '1.5px solid #0f766e',
              borderRadius: '6px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f766e', fontWeight: 800, fontSize: '13px' }}>
                  <Cpu size={16} />
                  <span>ML TREATMENT-COST DRIVER ANALYSIS</span>
                  <span style={{ fontSize: '10.5px', background: '#ccfbf1', color: '#0f766e', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    v{mlCostAnalysis.modelVersion}
                  </span>
                </div>

                {/* Honest Reliability Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {mlCostAnalysis.reliability === 'high' ? (
                    <span style={{ fontSize: '11px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={12} /> High Model Reliability
                    </span>
                  ) : mlCostAnalysis.reliability === 'moderate' ? (
                    <span style={{ fontSize: '11px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <AlertTriangle size={12} /> Moderate Reliability (Divergent Stay)
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} /> Insufficient Data
                    </span>
                  )}
                </div>
              </div>

              {/* Benchmark vs ML Estimate Distinction Card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '8px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '10px 12px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                    {isModelRef ? 'GOVERNMENT / STATUTORY BENCHMARK' : 'EVIDENCE-BACKED BENCHMARK'}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: isModelRef ? '#92400e' : '#0f172a' }}>
                    {isModelRef ? 'Unavailable' : (treatmentCostRange?.displayRange || '—')}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                    {isModelRef ? 'No statutory reference code' : (levelLabels[benchmarkLevel] || benchmarkLevel)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: 700 }}>AI STATISTICAL ESTIMATE</div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f766e' }}>
                    ~{mlCostAnalysis.displayEstimate}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                    Learned Tabular Regressor (Ridge)
                  </div>
                </div>
              </div>

              {/* Primary Cost Drivers */}
              {mlCostAnalysis.costDrivers && mlCostAnalysis.costDrivers.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                    Why this estimate? Top Cost Drivers:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {mlCostAnalysis.costDrivers.map((driver, idx) => {
                      const isAbove = driver.direction === 'above_baseline';
                      const sign = isAbove ? '+' : '−';
                      const impactFormatted = `₹${Math.abs(driver.impactAmount).toLocaleString('en-IN')}`;

                      const badgeBg = driver.influence === 'strong' ? '#f3e8ff' : driver.influence === 'moderate' ? '#eff6ff' : '#f1f5f9';
                      const badgeColor = driver.influence === 'strong' ? '#6b21a8' : driver.influence === 'moderate' ? '#1e40af' : '#475569';
                      const badgeBorder = driver.influence === 'strong' ? '#d8b4fe' : driver.influence === 'moderate' ? '#bfdbfe' : '#cbd5e1';

                      return (
                        <div key={idx} style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '5px',
                          padding: '8px 10px',
                          fontSize: '12px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a' }}>
                              <span style={{ color: '#64748b' }}>{idx + 1}.</span>
                              <span>{driver.feature}</span>
                              <span style={{
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                background: badgeBg,
                                color: badgeColor,
                                border: `1px solid ${badgeBorder}`,
                                fontWeight: 700
                              }}>
                                {driver.influence.toUpperCase()} INFLUENCE
                              </span>
                            </div>
                            <div style={{ fontWeight: 800, color: isAbove ? '#166534' : '#b45309', fontSize: '12px' }}>
                              {sign}{impactFormatted} ({driver.percentageContribution}%)
                            </div>
                          </div>
                          <div style={{ fontSize: '11px', color: '#475569', marginTop: '3px', lineHeight: 1.4 }}>
                            {driver.explanation}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Benchmark Comparison Note */}
              {mlCostAnalysis.benchmarkComparison && (
                <div style={{ fontSize: '11px', color: '#334155', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '6px 8px', lineHeight: 1.45 }}>
                  <strong>Benchmark vs ML Distinction:</strong> {mlCostAnalysis.benchmarkComparison.explanation}
                </div>
              )}

              {/* Validation Metrics & Method Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMLDetails(!showMLDetails)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    fontSize: '11px',
                    color: '#0f766e',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Info size={12} />
                  {showMLDetails ? 'Hide Model Validation & Architecture Details ▲' : 'View Model Validation & Methodology ▼'}
                </button>

                {showMLDetails && (
                  <div style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#334155',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div><strong>Model:</strong> Ridge Tabular Regression (L2 regularization, alpha=1.0)</div>
                    <div><strong>Training Data:</strong> 184 verified private healthcare tariffs (pvt_costs.csv) across 8 tiers</div>
                    <div><strong>10-Fold CV MAE:</strong> ₹{mlCostAnalysis.validationMetrics.tenFoldCvMae?.toLocaleString('en-IN')} (R²: {mlCostAnalysis.validationMetrics.tenFoldCvR2})</div>
                    <div><strong>Grouped Procedure 5-Fold MAE:</strong> ₹{mlCostAnalysis.validationMetrics.groupedProcCvMae?.toLocaleString('en-IN')} (unseen procedure holdout)</div>
                    <div><strong>Attribution Method:</strong> Exact Local Linear Shapley Decomposition (non-causal)</div>
                    <div style={{ color: '#047857', fontWeight: 600, marginTop: '2px' }}>
                      ✓ Critical Boundary: Insurance covered amount & patient out-of-pocket expenses are calculated strictly by the deterministic financial engine. ML model never alters insurance money.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sourced Evidence Box */}
          {provenance && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              padding: '8px 10px',
              fontSize: '11.5px',
              color: '#334155',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: '#0f172a' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Database size={13} style={{ color: '#475569' }} />
                  Authoritative Provenance:
                </span>
                {provenance.sourceStatus && (
                  <span style={{
                    fontSize: '10.5px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: provenance.sourceStatus === 'VERIFIED' ? '#dcfce7' : '#fee2e2',
                    color: provenance.sourceStatus === 'VERIFIED' ? '#166534' : '#991b1b',
                    fontWeight: 700
                  }}>
                    {provenance.sourceStatus === 'VERIFIED' ? '✓ VERIFIED' : provenance.sourceStatus}
                  </span>
                )}
              </div>
              {(costIntelligence.isGovernmentPackageOnly || benchmarkLevel === 'government_package') ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', marginTop: '4px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px', lineHeight: 1.5 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Source Authority:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>National Health Authority (NHA)</span>

                    <span style={{ color: '#64748b', fontWeight: 600 }}>Program:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (AB-PMJAY)</span>

                    <span style={{ color: '#64748b', fontWeight: 600 }}>Document:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Health Benefit Package (HBP) 2.2</span>

                    <span style={{ color: '#64748b', fontWeight: 600 }}>Package Code:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{provenance.sourceTable || provenance.sourcePage || procedureCode || 'SB039A'}</span>

                    <span style={{ color: '#64748b', fontWeight: 600 }}>Reference Rate:</span>
                    <span style={{ fontWeight: 800, color: '#047857' }}>₹{(provenance.exactPackageRate || treatmentCostRange?.typical || 80000).toLocaleString('en-IN')}</span>

                    <span style={{ color: '#64748b', fontWeight: 600 }}>Data Year:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>{provenance.dataYear || 2022}</span>

                    <span style={{ color: '#64748b', fontWeight: 600 }}>Transformation:</span>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Direct 1:1 statutory package-rate mapping</span>
                  </div>

                  <div style={{
                    marginTop: '6px',
                    padding: '8px 10px',
                    background: '#fef3c7',
                    borderRadius: '4px',
                    border: '1.5px solid #fde68a',
                    color: '#92400e',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    lineHeight: 1.4
                  }}>
                    IMPORTANT: This is a statutory government package reference, NOT a private hospital bill quote.
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <strong>Source:</strong> {provenance.sourceName} ({provenance.dataYear})
                  </div>
                  {provenance.sourceDocument && (
                    <div>
                      <strong>Document:</strong> {provenance.sourceDocument} {provenance.sourcePage ? `(${provenance.sourcePage})` : ''}
                    </div>
                  )}
                  {provenance.sourceTable && (
                    <div>
                      <strong>Table / Code:</strong> {provenance.sourceTable}
                    </div>
                  )}
                  {provenance.exactPackageRate && (
                    <div>
                      <strong>Exact Official Package Rate:</strong> ₹{provenance.exactPackageRate.toLocaleString('en-IN')}
                    </div>
                  )}
                </>
              )}
              {provenance.sourceUrl && (
                <a
                  href={provenance.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#0284c7',
                    textDecoration: 'underline',
                    fontWeight: 600,
                    marginTop: '2px'
                  }}
                >
                  View Official Sourced Document <ExternalLink size={11} />
                </a>
              )}
            </div>
          )}

          {/* Missing Information Notice */}
          {missingInformation && missingInformation.length > 0 && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '4px',
              padding: '8px 10px',
              fontSize: '11.5px',
              color: '#92400e'
            }}>
              <strong>Missing Information (Why exact number is not guessed):</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {missingInformation.map((info, i) => (
                  <li key={i}>{info}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <div style={{
            fontSize: '11px',
            color: '#64748b',
            lineHeight: 1.4,
            borderTop: '1px dashed #e2e8f0',
            paddingTop: '8px'
          }}>
            <strong>FIN-01 Transparency Disclaimer:</strong> {disclaimer || 'Treatment cost estimated based on published benchmark ranges. Potentially covered amount is an estimate and cannot be guaranteed by SehatSure.'}
          </div>
        </div>
      )}
    </div>
  );
}
