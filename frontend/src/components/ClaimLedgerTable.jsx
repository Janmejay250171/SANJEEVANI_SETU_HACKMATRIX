import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  CheckCircle,
  XCircle,
  HelpCircle,
  Edit3,
  FileText,
  Percent,
  Layers,
  ArrowRight
} from 'lucide-react';

function formatInr(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0.00';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export default function ClaimLedgerTable({
  ledger,
  verifiedEvidence = [],
  onOpenEditModal,
  isReassessing = false
}) {
  const [expandedItemId, setExpandedItemId] = useState(null);

  if (!ledger || !ledger.itemizedLedger || ledger.itemizedLedger.length === 0) {
    return (
      <div className="ledger-empty-state">
        <FileText size={32} className="text-muted" />
        <p>No itemized ledger entries available. Please run claim assessment.</p>
      </div>
    );
  }

  const toggleExpand = (itemId) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  };

  const getEvidenceForItem = (itemId) => {
    return verifiedEvidence.find((ev) => ev.billItemId === itemId);
  };

  const getItemStage = (itemId) => {
    return ledger.itemStages?.find((stage) => stage.itemId === itemId);
  };

  const getStatusBadge = (entry) => {
    if (entry.reviewRequired || entry.status === 'PENDING_HUMAN_REVIEW') {
      return (
        <span className="ledger-badge badge-warning" title={entry.reviewReason || 'Human Review Required'}>
          <ShieldAlert size={13} />
          Review Required
        </span>
      );
    }
    if (entry.excludedNonPayablePaise > 0 && entry.insurerPayablePaise === 0) {
      return (
        <span className="ledger-badge badge-danger" title="Disallowed under policy exclusion or non-payable regulation">
          <XCircle size={13} />
          Excluded (100%)
        </span>
      );
    }
    if (entry.excludedNonPayablePaise > 0 || entry.proportionateDeductionPaise > 0 || entry.sublimitDisallowancePaise > 0) {
      return (
        <span className="ledger-badge badge-info" title="Partially admissible with policy adjustments">
          <Percent size={13} />
          Partial / Adjusted
        </span>
      );
    }
    return (
      <span className="ledger-badge badge-success" title="Fully admissible under policy terms">
        <CheckCircle size={13} />
        Admissible
      </span>
    );
  };

  return (
    <div className="claim-ledger-wrapper">
      <div className="table-responsive">
        <table className="claim-ledger-table" role="table" aria-label="Itemized Claim Adjustments Ledger">
          <thead>
            <tr>
              <th scope="col" style={{ width: '30%' }}>Item Description & Category</th>
              <th scope="col" className="text-right">Claimed</th>
              <th scope="col" className="text-right">Excluded</th>
              <th scope="col" className="text-right">Admissible</th>
              <th scope="col" className="text-right">Deductions</th>
              <th scope="col" className="text-right">Insurer Payable</th>
              <th scope="col" className="text-center">Status</th>
              <th scope="col" className="text-center" style={{ width: '8%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {ledger.itemizedLedger.map((entry) => {
              const isExpanded = expandedItemId === entry.itemId;
              const evidence = getEvidenceForItem(entry.itemId);
              const stage = getItemStage(entry.itemId);
              const totalDeductionsPaise =
                (entry.proportionateDeductionPaise || 0) + (entry.sublimitDisallowancePaise || 0);

              return (
                <React.Fragment key={entry.itemId}>
                  <tr className={`ledger-row ${isExpanded ? 'row-expanded' : ''}`}>
                    <td>
                      <div className="ledger-item-primary">
                        <span className="ledger-item-desc">{entry.originalDescription}</span>
                        <div className="ledger-item-meta">
                          <span className="category-pill">{entry.category.replace('_', ' ')}</span>
                          {entry.isUserCorrected && (
                            <span className="corrected-pill" title="Human-in-the-loop corrected line item">
                              User Corrected
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-right font-mono font-medium">
                      {formatInr(entry.claimedAmountPaise)}
                    </td>
                    <td className="text-right font-mono text-danger">
                      {entry.excludedNonPayablePaise > 0 ? `-${formatInr(entry.excludedNonPayablePaise)}` : '₹0.00'}
                    </td>
                    <td className="text-right font-mono text-muted">
                      {formatInr(entry.admissibleAmountPaise)}
                    </td>
                    <td className="text-right font-mono text-warning">
                      {totalDeductionsPaise > 0 ? `-${formatInr(totalDeductionsPaise)}` : '₹0.00'}
                    </td>
                    <td className="text-right font-mono font-semibold text-primary">
                      {formatInr(entry.insurerPayablePaise)}
                    </td>
                    <td className="text-center">{getStatusBadge(entry)}</td>
                    <td className="text-center">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-icon-toggle"
                          onClick={() => toggleExpand(entry.itemId)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? 'Hide clause details' : 'Inspect clause details'}
                          title="Inspect Clause Evidence"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {onOpenEditModal && (
                          <button
                            type="button"
                            className="btn-icon-edit"
                            onClick={() => onOpenEditModal(entry)}
                            title="Edit this item for safe reassessment"
                            aria-label={`Edit ${entry.originalDescription}`}
                            disabled={isReassessing}
                          >
                            <Edit3 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Item Inspection Drawer */}
                  {isExpanded && (
                    <tr className="ledger-detail-row">
                      <td colSpan={8}>
                        <div className="ledger-item-detail-card animate-fade-in">
                          <div className="detail-grid">
                            {/* Evidence & Grounded Citation */}
                            <div className="detail-col-evidence">
                              <div className="detail-col-header">
                                <FileText size={15} className="text-primary" />
                                <h4>Grounded Policy Clause Citation</h4>
                              </div>

                              {evidence && evidence.primaryClauseId ? (
                                <div className="evidence-citation-box">
                                  <div className="citation-meta">
                                    <span className="citation-id font-mono">
                                      Clause: {evidence.primaryClauseId}
                                    </span>
                                    <span className="citation-category">
                                      {evidence.verificationCategory || 'STANDARD'}
                                    </span>
                                  </div>

                                  {evidence.supportingClauses && evidence.supportingClauses[0] && (
                                    <blockquote className="citation-excerpt">
                                      "{evidence.supportingClauses[0].clauseText}"
                                    </blockquote>
                                  )}

                                  {evidence.exclusionClauses && evidence.exclusionClauses[0] && (
                                    <blockquote className="citation-excerpt excerpt-danger">
                                      "{evidence.exclusionClauses[0].clauseText}"
                                    </blockquote>
                                  )}

                                  <div className="citation-rationale">
                                    <span className="rationale-label">Reasoning:</span>
                                    <p className="rationale-text">
                                      {evidence.reasoning ||
                                        'Clause retrieved and verified against current policy terms and item description.'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="citation-unverified-box">
                                  <HelpCircle size={18} className="text-warning" />
                                  <div>
                                    <p className="unverified-text">
                                      No definitive policy clause match found for this item description.
                                    </p>
                                    <span className="unverified-note">
                                      Flagged for human adjudication to avoid unauthorized coverage or accidental exclusion.
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Item Calculation Trace & Waterfall */}
                            <div className="detail-col-trace">
                              <div className="detail-col-header">
                                <Layers size={15} className="text-primary" />
                                <h4>Item Calculation Waterfall</h4>
                              </div>

                              <div className="trace-steps-list">
                                <div className="trace-step-item">
                                  <span className="trace-label">1. Claimed Incurred:</span>
                                  <span className="trace-val font-mono">
                                    {formatInr(entry.claimedAmountPaise)}
                                  </span>
                                </div>

                                {entry.excludedNonPayablePaise > 0 && (
                                  <div className="trace-step-item text-danger">
                                    <span className="trace-label">2. Non-Payable / Excluded:</span>
                                    <span className="trace-val font-mono">
                                      -{formatInr(entry.excludedNonPayablePaise)}
                                    </span>
                                  </div>
                                )}

                                <div className="trace-step-item">
                                  <span className="trace-label">3. Admissible Base:</span>
                                  <span className="trace-val font-mono">
                                    {formatInr(entry.admissibleAmountPaise)}
                                  </span>
                                </div>

                                {entry.proportionateDeductionPaise > 0 && (
                                  <div className="trace-step-item text-warning">
                                    <span className="trace-label">4. Proportionate Room Deduction:</span>
                                    <span className="trace-val font-mono">
                                      -{formatInr(entry.proportionateDeductionPaise)}
                                    </span>
                                  </div>
                                )}

                                {entry.sublimitDisallowancePaise > 0 && (
                                  <div className="trace-step-item text-warning">
                                    <span className="trace-label">5. Sublimit Cap Deduction:</span>
                                    <span className="trace-val font-mono">
                                      -{formatInr(entry.sublimitDisallowancePaise)}
                                    </span>
                                  </div>
                                )}

                                <div className="trace-step-item item-total-step">
                                  <span className="trace-label font-semibold">Net Admissible to Claim:</span>
                                  <span className="trace-val font-mono font-bold text-primary">
                                    {formatInr(stage?.admissibleBeforeClaimLevelPaise ?? entry.insurerPayablePaise)}
                                  </span>
                                </div>
                              </div>

                              {entry.reviewReason && (
                                <div className="item-review-warning">
                                  <ShieldAlert size={14} className="text-warning" />
                                  <span>{entry.reviewReason}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
