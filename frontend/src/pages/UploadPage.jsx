import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LandingHero from '../components/LandingHero';
import UploadZone from '../components/UploadZone';
import DemoPicker from '../components/DemoPicker';
import SteppedLoader from '../components/SteppedLoader';
import { uploadPolicyPdf, createPolicyFromDemo, getDemoPolicies } from '../services/api';
import { AlertCircle, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function UploadPage({ onPolicyLoaded, onRequireAuth }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [demos, setDemos] = useState([]);

  useEffect(() => {
    getDemoPolicies()
      .then((data) => {
        const activeDemos = (data || []).filter(
          (d) => d.key !== 'sbi-general' && d.id !== 'pol_demo_sbi'
        );
        setDemos(activeDemos);
      })
      .catch((err) => {
        console.warn('Could not fetch demo policies dynamically:', err);
        setDemos([
          {
            id: 'pol_demo_star',
            key: 'star-health',
            title: 'Star Health (Private)',
            insurer: 'Star Health',
            planName: 'Family Health Optima',
            policyType: 'private',
            description: '₹3L Sum Insured • ₹3,000/day room cap • 10% co-pay • Proportionate deduction',
            badge: 'Retail Floater'
          },
          {
            id: 'pol_demo_hdfc',
            key: 'hdfc-ergo',
            title: 'HDFC ERGO (Corporate Group)',
            insurer: 'HDFC ERGO',
            planName: 'Corporate Group Health Shield',
            policyType: 'corporate',
            description: '₹5L Sum Insured • 1% room cap • 0% co-pay • Employer group restoration',
            badge: 'Employer Group'
          },
          {
            id: 'pol_demo_pmjay',
            key: 'pmjay',
            title: 'PM-JAY (Ayushman Bharat)',
            insurer: 'National Health Authority',
            planName: 'Pradhan Mantri Jan Arogya Yojana',
            policyType: 'pmjay',
            description: '₹5L Cashless cover • No room cap • 0% co-pay • Empanelled network',
            badge: 'Govt Scheme'
          },
          {
            id: 'pol_demo_esi',
            key: 'esi',
            title: 'ESI (Employee State Insurance)',
            insurer: 'Employees State Insurance Corporation',
            planName: 'ESIC Medical Benefit Scheme',
            policyType: 'esi',
            description: 'Unlimited SI • Zero room cap • 0% co-pay • ESIC network tie-ups',
            badge: 'Statutory Cover'
          }
        ]);
      });
  }, []);

  const handleFileUpload = async (file) => {
    if (!user) {
      if (onRequireAuth) {
        onRequireAuth('Please log in first to upload and analyze your insurance policy.');
      }
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await uploadPolicyPdf(file);
      onPolicyLoaded(response.policy);
    } catch (err) {
      console.error('File upload error:', err);
      setErrorMessage(err.message || 'Could not analyze document.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDemoSelect = async (key) => {
    if (!user) {
      if (onRequireAuth) {
        onRequireAuth('Please log in first to test and explore demo policies.');
      }
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const response = await createPolicyFromDemo(key);
      onPolicyLoaded(response.policy);
    } catch (err) {
      console.error('Demo policy error:', err);
      setErrorMessage(err.message || 'Failed to load demo policy.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScrollToUpload = () => {
    const el = document.getElementById('upload-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleScrollToDemos = () => {
    const el = document.getElementById('demo-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="upload-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--section-gap)' }}>
      {isProcessing && <SteppedLoader />}

      {/* Cinematic AI Hero with restrained canvas animation */}
      <LandingHero
        onUploadClick={handleScrollToUpload}
        onDemoClick={handleScrollToDemos}
      />

      {/* Login Required Notice when logged out */}
      {!user && (
        <div
          className="upload-login-notice"
          style={{
            background: 'var(--color-teal-light)',
            border: '1px solid var(--color-teal-border)',
            borderRadius: '14px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: 'var(--shadow-soft)',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Lock size={20} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text)' }}>
                Please Log In First
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                You must be logged in to upload policy PDFs, view coverage calculations, and explore network hospitals.
              </div>
            </div>
          </div>

          <button
            type="button"
            className="pill-btn pill-btn-primary"
            style={{ fontWeight: 700, padding: '9px 18px', fontSize: '13.5px' }}
            onClick={() => onRequireAuth?.('Please log in first to upload and analyze your insurance policy.')}
          >
            Log In / Sign Up
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="form-alert form-alert-error">
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Document Processing Notice: </strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <div id="upload-card">
        <UploadZone
          onFileSelected={handleFileUpload}
          disabled={isProcessing}
          isLoggedIn={!!user}
          onRequireAuth={onRequireAuth}
        />
      </div>

      {/* Demo Policies */}
      <DemoPicker
        demos={demos}
        onSelectDemo={handleDemoSelect}
        disabled={isProcessing}
        isLoggedIn={!!user}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}
