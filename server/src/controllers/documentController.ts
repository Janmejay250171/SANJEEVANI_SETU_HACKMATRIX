import { Request, Response } from 'express';
import { documentStorageService } from '../services/documentStorageService.js';
import { getUserFromRequest } from './authController.js';
import { DocumentCategory } from '../models/SavedDocument.js';

export async function listDocuments(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUserFromRequest(req);
    const userId = user?._id?.toString() || (req.query.userId as string) || 'anonymous';
    const category = req.query.category as DocumentCategory | undefined;

    const docs = await documentStorageService.listDocuments(userId, category);

    res.status(200).json({
      status: 'success',
      data: docs
    });
  } catch (err: any) {
    console.error('[DocumentController] Error listing documents:', err);
    res.status(500).json({
      error: {
        code: 'LIST_DOCUMENTS_FAILED',
        message: err.message || 'Internal error listing saved documents.'
      }
    });
  }
}

export async function getDocument(req: Request, res: Response): Promise<void> {
  try {
    const documentId = String(req.params.documentId);
    const user = await getUserFromRequest(req);
    const userId = user?._id?.toString();

    const doc = await documentStorageService.getDocumentById(documentId, userId);

    res.status(200).json({
      status: 'success',
      data: doc
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: {
        code: err.code || 'GET_DOCUMENT_FAILED',
        message: err.message || 'Failed to retrieve saved document.'
      }
    });
  }
}

export async function downloadDocument(req: Request, res: Response): Promise<void> {
  try {
    const documentId = String(req.params.documentId);
    const user = await getUserFromRequest(req);
    const userId = user?._id?.toString();

    const { stream, document } = await documentStorageService.getDocumentStream(documentId, userId);

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.originalFilename)}"`
    );
    res.setHeader('Content-Length', document.sizeBytes);
    res.setHeader('X-Content-SHA256', document.contentHashSha256);

    stream.pipe(res);
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: {
        code: err.code || 'DOWNLOAD_DOCUMENT_FAILED',
        message: err.message || 'Failed to download original document bytes.'
      }
    });
  }
}

export async function verifyDocumentIntegrity(req: Request, res: Response): Promise<void> {
  try {
    const documentId = String(req.params.documentId);
    const result = await documentStorageService.verifyIntegrity(documentId);

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (err: any) {
    res.status(500).json({
      error: {
        code: 'VERIFY_INTEGRITY_FAILED',
        message: err.message || 'Failed to verify document integrity.'
      }
    });
  }
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  try {
    const documentId = String(req.params.documentId);
    const user = await getUserFromRequest(req);
    const userId = user?._id?.toString();

    await documentStorageService.deleteDocument(documentId, userId);

    res.status(200).json({
      status: 'success',
      message: `Document "${documentId}" successfully marked as deleted.`
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    res.status(status).json({
      error: {
        code: err.code || 'DELETE_DOCUMENT_FAILED',
        message: err.message || 'Failed to delete saved document.'
      }
    });
  }
}
