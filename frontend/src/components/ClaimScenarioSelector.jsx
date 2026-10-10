import React from 'react';
import { Sparkles, CheckCircle2, XCircle, AlertTriangle, GitCompare } from 'lucide-react';

export default function ClaimScenarioSelector({ scenarios, activeScenarioId, onSelectScenario, onResetToUpload }) {
  if (!scenarios || scenarios.length === 0) return null;

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'SUPPORTED':
        return <CheckCircle2 size={16} className="scenario-icon text-success" />;
      case 'EXCLUDED':
        return <XCircle size={16} className="scenario-icon text-danger" />;
      case 'REVIEW_REQUIRED':
        return <AlertTriangle size={16} className="scenario-icon text-warning" />;
      case 'AMENDMENT':
        return <GitCompare size={16} className="scenario-icon text-primary" />;
      default:
        return <Sparkles size={16} className="scenario-icon text-primary" />;
    }
  };

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'SUPPORTED':
        return 'badge-success';
      case 'EXCLUDED':
        return 'badge-danger';
      case 'REVIEW_REQUIRED':
        return 'badge-warning';
      case 'AMENDMENT':
        return 'badge-primary';
      default:
        return 'badge-neutral';
    }
  };

  return (
    <section className="scenario-selector-container" aria-label="FIN-01 Demonstration Scenarios">
      <div className="scenario-selector-header">
        <div className="scenario-header-left">
          <span className="scenario-pretitle">VERIFIED TEST SCENARIOS</span>
          <h2 className="scenario-title">FIN-01 Demonstration Experience</h2>
        </div>
        <div className="scenario-header-right">
          <span className="fixture-indicator">
            <span className="fixture-dot"></span>
            Synthetic Verified Fixtures (Zero Paid APIs)
          </span>
          {activeScenarioId && (
            <button
              type="button"
              onClick={onResetToUpload}
              className="btn-link-reset"
              aria-label="Upload custom invoice"
            >
              Custom Bill Upload
            </button>
          )}
        </div>
      </div>

      <div className="scenario-grid">
        {scenarios.map((sc) => {
          const isSelected = activeScenarioId === sc.id;
          return (
            <button
              key={sc.id}
              type="button"
              className={`scenario-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectScenario(sc)}
              aria-pressed={isSelected}
            >
              <div className="scenario-card-top">
                <span className={`scenario-badge ${getCategoryBadgeClass(sc.category)}`}>
                  {getCategoryIcon(sc.category)}
                  {sc.category.replace('_', ' ')}
                </span>
                <span className="scenario-id-tag">{sc.id.replace('scenario-', 'DEMO #')}</span>
              </div>
              <h3 className="scenario-card-title">{sc.title}</h3>
              <p className="scenario-card-desc">{sc.subtitle}</p>
              <div className="scenario-card-footer">
                <span className="scenario-date">Date: {sc.treatmentDate || sc.treatmentDatePre}</span>
                <span className="scenario-select-cta">{isSelected ? 'Active Scenario' : 'Run Test →'}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
