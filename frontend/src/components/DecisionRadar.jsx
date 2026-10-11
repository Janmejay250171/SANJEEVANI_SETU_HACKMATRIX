import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, Info } from 'lucide-react';

/**
 * SehatSure Decision Radar
 * Visualizes the 4 deterministic scoring pillars:
 * 1. Coverage & Network Fit (50%)
 * 2. Patient Out-of-Pocket Fit (25%)
 * 3. Hospital Accreditation & Type Fit (15%)
 * 4. Room & Co-Pay Clause Fit (10%)
 * 
 * Grounded strictly in verified calculation data.
 */
export default function DecisionRadar({
  score,
  networkStatus = 'unknown',
  showDetails = true
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(timer);
  }, []);

  // Safe numeric extraction
  const coverageFit = Math.min(100, Math.max(0, Number(score?.coverageFit ?? 70)));
  const patientCostFit = Math.min(100, Math.max(0, Number(score?.patientCostFit ?? 70)));
  const hospitalTypeScore = Math.min(100, Math.max(0, Number(score?.hospitalTypeScore ?? 70)));
  const coPayFit = Math.min(100, Math.max(0, Number(score?.coPayFit ?? 70)));

  const finalScore = Number(score?.granularScore ?? score?.finalScore ?? 0);
  const finalScoreDisplay = finalScore.toFixed(1);

  // Radar geometry
  const size = 260;
  const center = size / 2;
  const maxRadius = 88;

  // 4 Axes: Top, Right, Bottom, Left
  // Angles in radians (-PI/2 = top, 0 = right, PI/2 = bottom, PI = left)
  const axes = [
    { label: 'Coverage Fit', weight: '50%', value: coverageFit, angle: -Math.PI / 2, color: '#0B746E' },
    { label: 'Cost Fit', weight: '25%', value: patientCostFit, angle: 0, color: '#10B981' },
    { label: 'Facility Fit', weight: '15%', value: hospitalTypeScore, angle: Math.PI / 2, color: '#0284C7' },
    { label: 'Co-Pay Fit', weight: '10%', value: coPayFit, angle: Math.PI, color: '#8B5CF6' }
  ];

  // Helper to compute (x, y) for an axis and magnitude
  const getPoint = (angle, pct) => {
    const r = (pct / 100) * maxRadius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  // Polygon points
  const polygonPoints = axes
    .map((ax) => {
      const pt = getPoint(ax.angle, mounted ? ax.value : 0);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  // Circular score ring computation
  const ringRadius = 40;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - ((mounted ? finalScore : 0) / 100) * circumference;

  let ringColor = '#10B981'; // Green for high fit
  let ringBg = '#ECFDF5';
  let tierLabel = 'High Policy Fit';

  if (finalScore < 60) {
    ringColor = '#DC2626';
    ringBg = '#FEF2F2';
    tierLabel = 'Limited Fit';
  } else if (finalScore < 78) {
    ringColor = '#D97706';
    ringBg = '#FFFBEB';
    tierLabel = 'Moderate Fit';
  }

  return (
    <div className="decision-radar-container">
      <div className="decision-radar-header">
        <div className="decision-radar-title-group">
          <span className="radar-badge">Deterministic 4-Pillar Model</span>
          <h4 className="radar-title">SehatSure Decision Radar</h4>
        </div>
        <div className="decision-radar-meta">
          <span className="radar-heurisic-tag">
            <Info size={12} />
            <span>Mathematical Policy Match</span>
          </span>
        </div>
      </div>

      <div className="decision-radar-visual-grid">
        {/* SVG 4-Axis Radar Chart */}
        <div className="radar-chart-wrapper">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="radar-svg"
            role="img"
            aria-label={`Decision Radar showing Coverage ${coverageFit}%, Cost ${patientCostFit}%, Facility ${hospitalTypeScore}%, Co-pay ${coPayFit}%`}
          >
            {/* Concentric reference grid circles */}
            {[25, 50, 75, 100].map((pct) => (
              <circle
                key={pct}
                cx={center}
                cy={center}
                r={(pct / 100) * maxRadius}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray={pct === 100 ? 'none' : '3,3'}
              />
            ))}

            {/* Grid axis lines */}
            {axes.map((ax, idx) => {
              const edgePt = getPoint(ax.angle, 100);
              return (
                <line
                  key={idx}
                  x1={center}
                  y1={center}
                  x2={edgePt.x}
                  y2={edgePt.y}
                  stroke="#CBD5E1"
                  strokeWidth="1"
                />
              );
            })}

            {/* Data Polygon */}
            <polygon
              points={polygonPoints}
              fill="rgba(54, 214, 208, 0.22)"
              stroke="#0B746E"
              strokeWidth="2.5"
              strokeLinejoin="round"
              className="radar-polygon"
            />

            {/* Vertex dots */}
            {axes.map((ax, idx) => {
              const pt = getPoint(ax.angle, mounted ? ax.value : 0);
              return (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="4.5"
                    fill="#FFFFFF"
                    stroke={ax.color}
                    strokeWidth="2.5"
                    className="radar-dot"
                  />
                  {/* Subtle inner center */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="2"
                    fill={ax.color}
                  />
                </g>
              );
            })}

            {/* Center origin dot */}
            <circle cx={center} cy={center} r="2.5" fill="#94A3B8" />

            {/* Labels on SVG perimeter */}
            {/* Top Label */}
            <text
              x={center}
              y={center - maxRadius - 12}
              textAnchor="middle"
              className="radar-label"
              fill="#071B2C"
              fontWeight="700"
              fontSize="10.5"
            >
              Coverage (50%)
            </text>
            {/* Right Label */}
            <text
              x={center + maxRadius + 10}
              y={center + 4}
              textAnchor="start"
              className="radar-label"
              fill="#071B2C"
              fontWeight="700"
              fontSize="10.5"
            >
              Cost (25%)
            </text>
            {/* Bottom Label */}
            <text
              x={center}
              y={center + maxRadius + 18}
              textAnchor="middle"
              className="radar-label"
              fill="#071B2C"
              fontWeight="700"
              fontSize="10.5"
            >
              Facility (15%)
            </text>
            {/* Left Label */}
            <text
              x={center - maxRadius - 10}
              y={center + 4}
              textAnchor="end"
              className="radar-label"
              fill="#071B2C"
              fontWeight="700"
              fontSize="10.5"
            >
              Co-Pay (10%)
            </text>
          </svg>
        </div>

        {/* Circular Overall Score Meter */}
        <div className="radar-score-summary">
          <div className="score-ring-wrapper">
            <svg
              width="104"
              height="104"
              viewBox="0 0 104 104"
              className="score-ring-svg"
            >
              <circle
                cx="52"
                cy="52"
                r={ringRadius}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="7"
              />
              <circle
                cx="52"
                cy="52"
                r={ringRadius}
                fill="none"
                stroke={ringColor}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform="rotate(-90 52 52)"
                style={{
                  transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            </svg>
            <div className="score-ring-content">
              <span className="score-ring-number">{finalScoreDisplay}</span>
              <span className="score-ring-max">/ 100</span>
            </div>
          </div>

          <div className="score-tier-badge" style={{ background: ringBg, color: ringColor }}>
            {finalScore >= 78 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <span>{tierLabel}</span>
          </div>

          <div className="network-verification-status">
            <span className="network-status-label">Network Verification:</span>
            {networkStatus === 'verified' ? (
              <span className="status-pill status-pill-network">
                <ShieldCheck size={12} />
                <span>Empanelled Cashless</span>
              </span>
            ) : networkStatus === 'unverified' ? (
              <span className="status-pill status-pill-non-network">
                <span>Reimbursement Basis</span>
              </span>
            ) : (
              <span className="status-pill status-pill-unknown">
                <span>Network Unverified</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4 Pillar Numerical Breakdown Chips */}
      {showDetails && (
        <div className="radar-pillars-grid">
          <div className="radar-pillar-chip">
            <div className="pillar-chip-head">
              <span className="pillar-dot" style={{ background: '#0B746E' }} />
              <span className="pillar-name">Coverage & Network</span>
            </div>
            <div className="pillar-chip-val">
              <strong>{coverageFit}</strong>
              <span className="pillar-max">/ 100</span>
              <span className="pillar-pts">(+{(coverageFit * 0.5).toFixed(1)} pts)</span>
            </div>
          </div>

          <div className="radar-pillar-chip">
            <div className="pillar-chip-head">
              <span className="pillar-dot" style={{ background: '#10B981' }} />
              <span className="pillar-name">Patient Cost Fit</span>
            </div>
            <div className="pillar-chip-val">
              <strong>{patientCostFit}</strong>
              <span className="pillar-max">/ 100</span>
              <span className="pillar-pts">(+{(patientCostFit * 0.25).toFixed(1)} pts)</span>
            </div>
          </div>

          <div className="radar-pillar-chip">
            <div className="pillar-chip-head">
              <span className="pillar-dot" style={{ background: '#0284C7' }} />
              <span className="pillar-name">Facility & Accreditation</span>
            </div>
            <div className="pillar-chip-val">
              <strong>{hospitalTypeScore}</strong>
              <span className="pillar-max">/ 100</span>
              <span className="pillar-pts">(+{(hospitalTypeScore * 0.15).toFixed(1)} pts)</span>
            </div>
          </div>

          <div className="radar-pillar-chip">
            <div className="pillar-chip-head">
              <span className="pillar-dot" style={{ background: '#8B5CF6' }} />
              <span className="pillar-name">Room & Co-Pay Clause</span>
            </div>
            <div className="pillar-chip-val">
              <strong>{coPayFit}</strong>
              <span className="pillar-max">/ 100</span>
              <span className="pillar-pts">(+{(coPayFit * 0.1).toFixed(1)} pts)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
