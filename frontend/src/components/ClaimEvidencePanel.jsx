import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  FileText,
  Search,
  ExternalLink,
  BookOpen,
  Info
} from 'lucide-react';

export default function ClaimEvidencePanel({
  verifiedEvidence = [],
  policyVersionId = null,
  amendmentIds = []
}) {
  const [activeTab, setActiveTab] = useState('supporting');

  // Flatten evidence across all items
  const supportingList = [];
  const exclusionList = [];
  const reviewList = [];

  for (const item of verifiedEvidence) {
    if (item.supportingClauses) {
      for (const cl of item.supportingClauses) {
        supportingList.push({
          ...cl,
          billItemId: item.billItemId,
          originalDescription: item.originalDescription,
          reasoning: item.reasoning
        });
      }
    }

    if (item.exclusionClauses) {
      for (const cl of item.exclusionClauses) {
        exclusionList.push({
          ...cl,
          billItemId: item.billItemId,
          originalDescription: item.originalDescription,
          reasoning: item.reasoning
        });
      }
    }

    if (item.verificationCategory === 'INSUFFICIENT_EVIDENCE' || item.verificationCategory === 'CONFLICTING') {
      reviewList.push(item);
    }
  }

  return (
    <div className="claim-evidence-panel" aria-label="Policy Evidence and Citation Transparency">
      <div className="evidence-panel-header">
        <div className="panel-title-group">
          <BookOpen size={18} className="text-primary" />
          <h3 className="panel-title">Clause Evidence & Uncertainty Audit</h3>
        </div>
        <div className="panel-version-indicator">
          <span className="version-tag font-mono">
            Version: {policyVersionId || 'RESOLVED_BASE'}
          </span>
          {amendmentIds && amendmentIds.length > 0 && (
            <span className="amendment-tag font-mono">
              +{amendmentIds.length} Endorsement(s)
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="evidence-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'supporting'}
          className={`evidence-tab-btn ${activeTab === 'supporting' ? 'active' : ''}`}
          onClick={() => setActiveTab('supporting')}
        >
          <ShieldCheck size={15} />
          Supporting Clauses ({supportingList.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'exclusion'}
          className={`evidence-tab-btn ${activeTab === 'exclusion' ? 'active' : ''}`}
          onClick={() => setActiveTab('exclusion')}
        >
          <AlertOctagon size={15} />
          Adverse & Exclusions ({exclusionList.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'review'}
          className={`evidence-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          <ShieldAlert size={15} />
          Ambiguities & Review Triggers ({reviewList.length})
        </button>
      </div>

      {/* Tab Panels */}
      <div className="evidence-tab-content">
        {activeTab === 'supporting' && (
          <div className="clause-cards-list">
            {supportingList.length === 0 ? (
              <p className="evidence-empty-text">No explicit supportive policy clauses applied to this claim.</p>
            ) : (
              supportingList.map((cl, idx) => (
                <div key={`${cl.clauseId}_${idx}`} className="clause-evidence-card card-support">
                  <div className="clause-card-top">
                    <span className="clause-id-badge font-mono">ID: {cl.clauseId}</span>
                    <span className="clause-target-item">Matched to: "{cl.originalDescription}"</span>
                  </div>
                  <blockquote className="clause-verbatim-quote">
                    "{cl.clauseText}"
                  </blockquote>
                  <div className="clause-card-footer">
                    <div className="relevance-info">
                      <span className="relevance-badge">
                        Retrieval Score: {cl.score ? (cl.score * 100).toFixed(1) + '%' : 'Verified'}
                      </span>
                      <span className="relevance-note">
                        (Algorithmic relevance ranking; not coverage guarantee)
                      </span>
                    </div>
                    {cl.sourceDocumentRef && (
                      <span className="source-doc-ref font-mono">
                        Doc: {cl.sourceDocumentRef}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'exclusion' && (
          <div className="clause-cards-list">
            {exclusionList.length === 0 ? (
              <p className="evidence-empty-text">No exclusion clauses applied to this claim assessment.</p>
            ) : (
              exclusionList.map((cl, idx) => (
                <div key={`${cl.clauseId}_${idx}`} className="clause-evidence-card card-adverse">
                  <div className="clause-card-top">
                    <span className="clause-id-badge badge-danger font-mono">ID: {cl.clauseId}</span>
                    <span className="clause-target-item">Item: "{cl.originalDescription}"</span>
                  </div>
                  <blockquote className="clause-verbatim-quote quote-danger">
                    "{cl.clauseText}"
                  </blockquote>
                  <div className="clause-card-footer">
                    <span className="exclusion-reason-text">
                      <strong>Legal Effect:</strong> Disallows claim line item under governing policy exclusion terms.
                    </span>
                    {cl.sourceDocumentRef && (
                      <span className="source-doc-ref font-mono">Doc: {cl.sourceDocumentRef}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'review' && (
          <div className="clause-cards-list">
            {reviewList.length === 0 ? (
              <div className="no-review-notice">
                <ShieldCheck size={20} className="text-success" />
                <p>Zero ungrounded or ambiguous line items detected. All items resolved to explicit policy terms.</p>
              </div>
            ) : (
              reviewList.map((item, idx) => (
                <div key={`${item.billItemId}_${idx}`} className="clause-evidence-card card-warning">
                  <div className="clause-card-top">
                    <span className="clause-id-badge badge-warning font-mono">
                      Category: {item.verificationCategory}
                    </span>
                    <span className="clause-target-item">Item: "{item.originalDescription}"</span>
                  </div>
                  <div className="review-reason-box">
                    <Info size={16} className="text-warning" />
                    <p className="review-reason-msg">{item.reasoning}</p>
                  </div>
                  <p className="safety-guarantee-note">
                    <strong>Ambiguity Guardrail:</strong> SehatSure strictly refuses to guess or assume coverage for ungrounded treatments. Manual human underwriting review is required.
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
