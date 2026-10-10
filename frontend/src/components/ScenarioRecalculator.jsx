import React, { useState } from 'react';
import { Sliders, RefreshCw, ArrowRight, ShieldAlert, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { recalculateScenario } from '../services/hospitalApi';

export default function ScenarioRecalculator({
  policy,
  selectedProcedure,
  selectedSpecialty,
  selectedHospitalName,
  selectedHospital,
  selectedCity,
  initialRoomType = 'General Ward',
  initialIsNetwork = true,
  onScenarioApplied
}) {
  const [roomType, setRoomType] = useState(initialRoomType);
  const [isNetwork, setIsNetwork] = useState(initialIsNetwork);
  const [loading, setLoading] = useState(false);
  const [scenarioDiff, setScenarioDiff] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const effectiveHospitalName = selectedHospitalName || selectedHospital?.hospital_name || selectedHospital?.name || '';
  const effectiveCity = selectedCity || selectedHospital?.city || '';
  const effectiveSpecialty = selectedSpecialty || selectedHospital?.specialty || '';

  const handleSimulate = async (newRoom, newNetwork) => {
    setRoomType(newRoom);
    setIsNetwork(newNetwork);
    setLoading(true);

    try {
      const data = await recalculateScenario({
        baseline: {
          hospitalName: effectiveHospitalName,
          city: effectiveCity,
          procedure: selectedProcedure,
          specialty: effectiveSpecialty,
          roomType: initialRoomType,
          networkStatus: initialIsNetwork ? 'verified' : 'no_match'
        },
        modified: {
          hospitalName: effectiveHospitalName,
          city: effectiveCity,
          procedure: selectedProcedure,
          specialty: effectiveSpecialty,
          roomType: newRoom,
          networkStatus: newNetwork ? 'verified' : 'no_match'
        },
        policy
      });

      setScenarioDiff(data);
      if (onScenarioApplied) {
        onScenarioApplied({ roomType: newRoom, isNetwork: newNetwork, result: data });
      }
    } catch (err) {
      console.warn('Scenario recalculation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#f8fafc',
      border: '1.5px solid #cbd5e1',
      borderRadius: 'var(--radius-md, 8px)',
      padding: '16px',
      margin: '16px 0',
      fontSize: '13px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={18} style={{ color: '#0f766e' }} />
          <strong style={{ fontSize: '14px', color: '#0f172a' }}>
            Scenario Simulator: How Does More Information Change Your Estimate?
          </strong>
        </div>
        <button
          type="button"
          className="pill-btn pill-btn-ghost pill-btn-sm"
          onClick={() => setIsOpen(!isOpen)}
          style={{ fontSize: '12px', padding: '4px 10px' }}
        >
          {isOpen ? 'Hide Simulator ▲' : 'Open Simulator ▼'}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {(!selectedProcedure || selectedProcedure.toLowerCase().includes('all procedure')) ? (
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '12px 14px', color: '#0369a1', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} style={{ flexShrink: 0 }} />
              <span>Please select a procedure above to simulate room tariff and network scenario adjustments.</span>
            </div>
          ) : (
            <>
              <p style={{ margin: 0, color: '#475569', fontSize: '12.5px', lineHeight: 1.45 }}>
                FIN-01 Requirement: Demonstrates how treatment cost and out-of-pocket responsibility change dynamically when you provide specific room categories or network facility choices.
              </p>

          {/* Controls Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {/* Room Category Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                ROOM CATEGORY
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {['General Ward', 'Twin Sharing', 'Single Private Room'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSimulate(cat, isNetwork)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: roomType === cat ? '1.5px solid #0f766e' : '1px solid #cbd5e1',
                      background: roomType === cat ? '#f0fdfa' : '#ffffff',
                      color: roomType === cat ? '#0f766e' : '#334155',
                      fontWeight: roomType === cat ? 700 : 500,
                      cursor: 'pointer'
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Network Empanelment Toggle */}
            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                FACILITY NETWORK STATUS
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => handleSimulate(roomType, true)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: isNetwork ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                    background: isNetwork ? '#f0fdf4' : '#ffffff',
                    color: isNetwork ? '#166534' : '#334155',
                    fontWeight: isNetwork ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  ✓ Network (Cashless)
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulate(roomType, false)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '4px',
                    border: !isNetwork ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                    background: !isNetwork ? '#fef2f2' : '#ffffff',
                    color: !isNetwork ? '#991b1b' : '#334155',
                    fontWeight: !isNetwork ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  ✕ Non-Network (Reimbursement)
                </button>
              </div>
            </div>
          </div>

          {/* WHAT CHANGED HIGHLIGHT BOX (FIN-01 Phase 16) */}
          {scenarioDiff && (
            <div style={{
              background: '#ffffff',
              border: '1.5px solid #0f766e',
              borderRadius: '6px',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800, color: '#0f766e', fontSize: '13px' }}>
                <RefreshCw size={14} className={loading ? 'spin-icon' : ''} />
                WHAT CHANGED?
              </div>

              <div style={{ fontSize: '12.5px', color: '#1e293b', lineHeight: 1.45 }}>
                {scenarioDiff.explanation}
              </div>

              {scenarioDiff.modifiedEstimate && (
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  marginTop: '6px',
                  paddingTop: '8px',
                  borderTop: '1px solid #e2e8f0',
                  flexWrap: 'wrap'
                }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Updated Treatment Expense: </span>
                    <strong style={{ color: '#0f172a' }}>{scenarioDiff.modifiedEstimate.treatmentCostRange?.displayRange}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Potentially Covered: </span>
                    <strong style={{ color: scenarioDiff.modifiedEstimate.coveredReliable ? '#16a34a' : '#b45309' }}>
                      {scenarioDiff.modifiedEstimate.coveredReliable && scenarioDiff.modifiedEstimate.potentiallyCoveredRange
                        ? scenarioDiff.modifiedEstimate.potentiallyCoveredRange.displayRange
                        : 'Unable to reliably estimate'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Patient OOP Responsibility: </span>
                    <strong style={{ color: scenarioDiff.modifiedEstimate.oopReliable ? '#b45309' : '#94a3b8' }}>
                      {scenarioDiff.modifiedEstimate.oopReliable && scenarioDiff.modifiedEstimate.estimatedPatientOopRange
                        ? scenarioDiff.modifiedEstimate.estimatedPatientOopRange.displayRange
                        : 'Unable to reliably estimate'}
                    </strong>
                  </div>
                </div>
              )}

              {/* ML Pattern Model Scenario Impact */}
              {scenarioDiff.mlScenarioComparison && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12px', color: '#0f766e' }}>
                      <Sparkles size={14} />
                      ML Pattern Model Scenario Impact
                    </div>
                    <span style={{ fontSize: '10px', padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontWeight: 600 }}>
                      Model-Derived (Non-Causal)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px', marginBottom: '6px' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Baseline ML Est.: </span>
                      <strong style={{ color: '#0f172a' }}>₹{Math.round(scenarioDiff.mlScenarioComparison.baselinePrediction).toLocaleString('en-IN')}</strong>
                    </div>
                    <ArrowRight size={14} style={{ color: '#94a3b8' }} />
                    <div>
                      <span style={{ color: '#64748b' }}>Scenario ML Est.: </span>
                      <strong style={{ color: '#0f172a' }}>₹{Math.round(scenarioDiff.mlScenarioComparison.scenarioPrediction).toLocaleString('en-IN')}</strong>
                    </div>
                    <div style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      background: scenarioDiff.mlScenarioComparison.absoluteChange > 0 ? '#fef3c7' : scenarioDiff.mlScenarioComparison.absoluteChange < 0 ? '#dcfce7' : '#f1f5f9',
                      color: scenarioDiff.mlScenarioComparison.absoluteChange > 0 ? '#92400e' : scenarioDiff.mlScenarioComparison.absoluteChange < 0 ? '#166534' : '#475569'
                    }}>
                      {scenarioDiff.mlScenarioComparison.absoluteChange > 0 ? '+' : ''}
                      ₹{Math.round(scenarioDiff.mlScenarioComparison.absoluteChange).toLocaleString('en-IN')} ({scenarioDiff.mlScenarioComparison.percentChange > 0 ? '+' : ''}{scenarioDiff.mlScenarioComparison.percentChange}%)
                    </div>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#475569', fontStyle: 'italic', lineHeight: 1.4 }}>
                    {scenarioDiff.mlScenarioComparison.explanation}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '4px' }}>
                    Note: ML estimates treatment cost patterns. Insurance coverage and patient OOP remain strictly governed by the deterministic policy engine.
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
