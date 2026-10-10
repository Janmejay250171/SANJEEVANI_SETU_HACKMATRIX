import { Router } from 'express';
import multer from 'multer';
import {
  uploadBill,
  createClaim,
  getClaim,
  getClaimLedger,
  getClaimEvidence,
  updateBillItem,
  registerAmendment,
  reassessClaim,
  compareAssessments,
  getDemoScenarios
} from '../controllers/claimController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// 1. Upload & Extract Itemized Bill (Multipart PDF)
router.post('/bills/upload', upload.single('file'), uploadBill);

// 2. Create Claim Assessment
router.post('/assess', createClaim);

// 2b. FIN-01 Demonstration Scenarios
router.get('/demo/scenarios', getDemoScenarios);

// 3. Get Claim Assessment State
router.get('/:claimId', getClaim);

// 4. Get Itemized Ledger & Calculation Trace
router.get('/:claimId/ledger', getClaimLedger);

// 5. Get Policy Version Selection & Supporting Evidence
router.get('/:claimId/evidence', getClaimEvidence);

// 6. Update / Correct Bill Line Item (Human in the loop)
router.put('/:claimId/items/:itemId', updateBillItem);

// 7. Register Policy Amendment
router.post('/:claimId/amendments', registerAmendment);

// 8. Reassess Claim
router.post('/:claimId/reassess', reassessClaim);

// 9. Compare Assessment Versions
router.get('/:claimId/compare', compareAssessments);

export default router;
