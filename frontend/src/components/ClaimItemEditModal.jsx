import React, { useState } from 'react';
import { X, Save, AlertCircle, Edit3 } from 'lucide-react';

const CATEGORIES = [
  'SURGEON_CONSULTATION',
  'OT_CHARGES',
  'ROOM_RENT',
  'ICU_CHARGES',
  'NURSING',
  'INVESTIGATIONS_DIAGNOSTICS',
  'MEDICINES_PHARMACY',
  'CONSUMABLES_NON_PAYABLES',
  'IMPLANT_PROSTHETICS',
  'AMBULANCE',
  'DAYCARE_PACKAGE',
  'MISCELLANEOUS'
];

export default function ClaimItemEditModal({ isOpen, onClose, item, onSaveItem, isSaving = false }) {
  if (!isOpen || !item) return null;

  const [description, setDescription] = useState(item.originalDescription || '');
  const [claimedRupees, setClaimedRupees] = useState(
    item.claimedAmountPaise ? (item.claimedAmountPaise / 100).toString() : '0'
  );
  const [category, setCategory] = useState(item.category || 'MISCELLANEOUS');
  const [correctionNote, setCorrectionNote] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = parseFloat(claimedRupees);
    if (isNaN(num) || num <= 0) {
      setError('Please provide a valid claimed amount in rupees (> 0).');
      return;
    }
    if (!description.trim()) {
      setError('Item description cannot be empty.');
      return;
    }

    setError(null);
    onSaveItem({
      itemId: item.itemId,
      description: description.trim(),
      claimedAmountRupees: num,
      claimedAmountPaise: Math.round(num * 100),
      category,
      correctionNote: correctionNote.trim() || 'Manual adjustment by user'
    });
  };

  return (
    <div className="modal-backdrop animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-card modal-edit-item">
        <div className="modal-header">
          <div className="modal-title-group">
            <Edit3 size={18} className="text-primary" />
            <h3 id="modal-title" className="modal-title">Correct Bill Line Item</h3>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && (
            <div className="form-error-banner">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="edit-desc" className="form-label">
              Line Item Description
            </label>
            <input
              id="edit-desc"
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Laparoscopic Appendectomy Surgery"
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label htmlFor="edit-amount" className="form-label">
                Claimed Amount (INR ₹)
              </label>
              <input
                id="edit-amount"
                type="number"
                step="0.01"
                min="1"
                className="form-input font-mono"
                value={claimedRupees}
                onChange={(e) => setClaimedRupees(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-category" className="form-label">
                Standard Charge Category
              </label>
              <select
                id="edit-category"
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="edit-note" className="form-label">
              Correction Reason / Audit Note
            </label>
            <textarea
              id="edit-note"
              className="form-textarea"
              rows={2}
              value={correctionNote}
              onChange={(e) => setCorrectionNote(e.target.value)}
              placeholder="e.g. Corrected category misclassification from consumable to surgical procedure."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="pill-btn pill-btn-ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="pill-btn pill-btn-primary" disabled={isSaving}>
              <Save size={15} />
              {isSaving ? 'Saving & Reassessing...' : 'Save & Reassess'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
