import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileUp, Sparkles, Shield, ArrowDown, ChevronRight, Activity, Cpu } from 'lucide-react';

export default function LandingHero({ onUploadClick, onDemoClick }) {
  const { t } = useTranslation();

  return (
    <section className="landing-hero" aria-label="SehatSure AI Introduction">
      {/* Hero content */}
      <div className="landing-hero-content">
        {/* Subtle AI Badge */}
        <div className="landing-hero-badge">
          <Sparkles size={13} className="hero-sparkle-icon" />
          <span>{t('landing.badge', 'AI Health Insurance & Hospital Intelligence')}</span>
        </div>

        {/* Primary Headline */}
        <h1 className="landing-hero-headline">
          Want to be sure? Think SehatSure.
        </h1>

        {/* Short Supporting Line */}
        <p className="landing-hero-sub">
          {t('landing.supportingLine', 'Understand your coverage. Compare hospitals. Estimate costs.')}
        </p>

        {/* Primary & Secondary CTAs */}
        <div className="landing-hero-actions">
          <button
            type="button"
            className="hero-btn-primary"
            onClick={onUploadClick}
            aria-label="Upload your health insurance policy PDF"
          >
            <FileUp size={16} />
            <span>Upload Policy PDF</span>
            <ArrowDown size={14} className="hero-btn-arrow" />
          </button>

          <button
            type="button"
            className="hero-btn-secondary"
            onClick={onDemoClick}
            aria-label="Explore pre-loaded demo policies"
          >
            <span>Explore Demo Policies</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Data Trust & Capability Chips */}
        <div className="landing-hero-chips" aria-label="Key features">
          <div className="hero-chip">
            <Shield size={12} className="hero-chip-icon" />
            <span>IRDAI Deterministic Rules</span>
          </div>
          <div className="hero-chip">
            <Activity size={12} className="hero-chip-icon" />
            <span>50,000+ Empanelled Hospitals</span>
          </div>
          <div className="hero-chip">
            <Cpu size={12} className="hero-chip-icon" />
            <span>Transparent Out-of-Pocket Math</span>
          </div>
        </div>
      </div>
    </section>
  );
}
