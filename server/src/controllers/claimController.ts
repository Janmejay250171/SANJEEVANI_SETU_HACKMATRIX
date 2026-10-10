import fs from 'fs';
import { Request, Response } from 'express';
import {
  CreateClaimRequestSchema,
  UpdateBillItemRequestSchema,
  RegisterAmendmentRequestSchema,
  ReassessClaimRequestSchema
} from '../types/claimApi.js';
import { billExtractionService } from '../services/billExtractionService.js';
import { claimWorkflowService } from '../services/claimWorkflowService.js';
import { getUserFromRequest } from './authController.js';

export async function uploadBill(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        error: {
          code: 'FILE_REQUIRED',
          message: 'Please provide a hospital invoice PDF under field name "file".'
        }
      });
      return;
    }

    if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Only PDF documents are supported for bill processing.'
        }
      });
      return;
    }

    const result = await billExtractionService.extractBillFromPdf(file.buffer, file.originalname);
    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err: any) {
    console.error('[ClaimController] Error uploading bill:', err);
    res.status(500).json({
      error: {
        code: 'BILL_EXTRACTION_FAILED',
        message: 'Internal error processing hospital bill invoice.'
      }
    });
  }
}

export async function createClaim(req: Request, res: Response): Promise<void> {
  try {
    const parseResult = CreateClaimRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid claim creation payload.',
          details: parseResult.error.format()
        }
      });
      return;
    }

    const user = await getUserFromRequest(req);
    const claimState = await claimWorkflowService.createClaimAssessment(
      parseResult.data,
      user?._id?.toString()
    );

    res.status(201).json({
      status: 'success',
      data: claimState
    });
  } catch (err: any) {
    console.error('[ClaimController] Error creating claim:', err);
    res.status(500).json({
      error: {
        code: 'CLAIM_CREATION_FAILED',
        message: err.message || 'Internal error creating claim assessment.'
      }
    });
  }
}

export async function getClaim(req: Request, res: Response): Promise<void> {
  try {
    const claimId = String(req.params.claimId || '');
    if (!claimId) {
      res.status(400).json({ error: { code: 'PARAM_REQUIRED', message: 'claimId parameter is required.' } });
      return;
    }

    const user = await getUserFromRequest(req);
    const claim = await claimWorkflowService.getClaim(claimId, user?._id?.toString());

    if (!claim) {
      res.status(404).json({
        error: {
          code: 'CLAIM_NOT_FOUND',
          message: `Claim assessment '${claimId}' not found.`
        }
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: claim
    });
  } catch (err: any) {
    if (err.message?.includes('ACCESS_DENIED')) {
      res.status(403).json({ error: { code: 'ACCESS_DENIED', message: err.message } });
      return;
    }
    console.error('[ClaimController] Error fetching claim:', err);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to retrieve claim assessment.' } });
  }
}

export async function getClaimLedger(req: Request, res: Response): Promise<void> {
  try {
    const claimId = String(req.params.claimId || '');
    const user = await getUserFromRequest(req);
    const claim = await claimWorkflowService.getClaim(claimId, user?._id?.toString());

    if (!claim) {
      res.status(404).json({ error: { code: 'CLAIM_NOT_FOUND', message: `Claim '${claimId}' not found.` } });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        claimId: claim.claimId,
        ledger: claim.ledger,
        itemizedLedger: claim.latestAssessment?.itemizedLedger || [],
        trace: claim.latestAssessment?.trace || null,
        reconciliation: claim.latestAssessment?.billReconciliation || null,
        reviewRequired: claim.latestAssessment?.reviewRequired || false,
        reviewReasons: claim.reviewReasons
      }
    });
  } catch (err: any) {
    if (err.message?.includes('ACCESS_DENIED')) {
      res.status(403).json({ error: { code: 'ACCESS_DENIED', message: err.message } });
      return;
    }
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to retrieve ledger.' } });
  }
}

export async function getClaimEvidence(req: Request, res: Response): Promise<void> {
  try {
    const claimId = String(req.params.claimId || '');
    const user = await getUserFromRequest(req);
    const claim = await claimWorkflowService.getClaim(claimId, user?._id?.toString());

    if (!claim) {
      res.status(404).json({ error: { code: 'CLAIM_NOT_FOUND', message: `Claim '${claimId}' not found.` } });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        claimId: claim.claimId,
        policyFamilyId: claim.policyFamilyId,
        selectedPolicyVersionId: claim.selectedPolicyVersionId,
        applicableAmendmentIds: claim.applicableAmendmentIds,
        treatmentDate: claim.treatmentDate,
        reviewStatus: claim.reviewStatus,
        reviewReasons: claim.reviewReasons,
        verifiedItemEvidence: (claim as any).verifiedItemEvidence || []
      }
    });
  } catch (err: any) {
    if (err.message?.includes('ACCESS_DENIED')) {
      res.status(403).json({ error: { code: 'ACCESS_DENIED', message: err.message } });
      return;
    }
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to retrieve evidence.' } });
  }
}

export async function updateBillItem(req: Request, res: Response): Promise<void> {
  try {
    const claimId = String(req.params.claimId || '');
    const itemId = String(req.params.itemId || '');
    const parseResult = UpdateBillItemRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bill item update payload.',
          details: parseResult.error.format()
        }
      });
      return;
    }

    const user = await getUserFromRequest(req);
    const updatedClaim = await claimWorkflowService.updateBillItem(
      claimId,
      itemId,
      parseResult.data,
      user?._id?.toString()
    );

    res.status(200).json({
      status: 'success',
      data: updatedClaim
    });
  } catch (err: any) {
    if (err.message?.includes('CLAIM_NOT_FOUND')) {
      res.status(404).json({ error: { code: 'CLAIM_NOT_FOUND', message: err.message } });
      return;
    }
    if (err.message?.includes('ITEM_NOT_FOUND')) {
      res.status(404).json({ error: { code: 'ITEM_NOT_FOUND', message: err.message } });
      return;
    }
    if (err.message?.includes('ACCESS_DENIED')) {
      res.status(403).json({ error: { code: 'ACCESS_DENIED', message: err.message } });
      return;
    }
    console.error('[ClaimController] Error updating bill item:', err);
    res.status(500).json({ error: { code: 'UPDATE_FAILED', message: 'Failed to update bill line item.' } });
  }
}

export async function registerAmendment(req: Request, res: Response): Promise<void> {
  try {
    const claimId = String(req.params.claimId || '');
    const parseResult = RegisterAmendmentRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid amendment payload.',
          details: parseResult.error.format()
        }
      });
      return;
    }

    const user = await getUserFromRequest(req);
    const claim = await claimWorkflowService.getClaim(claimId, user?._id?.toString());

    if (!claim) {
      res.status(404).json({ error: { code: 'CLAIM_NOT_FOUND', message: `Claim '${claimId}' not found.` } });
      return;
    }

    const amendmentRecord = await claimWorkflowService.registerAmendment(
      claim.policyFamilyId,
      parseResult.data,
      user?._id?.toString()
    );

    res.status(201).json({
      status: 'success',
      data: amendmentRecord
    });
  } catch (err: any) {
    console.error('[ClaimController] Error registering amendment:', err);
    res.status(500).json({ error: { code: 'AMENDMENT_FAILED', message: 'Failed to register policy amendment.' } });
  }
}

export async function reassessClaim(req: Request, res: Response): Promise<void> {
  try {
    const claimId = String(req.params.claimId || '');
    const parseResult = ReassessClaimRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid reassessment payload.',
          details: parseResult.error.format()
        }
      });
      return;
    }

    const user = await getUserFromRequest(req);
    const result = await claimWorkflowService.reassessClaim(
      claimId,
      parseResult.data,
      user?._id?.toString()
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err: any) {
    if (err.message?.includes('CLAIM_NOT_FOUND')) {
      res.status(404).json({ error: { code: 'CLAIM_NOT_FOUND', message: err.message } });
      return;
    }
    if (err.message?.includes('ACCESS_DENIED')) {
      res.status(403).json({ error: { code: 'ACCESS_DENIED', message: err.message } });
      return;
    }
    console.error('[ClaimController] Error reassessing claim:', err);
    res.status(500).json({ error: { code: 'REASSESSMENT_FAILED', message: 'Failed to reassess claim.' } });
  }
}

export async function compareAssessments(req: Request, res: Response): Promise<void> {
  try {
    const claimId = String(req.params.claimId || '');
    const user = await getUserFromRequest(req);
    const claim = await claimWorkflowService.getClaim(claimId, user?._id?.toString());

    if (!claim) {
      res.status(404).json({ error: { code: 'CLAIM_NOT_FOUND', message: `Claim '${claimId}' not found.` } });
      return;
    }

    if (!claim.history || claim.history.length < 2) {
      res.status(400).json({
        error: {
          code: 'INSUFFICIENT_HISTORY',
          message: 'Claim does not have multiple assessments to compare. Please perform a reassessment first.'
        }
      });
      return;
    }

    const prior = claim.history[claim.history.length - 2];
    const current = claim.latestAssessment;
    const comparison = claimWorkflowService.compareAssessments(claim, prior, current, 'Direct assessment comparison');

    res.status(200).json({
      status: 'success',
      data: comparison
    });
  } catch (err: any) {
    if (err.message?.includes('ACCESS_DENIED')) {
      res.status(403).json({ error: { code: 'ACCESS_DENIED', message: err.message } });
      return;
    }
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to compare assessments.' } });
  }
}

export async function getDemoScenarios(_req: Request, res: Response): Promise<void> {
  const scenarios = [
    {
      id: 'scenario-1-supported',
      title: 'Scenario 1: Supported Treatment (Inpatient Appendectomy)',
      subtitle: 'Medically necessary surgery with transparent ledger adjustments',
      category: 'SUPPORTED',
      policyFamilyId: 'syn_fam_health_01',
      treatmentDate: '2025-04-10',
      hospitalName: 'Apollo Hospitals Bengaluru',
      billId: 'bill_demo_scenario_1',
      description: 'Patient admitted for emergency laparoscopic appendectomy. Tests coverage matching under Inpatient Surgical Coverage clause.',
      billItems: [
        {
          itemId: 'item_1_1',
          originalDescription: 'Emergency Laparoscopic Appendectomy Surgery',
          category: 'SURGEON_CONSULTATION',
          quantity: 1,
          unitPricePaise: 4500000,
          claimedAmountPaise: 4500000,
          claimedAmountRupees: 45000
        },
        {
          itemId: 'item_1_2',
          originalDescription: 'Operation Theatre & Recovery Room Charges',
          category: 'OT_CHARGES',
          quantity: 1,
          unitPricePaise: 1000000,
          claimedAmountPaise: 1000000,
          claimedAmountRupees: 10000
        },
        {
          itemId: 'item_1_3',
          originalDescription: 'Inpatient Ward Nursing & Monitoring Assistance',
          category: 'NURSING',
          quantity: 1,
          unitPricePaise: 500000,
          claimedAmountPaise: 500000,
          claimedAmountRupees: 5000
        }
      ]
    },
    {
      id: 'scenario-2-excluded',
      title: 'Scenario 2: Explicit Exclusion (Cosmetic Rhinoplasty)',
      subtitle: 'Disallowed cosmetic procedure with source excerpt and reason',
      category: 'EXCLUDED',
      policyFamilyId: 'syn_fam_health_01',
      treatmentDate: '2025-04-10',
      hospitalName: 'Apollo Hospitals Bengaluru',
      billId: 'bill_demo_scenario_2',
      description: 'Elective cosmetic nasal reshaping procedure without traumatic cause. Demonstrates 100% disallowance under General Exclusion G01.',
      billItems: [
        {
          itemId: 'item_2_1',
          originalDescription: 'Elective Cosmetic Rhinoplasty Reshaping',
          category: 'SURGEON_CONSULTATION',
          quantity: 1,
          unitPricePaise: 7500000,
          claimedAmountPaise: 7500000,
          claimedAmountRupees: 75000
        }
      ]
    },
    {
      id: 'scenario-3-missing-evidence',
      title: 'Scenario 3: Missing / Conflicting Evidence (Bioresonance Detox)',
      subtitle: 'Unindexed alternative therapy safely triggering human review',
      category: 'REVIEW_REQUIRED',
      policyFamilyId: 'syn_fam_health_01',
      treatmentDate: '2025-04-10',
      hospitalName: 'Apollo Hospitals Bengaluru',
      billId: 'bill_demo_scenario_3',
      description: 'Alternative medicine therapy lacking empirical validation or policy clause grounding. System refuses to guess and flags for human review.',
      billItems: [
        {
          itemId: 'item_3_1',
          originalDescription: 'Extraterrestrial Telemetry Bioresonance Alignment Session',
          category: 'MISCELLANEOUS',
          quantity: 1,
          unitPricePaise: 3000000,
          claimedAmountPaise: 3000000,
          claimedAmountRupees: 30000
        }
      ]
    },
    {
      id: 'scenario-4-amendment',
      title: 'Scenario 4: Policy Amendment Precedence (Robotic Surgery Endorsement)',
      subtitle: 'Effective-date based policy version selection and sublimit override',
      category: 'AMENDMENT',
      policyFamilyId: 'syn_fam_health_01',
      treatmentDatePre: '2025-05-15',
      treatmentDatePost: '2025-08-15',
      hospitalName: 'Apollo Hospitals Bengaluru',
      billId: 'bill_demo_scenario_4',
      description: 'Tests date-based applicability resolution. Pre-amendment dates apply Base Policy v1.0, while post-amendment dates apply Amendment Endorsement v1.1.',
      billItems: [
        {
          itemId: 'item_4_1',
          originalDescription: 'Deluxe Room Bed Charges 2 Days',
          category: 'ROOM_RENT',
          quantity: 2,
          unitPricePaise: 1500000,
          claimedAmountPaise: 1500000,
          claimedAmountRupees: 15000
        }
      ]
    }
  ];

  res.status(200).json({
    status: 'success',
    data: scenarios
  });
}
