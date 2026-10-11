import React from 'react';
import { Sparkles, CheckCircle2, XCircle, AlertTriangle, GitCompare } from 'lucide-react';

function getFriendlyScenario(sc) {
  const titleLower = (sc.title || '').toLowerCase();
  const idLower = (sc.id || '').toLowerCase();

  if (idLower.includes('1') || titleLower.includes('appendectomy')) {
    return {
      title: 'Appendectomy',
      tag: 'Covered',
      badgeClass: 'badge-success',
      icon: <CheckCircle2 size={13} className="scenario-icon text-success" />,
      desc: 'Medically necessary surgery with standard co-pay',
      date: sc.treatmentDate || sc.treatmentDatePre || '2025-04-10'
    };
  }
  if (idLower.includes('2') || titleLower.includes('rhinoplasty')) {
    return {
      title: 'Cosmetic Rhinoplasty',
      tag: 'Excluded',
      badgeClass: 'badge-danger',
      icon: <XCircle size={13} className="scenario-icon text-danger" />,
      desc: 'Non-medical procedure excluded by policy terms',
      date: sc.treatmentDate || sc.treatmentDatePre || '2025-04-10'
    };
  }
  if (idLower.includes('3') || titleLower.includes('bioresonance') || sc.category === 'REVIEW_REQUIRED') {
    return {
      title: 'Alternative Therapy',
      tag: 'Needs Review',
      badgeClass: 'badge-warning',
      icon: <AlertTriangle size={13} className="scenario-icon text-warning" />,
      desc: 'Unindexed therapy flagged for human review',
      date: sc.treatmentDate || sc.treatmentDatePre || '2025-04-10'
    };
  }
  if (idLower.includes('4') || titleLower.includes('robotic') || titleLower.includes('amendment')) {
    return {
      title: 'Robotic Surgery',
      tag: 'Endorsement',
      badgeClass: 'badge-primary',
      icon: <GitCompare size={13} className="scenario-icon text-primary" />,
      desc: 'Updated sublimit applied via policy addendum',
      date: sc.treatmentDate || sc.treatmentDatePre || '2025-05-15'
    };
  }

  return {
    title: sc.title.replace(/^Scenario\s*\d+:\s*/i, ''),
    tag: sc.category?.replace(/_/g, ' ') || 'Sample',
    badgeClass: 'badge-neutral',
    icon: <Sparkles size={13} className="scenario-icon text-primary" />,
    desc: sc.subtitle || '',
    date: sc.treatmentDate || sc.treatmentDatePre || ''
  };
}

export default function ClaimScenarioSelector({ scenarios, activeScenarioId, onSelectScenario, onResetToUpload }) {
  if (!scenarios || scenarios.length === 0) return null;

  return (
    <section className="scenario-selector-container" aria-label="Sample Claim Scenarios">
      <div className="scenario-selector-header">
        <div className="scenario-header-left">
          <h2 className="scenario-title" style={{ fontSize: '16px', fontWeight: 700 }}>Sample Scenarios</h2>
        </div>
        <div className="scenario-header-right">
          {activeScenarioId && (
            <button
              type="button"
              onClick={onResetToUpload}
              className="btn-link-reset"
              aria-label="Upload custom invoice"
            >
              Upload Custom Bill
            </button>
          )}
        </div>
      </div>

      <div className="scenario-grid">
        {scenarios.map((sc) => {
          const isSelected = activeScenarioId === sc.id;
          const meta = getFriendlyScenario(sc);

          return (
            <button
              key={sc.id}
              type="button"
              className={`scenario-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectScenario(sc)}
              aria-pressed={isSelected}
            >
              <div className="scenario-card-top">
                <span className={`scenario-badge ${meta.badgeClass}`}>
                  {meta.icon}
                  {meta.tag}
                </span>
                <span className="scenario-date" style={{ fontSize: '11px' }}>{meta.date}</span>
              </div>
              <h3 className="scenario-card-title">{meta.title}</h3>
              <p className="scenario-card-desc">{meta.desc}</p>
              <div className="scenario-card-footer">
                <span className="scenario-select-cta">
                  {isSelected ? 'Active' : 'Select →'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
