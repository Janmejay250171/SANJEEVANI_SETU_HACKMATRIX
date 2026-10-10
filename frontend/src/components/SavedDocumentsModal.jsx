import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Download,
  Eye,
  Trash2,
  ShieldCheck,
  Calendar,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Receipt,
  FileCheck
} from 'lucide-react';
import { listSavedDocuments, getDocumentDownloadUrl, verifyDocumentIntegrity, deleteSavedDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SavedDocumentsModal({
  isOpen,
  onClose,
  onReopenPolicy,
  onReopenBill
}) {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // all, policy, bill, bill_image, amendment
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingDocId, setVerifyingDocId] = useState(null);
  const [verificationResults, setVerificationResults] = useState({});
  const [selectedSnapshotDoc, setSelectedSnapshotDoc] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
    }
  }, [isOpen, activeFilter]);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const categoryParam = activeFilter === 'all' ? null : activeFilter;
      const docs = await listSavedDocuments(categoryParam, token);
      setDocuments(docs);
    } catch (err) {
      setError(err.message || 'Failed to load saved documents.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (docId) => {
    setVerifyingDocId(docId);
    try {
      const res = await verifyDocumentIntegrity(docId, token);
      setVerificationResults((prev) => ({
        ...prev,
        [docId]: res
      }));
    } catch (err) {
      setVerificationResults((prev) => ({
        ...prev,
        [docId]: { verified: false, actualHash: 'Check failed' }
      }));
    } finally {
      setVerifyingDocId(null);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Are you sure you want to delete "${doc.originalFilename}"?`)) {
      return;
    }
    try {
      await deleteSavedDocument(doc.documentId, token);
      setDocuments((prev) => prev.filter((d) => d.documentId !== doc.documentId));
    } catch (err) {
      alert(err.message || 'Failed to delete document.');
    }
  };

  const handleReopenAnalysis = (doc) => {
    if (!doc.analysisSnapshot) {
      alert('No preserved analysis snapshot available for this document.');
      return;
    }
    if (doc.category === 'policy') {
      if (onReopenPolicy) {
        onReopenPolicy(doc.analysisSnapshot);
        onClose();
      }
    } else if (doc.category === 'bill' || doc.category === 'bill_image') {
      if (onReopenBill) {
        onReopenBill(doc.analysisSnapshot);
        onClose();
      } else {
        setSelectedSnapshotDoc(doc);
      }
    } else {
      setSelectedSnapshotDoc(doc);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.originalFilename.toLowerCase().includes(query) ||
      (d.documentId && d.documentId.toLowerCase().includes(query)) ||
      (d.category && d.category.toLowerCase().includes(query))
    );
  });

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(11, 27, 44, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="saved-docs-modal-card"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px -12px rgba(11, 79, 108, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: 'linear-gradient(135deg, #0b4f6c 0%, #083c53 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <HardDrive size={22} color="#00e699" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#ffffff' }}>
                Saved Documents &amp; Historical Analysis
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                Durable byte retention, cryptographic SHA-256 integrity, and immutable analysis snapshots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter bar & Search */}
        <div
          style={{
            padding: '14px 24px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'All Documents' },
              { id: 'policy', label: 'Policies' },
              { id: 'bill', label: 'Itemized Bills' },
              { id: 'bill_image', label: 'Bill Images' },
              { id: 'amendment', label: 'Amendments' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  border: activeFilter === tab.id ? '1px solid #0b4f6c' : '1px solid #cbd5e1',
                  background: activeFilter === tab.id ? '#0b4f6c' : '#ffffff',
                  color: activeFilter === tab.id ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={14}
              style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem'
              }}
            />
          </div>
        </div>

        {/* Content List */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              <RefreshCw size={24} className="spin-icon" style={{ marginBottom: '8px' }} />
              <div>Loading durable documents...</div>
            </div>
          ) : error ? (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              <HardDrive size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <div style={{ fontSize: '1rem', fontWeight: 500, color: '#475569' }}>
                No saved documents found
              </div>
              <p style={{ fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                Upload an insurance policy or hospital bill to automatically persist durable records.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDocs.map((doc) => {
                const isVerified = verificationResults[doc.documentId]?.verified;
                const vResult = verificationResults[doc.documentId];

                return (
                  <div
                    key={doc.documentId}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      background: '#ffffff',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      transition: 'border-color 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '1 1 340px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background:
                            doc.category === 'policy'
                              ? '#e0f2fe'
                              : doc.category === 'bill'
                              ? '#f0fdf4'
                              : '#fef3c7',
                          color:
                            doc.category === 'policy'
                              ? '#0284c7'
                              : doc.category === 'bill'
                              ? '#16a34a'
                              : '#d97706',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {doc.category === 'policy' ? (
                          <FileText size={18} />
                        ) : (
                          <Receipt size={18} />
                        )}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b' }}>
                            {doc.originalFilename}
                          </span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                              background: '#f1f5f9',
                              color: '#475569'
                            }}
                          >
                            {doc.category}
                          </span>
                          {doc.analysisSnapshot && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 500,
                                background: '#dcfce7',
                                color: '#15803d'
                              }}
                            >
                              Snapshot Saved
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            marginTop: '4px',
                            display: 'flex',
                            gap: '14px',
                            flexWrap: 'wrap'
                          }}
                        >
                          <span>Size: {formatFileSize(doc.sizeBytes)}</span>
                          <span>Uploaded: {formatDate(doc.uploadTimestamp)}</span>
                          <span title={doc.contentHashSha256}>
                            SHA-256: {doc.contentHashSha256 ? doc.contentHashSha256.substring(0, 10) + '…' : '—'}
                          </span>
                        </div>

                        {vResult && (
                          <div
                            style={{
                              marginTop: '6px',
                              fontSize: '0.75rem',
                              color: isVerified ? '#15803d' : '#b91c1c',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isVerified ? (
                              <>
                                <CheckCircle2 size={13} />
                                <span>Cryptographic SHA-256 verified identical to disk file</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={13} />
                                <span>Integrity mismatch or file altered</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleVerify(doc.documentId)}
                        disabled={verifyingDocId === doc.documentId}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#475569',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Verify cryptographic SHA-256 against stored disk file"
                      >
                        <ShieldCheck size={14} color="#0b4f6c" />
                        <span>{verifyingDocId === doc.documentId ? 'Verifying…' : 'Verify'}</span>
                      </button>

                      <a
                        href={getDocumentDownloadUrl(doc.documentId)}
                        download={doc.originalFilename}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#0b4f6c',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Download original file bytes"
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </a>

                      {doc.analysisSnapshot && (
                        <button
                          type="button"
                          onClick={() => handleReopenAnalysis(doc)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            border: 'none',
                            background: '#0b4f6c',
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Open historical analysis without recalculating"
                        >
                          <Eye size={14} />
                          <span>Reopen Snapshot</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        style={{
                          padding: '6px',
                          borderRadius: '8px',
                          border: '1px solid #fee2e2',
                          background: '#fff5f5',
                          color: '#dc2626',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        title="Delete document"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Snapshot View Drawer (if inspect modal) */}
        {selectedSnapshotDoc && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              maxHeight: '220px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                Historical Analysis Snapshot ({selectedSnapshotDoc.originalFilename})
              </span>
              <button
                onClick={() => setSelectedSnapshotDoc(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <pre
              style={{
                fontSize: '0.75rem',
                background: '#ffffff',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                marginTop: '8px',
                overflowX: 'auto'
              }}
            >
              {JSON.stringify(selectedSnapshotDoc.analysisSnapshot, null, 2)}
            </pre>
          </div>
        )}

        {/* Footer Retention Notice */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#64748b'
          }}
        >
          <span>
            Guarantee: Stored files are retained with SHA-256 integrity verification. Reopening retrieves historical snapshots without silent recalculation.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="pill-btn pill-btn-ghost"
            style={{ padding: '4px 12px', fontSize: '0.8rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
