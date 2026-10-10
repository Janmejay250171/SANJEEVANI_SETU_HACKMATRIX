import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Scale,
  Calendar,
  Building,
  RefreshCw,
  Plus,
  CheckCircle2,
  FileCheck,
  Info,
  ChevronRight,
  GitCompare
} from 'lucide-react';
import {
  uploadBillPdf,
  getDemoClaimScenarios,
  createClaimAssessment,
  getClaimAssessment,
  getClaimLedger,
  getClaimEvidence,
  updateClaimItem,
  reassessClaim,
  compareClaimAssessments
} from '../services/api';
import ClaimScenarioSelector from '../components/ClaimScenarioSelector';
import ClaimLedgerTable from '../components/ClaimLedgerTable';
import ClaimEvidencePanel from '../components/ClaimEvidencePanel';
import ClaimCalculationTrace from '../components/ClaimCalculationTrace';
import ClaimComparisonDiff from '../components/ClaimComparisonDiff';
import ClaimItemEditModal from '../components/ClaimItemEditModal';

function formatInr(paise) {
  if (paise === null || paise === undefined || isNaN(paise)) return '₹0.00';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export default function ClaimAdjudicationPage({
  activePolicy = null,
  onBackToPolicy = null,
  onGoToUpload = null
}) {
  // Scenarios & Inputs
  const [scenarios, setScenarios] = useState([]);
  const [activeScenarioId, setActiveScenarioId] = useState('scenario-1-supported');
  const [treatmentDate, setTreatmentDate] = useState('2025-04-10');
  const [policyFamilyId, setPolicyFamilyId] = useState('syn_fam_health_01');
  const [hospitalName, setHospitalName] = useState('Apollo Hospitals Bengaluru');

  // Staged Bill & Line Items
  const [stagedBill, setStagedBill] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [isUploadingBill, setIsUploadingBill] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Active Claim & Assessment State
  const [currentClaim, setCurrentClaim] = useState(null);
  const [currentLedger, setCurrentLedger] = useState(null);
  const [currentEvidence, setCurrentEvidence] = useState([]);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentError, setAssessmentError] = useState(null);

  // Reassessment & Comparison
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isReassessing, setIsReassessing] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 1. Fetch Demo Scenarios on mount
  useEffect(() => {
    getDemoClaimScenarios()
      .then((data) => {
        setScenarios(data);
        if (data && data.length > 0) {
          // Pre-load default Scenario 1
          loadScenario(data[0]);
        }
      })
      .catch((err) => {
        console.warn('Could not load demo scenarios:', err);
      });
  }, []);

  // Sync activePolicy if provided
  useEffect(() => {
    if (activePolicy && activePolicy.policyId) {
      setPolicyFamilyId(activePolicy.policyId);
    }
  }, [activePolicy]);

  const loadScenario = async (sc) => {
    setActiveScenarioId(sc.id);
    const dateToUse = sc.treatmentDate || sc.treatmentDatePre || '2025-04-10';
    setTreatmentDate(dateToUse);
    setPolicyFamilyId(sc.policyFamilyId || 'syn_fam_health_01');
    setHospitalName(sc.hospitalName || 'Apollo Hospitals Bengaluru');
    setComparisonResult(null);
    setAssessmentError(null);
    setUploadError(null);

    // Convert items into structured ClaimLineItem format
    const convertedItems = sc.billItems.map((item, idx) => ({
      itemId: item.itemId || `item_${idx + 1}`,
      originalDescription: item.originalDescription,
      category: item.category,
      quantity: item.quantity || 1,
      unitPricePaise: item.unitPricePaise || Math.round(item.claimedAmountRupees * 100),
      claimedAmountPaise: item.claimedAmountPaise || Math.round(item.claimedAmountRupees * 100),
      currency: 'INR',
      provenance: {
        sourceType: 'STRUCTURED_JSON_TEMPLATE',
        rawExtractedText: item.originalDescription,
        extractedTimestamp: new Date().toISOString(),
        confidenceScore: 1.0
      },
      classificationStatus: 'AUTOMATIC_EXACT',
      reviewFlags: sc.category === 'REVIEW_REQUIRED' ? ['UNVERIFIED_THERAPY'] : [],
      isNonPayableByRegulation: false
    }));

    const totalPaise = convertedItems.reduce((acc, it) => acc + it.claimedAmountPaise, 0);

    const billObj = {
      billId: sc.billId || `bill_${Date.now()}`,
      hospitalName: sc.hospitalName || 'Apollo Hospitals Bengaluru',
      billDate: dateToUse,
      originalBillTotalPaise: totalPaise,
      calculatedItemsTotalPaise: totalPaise,
      reconciliationDifferencePaise: 0,
      reconciliationStatus: 'RECONCILED',
      currency: 'INR',
      lineItems: convertedItems,
      uploadedAt: new Date().toISOString(),
      extractedAt: new Date().toISOString()
    };

    setStagedBill(billObj);
    setLineItems(convertedItems);

    // Automatically trigger assessment for the selected scenario
    await runAssessment(billObj, sc.policyFamilyId || 'syn_fam_health_01', dateToUse);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBill(true);
    setUploadError(null);
    setActiveScenarioId(null);
    setComparisonResult(null);

    try {
      const extracted = await uploadBillPdf(file);
      const billObj = {
        billId: extracted.billId || `bill_${Date.now()}`,
        hospitalName: extracted.hospitalName || 'Hospital Provider',
        billDate: extracted.billDate || treatmentDate,
        originalBillTotalPaise: extracted.originalBillTotalPaise,
        calculatedItemsTotalPaise: extracted.calculatedItemsTotalPaise,
        reconciliationDifferencePaise: extracted.reconciliationDifferencePaise,
        reconciliationStatus: extracted.reconciliationStatus,
        currency: 'INR',
        lineItems: extracted.lineItems,
        uploadedAt: new Date().toISOString(),
        extractedAt: new Date().toISOString()
      };

      setStagedBill(billObj);
      setLineItems(extracted.lineItems);
      if (extracted.hospitalName) setHospitalName(extracted.hospitalName);
      if (extracted.billDate) setTreatmentDate(extracted.billDate);

      // Run assessment on extracted invoice
      await runAssessment(billObj, policyFamilyId, extracted.billDate || treatmentDate);
    } catch (err) {
      setUploadError(err.message || 'Failed to extract itemized bill PDF.');
    } finally {
      setIsUploadingBill(false);
    }
  };

  const runAssessment = async (billObj, famId, tDate) => {
    setIsAssessing(true);
    setAssessmentError(null);

    try {
      const assessment = await createClaimAssessment({
        policyFamilyId: famId,
        policyId: activePolicy?._id || null,
        treatmentDate: tDate,
        bill: billObj
      });

      setCurrentClaim(assessment);
      if (assessment.ledger) setCurrentLedger(assessment.ledger);

      // Fetch evidence citations
      try {
        const evidenceData = await getClaimEvidence(assessment.claimId);
        setCurrentEvidence(evidenceData.verifiedItemEvidence || []);
      } catch (evErr) {
        console.warn('Could not fetch evidence citations:', evErr);
      }
    } catch (err) {
      setAssessmentError(err.message || 'Failed to execute claim adjudication.');
    } finally {
      setIsAssessing(false);
    }
  };

  // Safe Human-in-the-Loop Reassessment
  const handleSaveItemEdit = async (updatedItemData) => {
    if (!currentClaim) return;
    setIsSavingEdit(true);

    try {
      // 1. Update line item via backend
      await updateClaimItem(currentClaim.claimId, updatedItemData.itemId, {
        originalDescription: updatedItemData.description,
        claimedAmountPaise: updatedItemData.claimedAmountPaise,
        category: updatedItemData.category,
        correctionReason: updatedItemData.correctionNote || 'Manual adjustment by user'
      });

      // 2. Trigger safe reassessment
      const reassessResult = await reassessClaim(
        currentClaim.claimId,
        `Line item corrected: ${updatedItemData.description} (${formatInr(updatedItemData.claimedAmountPaise)})`
      );

      // 3. Update active assessment state
      setCurrentClaim(reassessResult.current);
      if (reassessResult.current.ledger) {
        setCurrentLedger(reassessResult.current.ledger);
      }
      setComparisonResult(reassessResult.comparison);

      // Refresh evidence
      const evData = await getClaimEvidence(currentClaim.claimId);
      setCurrentEvidence(evData.verifiedItemEvidence || []);

      setEditingItem(null);
    } catch (err) {
      alert(`Reassessment failed: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleResetToUpload = () => {
    setActiveScenarioId(null);
    setCurrentClaim(null);
    setCurrentLedger(null);
    setComparisonResult(null);
    setStagedBill(null);
    setLineItems([]);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ADJUDICATED':
        return 'badge-success';
      case 'PENDING_HUMAN_REVIEW':
        return 'badge-warning';
      case 'INCOMPLETE':
      case 'REJECTED':
        return 'badge-danger';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <div className="claim-page-container animate-fade-in">
      {/* Header & Product Banner */}
      <section className="claim-hero-section">
        <div className="claim-hero-badge">
          <ShieldCheck size={16} />
          FIN-01 Insurance Coverage & Treatment Cost Intelligence
        </div>
        <h1 className="claim-hero-title">Itemized Claim Adjudication & Clause Intelligence</h1>
        <p className="claim-hero-desc">
          Automated clause-level policy matching, statutory non-payable exclusion detection, sublimit enforcement, and auditable ledger calculations for health insurance bills.
        </p>

        <div className="regulatory-notice-banner">
          <Info size={16} className="text-primary flex-shrink-0" />
          <span>
            <strong>Pre-Settlement Transparency Engine:</strong> All values are auditable intelligence estimates computed deterministically from contractual policy terms and itemized invoice line items. This does not constitute an insurer payment guarantee.
          </span>
        </div>
      </section>

      {/* Demonstration Scenario Picker */}
      <ClaimScenarioSelector
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        onSelectScenario={loadScenario}
        onResetToUpload={handleResetToUpload}
      />

      {/* Main Workflow Grid */}
      <div className="claim-workspace-grid">
        {/* Section A: Bill Input & Ingestion Card */}
        <section className="workspace-card" aria-label="Invoice Configuration">
          <div className="card-header-flex">
            <div className="header-title-box">
              <Building size={18} className="text-primary" />
              <h3>1. Bill Ingestion & Input Verification</h3>
            </div>
            {stagedBill && (
              <span className={`reconciliation-pill pill-${stagedBill.reconciliationStatus?.toLowerCase()}`}>
                {stagedBill.reconciliationStatus}
              </span>
            )}
          </div>

          <div className="card-body">
            <div className="form-row-3">
              <div className="form-field">
                <label className="form-label">Hospital Provider</label>
                <input
                  type="text"
                  className="form-input"
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. Apollo Hospitals"
                />
              </div>

              <div className="form-field">
                <label className="form-label">Treatment / Admission Date</label>
                <input
                  type="date"
                  className="form-input font-mono"
                  value={treatmentDate}
                  onChange={(e) => {
                    setTreatmentDate(e.target.value);
                    if (stagedBill) {
                      runAssessment(stagedBill, policyFamilyId, e.target.value);
                    }
                  }}
                  required
                />
              </div>

              <div className="form-field">
                <label className="form-label">Policy Identifier</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={policyFamilyId}
                  onChange={(e) => setPolicyFamilyId(e.target.value)}
                  placeholder="e.g. syn_fam_health_01"
                />
              </div>
            </div>

            {/* Upload Zone */}
            <div className="bill-upload-dropzone">
              <input
                id="bill-file-input"
                type="file"
                accept=".pdf"
                className="hidden-file-input"
                onChange={handleFileUpload}
                disabled={isUploadingBill}
              />
              <label htmlFor="bill-file-input" className="dropzone-label">
                <UploadCloud size={32} className="text-primary" />
                <span className="dropzone-text">
                  {isUploadingBill
                    ? 'Extracting and parsing itemized PDF invoice...'
                    : 'Click to upload itemized hospital bill (PDF) or drag and drop'}
                </span>
                <span className="dropzone-sub">
                  Supports standard Indian hospital tax invoices & itemized discharge bills
                </span>
              </label>
            </div>

            {uploadError && (
              <div className="error-banner animate-fade-in">
                <AlertTriangle size={16} />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Extracted Bill Quick Summary */}
            {stagedBill && (
              <div className="staged-bill-summary">
                <div className="bill-metric">
                  <span className="metric-label">Detected Bill Total</span>
                  <span className="metric-val font-mono">{formatInr(stagedBill.originalBillTotalPaise)}</span>
                </div>
                <div className="bill-metric">
                  <span className="metric-label">Calculated Items Total</span>
                  <span className="metric-val font-mono">{formatInr(stagedBill.calculatedItemsTotalPaise)}</span>
                </div>
                <div className="bill-metric">
                  <span className="metric-label">Extracted Items Count</span>
                  <span className="metric-val font-bold">{stagedBill.lineItems?.length || 0} Line Items</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section B: Policy Version Applicability Resolution */}
        {currentClaim && (
          <section className="workspace-card" aria-label="Policy Version Applicability">
            <div className="card-header-flex">
              <div className="header-title-box">
                <Calendar size={18} className="text-primary" />
                <h3>2. Policy Version & Endorsement Applicability</h3>
              </div>
              <span className="badge-primary font-mono text-sm">
                Treatment Date: {currentClaim.treatmentDate}
              </span>
            </div>

            <div className="card-body">
              <div className="version-resolution-box">
                <div className="resolution-col">
                  <span className="res-label">Selected Base Policy Version:</span>
                  <span className="res-value font-mono font-semibold text-primary">
                    {currentClaim.selectedPolicyVersionId || 'No matching policy version'}
                  </span>
                  <span className="res-note">
                    Evaluated contractually against admission date {currentClaim.treatmentDate}
                  </span>
                </div>

                <div className="resolution-col">
                  <span className="res-label">Applicable Amendments / Endorsements:</span>
                  {currentClaim.applicableAmendmentIds && currentClaim.applicableAmendmentIds.length > 0 ? (
                    <div className="amendments-tag-list">
                      {currentClaim.applicableAmendmentIds.map((amId) => (
                        <span key={amId} className="amendment-pill font-mono">
                          Endorsement: {amId}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted text-sm">No post-issue endorsements applicable for this date.</span>
                  )}
                </div>
              </div>

              {currentClaim.reviewStatus !== 'NOT_REQUIRED' && (
                <div className="review-alert-box animate-fade-in">
                  <ShieldAlert size={18} className="text-warning flex-shrink-0" />
                  <div>
                    <h4 className="alert-title">Adjudication Review Actions Required</h4>
                    <ul className="alert-reasons-list">
                      {currentClaim.reviewReasons?.map((r, idx) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section C: Executive Financial Adjudication Summary */}
        {currentLedger && (
          <section className="workspace-card financial-summary-card" aria-label="Financial Adjudication Summary">
            <div className="card-header-flex">
              <div className="header-title-box">
                <Scale size={18} className="text-primary" />
                <h3>3. Financial Adjudication Summary</h3>
              </div>
              <span className={`status-pill ${getStatusBadgeClass(currentClaim?.status)}`}>
                {currentClaim?.status?.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="card-body">
              <div className="financial-kpi-grid">
                <div className="kpi-box kpi-claimed">
                  <span className="kpi-label">TOTAL CLAIMED</span>
                  <span className="kpi-val font-mono">{formatInr(currentLedger.totalClaimedPaise)}</span>
                  <span className="kpi-sub">Original Invoice Amount</span>
                </div>

                <div className="kpi-box kpi-disallowed">
                  <span className="kpi-label">TOTAL DISALLOWANCE</span>
                  <span className="kpi-val font-mono text-danger">
                    -{formatInr(
                      currentLedger.totalExcludedNonPayablePaise +
                        currentLedger.totalProportionateDisallowancePaise +
                        currentLedger.totalSublimitDisallowancePaise
                    )}
                  </span>
                  <span className="kpi-sub">Exclusions & Sublimit Capping</span>
                </div>

                <div className="kpi-box kpi-payable">
                  <span className="kpi-label">ESTIMATED INSURER PAYABLE</span>
                  <span className="kpi-val font-mono font-bold text-success">
                    {formatInr(currentLedger.finalInsurerPayablePaise)}
                  </span>
                  <span className="kpi-sub">Subject to Policy Deductible & Copay</span>
                </div>

                <div className="kpi-box kpi-patient">
                  <span className="kpi-label">PATIENT OUT-OF-POCKET</span>
                  <span className="kpi-val font-mono font-bold text-danger">
                    {formatInr(currentLedger.totalPatientResponsibilityPaise)}
                  </span>
                  <span className="kpi-sub">Disallowed + Co-Pay + Deductibles</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section G: Side-by-Side Comparison Diff (When Reassessed) */}
        {comparisonResult && (
          <ClaimComparisonDiff
            comparison={comparisonResult}
            onClose={() => setComparisonResult(null)}
          />
        )}

        {/* Section D: Itemized Adjustments Ledger */}
        {currentLedger && (
          <section className="workspace-card" aria-label="Itemized Adjustments Ledger">
            <div className="card-header-flex">
              <div className="header-title-box">
                <FileText size={18} className="text-primary" />
                <h3>4. Itemized Adjustments Ledger</h3>
              </div>
              <span className="text-sm text-secondary">
                Click any row chevron to inspect grounded source clause & calculation trace
              </span>
            </div>

            <div className="card-body">
              <ClaimLedgerTable
                ledger={currentLedger}
                verifiedEvidence={currentEvidence}
                onOpenEditModal={(item) => setEditingItem(item)}
                isReassessing={isSavingEdit}
              />
            </div>
          </section>
        )}

        {/* Section E: Clause Evidence & Uncertainty Panel */}
        {currentEvidence && currentEvidence.length > 0 && (
          <section className="workspace-card" aria-label="Clause Evidence and Audit">
            <div className="card-header-flex">
              <div className="header-title-box">
                <Shield size={18} className="text-primary" />
                <h3>5. Policy Clause Grounding & Citation Audit</h3>
              </div>
            </div>

            <div className="card-body">
              <ClaimEvidencePanel
                verifiedEvidence={currentEvidence}
                policyVersionId={currentClaim?.selectedPolicyVersionId}
                amendmentIds={currentClaim?.applicableAmendmentIds}
              />
            </div>
          </section>
        )}

        {/* Section F: Mathematical Calculation Trace Waterfall */}
        {currentLedger && (
          <section className="workspace-card" aria-label="Mathematical Calculation Trace">
            <div className="card-body">
              <ClaimCalculationTrace
                ledger={currentLedger}
                traceId={currentClaim?.traceId}
              />
            </div>
          </section>
        )}
      </div>

      {/* Human-in-the-Loop Item Edit Modal */}
      {editingItem && (
        <ClaimItemEditModal
          isOpen={Boolean(editingItem)}
          onClose={() => setEditingItem(null)}
          item={editingItem}
          onSaveItem={handleSaveItemEdit}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
