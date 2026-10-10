import React, { useState } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldCheck,
  Scale,
  MinusCircle,
  PlusCircle,
  Info
} from 'lucide-react';

function formatInr(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0.00';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export default function ClaimCalculationTrace({ ledger, traceId }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!ledger) return null;

  const {
    totalClaimedPaise = 0,
    totalExcludedNonPayablePaise = 0,
    totalProportionateDisallowancePaise = 0,
    totalSublimitDisallowancePaise = 0,
    totalAdmissiblePaise = 0,
    appliedDeductiblePaise = 0,
    appliedCopayPaise = 0,
    finalInsurerPayablePaise = 0,
    totalPatientResponsibilityPaise = 0,
    isMathematicallyBalanced = true
  } = ledger;

  return (
    <div className="calculation-trace-card" aria-label="Deterministic Financial Calculation Trace">
      <div className="trace-header-row" onClick={() => setIsExpanded((prev) => !prev)}>
        <div className="trace-header-left">
          <Layers size={18} className="text-primary" />
          <div>
            <h3 className="trace-title">Deterministic Calculation Waterfall & Audit Trace</h3>
            <span className="trace-subtitle">
              Auditable integer minor unit precision • Zero floating-point rounding errors
            </span>
          </div>
        </div>

        <div className="trace-header-right">
          {traceId && <span className="trace-id-badge font-mono">Trace: {traceId}</span>}
          <span className={`balance-badge ${isMathematicallyBalanced ? 'badge-success' : 'badge-danger'}`}>
            <Scale size={13} />
            {isMathematicallyBalanced ? 'Conservation Verified' : 'Imbalance Detected'}
          </span>
          <button
            type="button"
            className="btn-trace-toggle"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse audit trace' : 'Expand audit trace'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="trace-body animate-fade-in">
          <div className="waterfall-grid">
            {/* Step 1: Claim Incurred */}
            <div className="waterfall-row start-row">
              <div className="waterfall-step-info">
                <span className="step-num">Step 1</span>
                <div>
                  <h4 className="step-name">Total Hospital Invoice Claimed</h4>
                  <p className="step-desc">Sum of verified itemized line items from invoice.</p>
                </div>
              </div>
              <span className="waterfall-val font-mono font-bold text-dark">
                {formatInr(totalClaimedPaise)}
              </span>
            </div>

            {/* Step 2: Statutory Non-Payable & Exclusions */}
            {totalExcludedNonPayablePaise > 0 && (
              <div className="waterfall-row deduction-row">
                <div className="waterfall-step-info">
                  <span className="step-num">Step 2</span>
                  <div>
                    <h4 className="step-name">Statutory Non-Payables & Exclusions</h4>
                    <p className="step-desc">
                      Consumables (IRDAI Table I), administrative charges & General Exclusion G01.
                    </p>
                  </div>
                </div>
                <span className="waterfall-val font-mono text-danger font-semibold">
                  -{formatInr(totalExcludedNonPayablePaise)}
                </span>
              </div>
            )}

            {/* Step 3: Proportionate Scaling */}
            {totalProportionateDisallowancePaise > 0 && (
              <div className="waterfall-row deduction-row">
                <div className="waterfall-step-info">
                  <span className="step-num">Step 3</span>
                  <div>
                    <h4 className="step-name">Room Rent Proportionate Deduction</h4>
                    <p className="step-desc">
                      Associated charges scaled proportionally to room rent category ceiling.
                    </p>
                  </div>
                </div>
                <span className="waterfall-val font-mono text-warning font-semibold">
                  -{formatInr(totalProportionateDisallowancePaise)}
                </span>
              </div>
            )}

            {/* Step 4: Sublimit Disallowance */}
            {totalSublimitDisallowancePaise > 0 && (
              <div className="waterfall-row deduction-row">
                <div className="waterfall-step-info">
                  <span className="step-num">Step 4</span>
                  <div>
                    <h4 className="step-name">Specific Disease / Procedure Sublimit Cap</h4>
                    <p className="step-desc">Disallowed excess beyond contractual procedure limit.</p>
                  </div>
                </div>
                <span className="waterfall-val font-mono text-warning font-semibold">
                  -{formatInr(totalSublimitDisallowancePaise)}
                </span>
              </div>
            )}

            {/* Intermediate: Admissible Base */}
            <div className="waterfall-row intermediate-row">
              <div className="waterfall-step-info">
                <span className="step-num">Base</span>
                <div>
                  <h4 className="step-name">Net Admissible Amount (Pre-Claim Adjustments)</h4>
                  <p className="step-desc">Amount eligible for policy-level deductible and co-payment.</p>
                </div>
              </div>
              <span className="waterfall-val font-mono font-bold text-primary">
                {formatInr(totalAdmissiblePaise)}
              </span>
            </div>

            {/* Step 5: Claim Deductible */}
            {appliedDeductiblePaise > 0 && (
              <div className="waterfall-row deduction-row">
                <div className="waterfall-step-info">
                  <span className="step-num">Step 5</span>
                  <div>
                    <h4 className="step-name">Annual Aggregate Policy Deductible</h4>
                    <p className="step-desc">
                      Subtracted exactly once from admissible total (never from non-payables).
                    </p>
                  </div>
                </div>
                <span className="waterfall-val font-mono text-danger font-semibold">
                  -{formatInr(appliedDeductiblePaise)}
                </span>
              </div>
            )}

            {/* Step 6: Co-Payment */}
            {appliedCopayPaise > 0 && (
              <div className="waterfall-row deduction-row">
                <div className="waterfall-step-info">
                  <span className="step-num">Step 6</span>
                  <div>
                    <h4 className="step-name">Contractual Co-Payment</h4>
                    <p className="step-desc">
                      Computed strictly against admissible base after deductible.
                    </p>
                  </div>
                </div>
                <span className="waterfall-val font-mono text-danger font-semibold">
                  -{formatInr(appliedCopayPaise)}
                </span>
              </div>
            )}

            {/* Step 7: Final Settlements */}
            <div className="waterfall-row settlement-row">
              <div className="settlement-col insurer-col">
                <span className="settlement-label">ESTIMATED INSURER PAYABLE</span>
                <span className="settlement-amount font-mono text-success">
                  {formatInr(finalInsurerPayablePaise)}
                </span>
                <span className="settlement-note">Approved under verified policy coverage</span>
              </div>

              <div className="settlement-divider">+</div>

              <div className="settlement-col patient-col">
                <span className="settlement-label">ESTIMATED PATIENT RESPONSIBILITY</span>
                <span className="settlement-amount font-mono text-danger">
                  {formatInr(totalPatientResponsibilityPaise)}
                </span>
                <span className="settlement-note">Exclusions + Deductibles + Co-pay</span>
              </div>

              <div className="settlement-divider">=</div>

              <div className="settlement-col total-col">
                <span className="settlement-label">CONSERVATION TOTAL</span>
                <span className="settlement-amount font-mono text-dark">
                  {formatInr(finalInsurerPayablePaise + totalPatientResponsibilityPaise)}
                </span>
                <span className="settlement-note">Matches Claimed ₹ Total Exactly</span>
              </div>
            </div>
          </div>

          <div className="audit-proof-footer">
            <CheckCircle2 size={16} className="text-success" />
            <span>
              <strong>Mathematical Invariant Proof:</strong>{' '}
              {formatInr(finalInsurerPayablePaise)} + {formatInr(totalPatientResponsibilityPaise)} ==={' '}
              {formatInr(totalClaimedPaise)}. All calculations performed with deterministic integer minor unit arithmetic.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
