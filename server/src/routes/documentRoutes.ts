import { Router } from 'express';
import {
  listDocuments,
  getDocument,
  downloadDocument,
  verifyDocumentIntegrity,
  deleteDocument
} from '../controllers/documentController.js';

const router = Router();

// List saved documents for current user
router.get('/', listDocuments);

// Get document metadata and preserved analysis snapshot
router.get('/:documentId', getDocument);

// Download original document bytes
router.get('/:documentId/download', downloadDocument);

// Verify file cryptographic integrity (SHA-256)
router.get('/:documentId/verify', verifyDocumentIntegrity);

// Delete saved document (soft delete with disk cleanup)
router.delete('/:documentId', deleteDocument);

export default router;
