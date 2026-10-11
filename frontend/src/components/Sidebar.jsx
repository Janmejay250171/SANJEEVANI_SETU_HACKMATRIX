import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileUp,
  Scale,
  FolderArchive,
  FileText,
  Building2,
  Compass,
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export default function Sidebar({
  currentView,
  activePolicy,
  onGoHome,
  onGoToClaims,
  onOpenSavedDocuments,
  onBackToPolicy,
  onGoToHospitals,
  onGoToJourney,
  onGoHowItWorks,
  onOpenAssistant,
  isCollapsed,
  onToggleCollapse
}) {
  const { t } = useTranslation();

  const navItems = [
    {
      id: 'upload',
      label: t('navbar.uploadPolicy', 'Upload Policy'),
      shortLabel: 'Upload',
      icon: FileUp,
      onClick: onGoHome,
      active: currentView === 'upload',
      show: true
    },
    {
      id: 'claims',
      label: 'Claim Intelligence',
      shortLabel: 'Claims',
      icon: Scale,
      onClick: onGoToClaims,
      active: currentView === 'claims',
      show: true
    },
    {
      id: 'saved-docs',
      label: 'Saved Documents',
      shortLabel: 'Saved Docs',
      icon: FolderArchive,
      onClick: onOpenSavedDocuments,
      active: false,
      show: true
    },
    {
      id: 'summary',
      label: t('navbar.policySummary', 'Policy Summary'),
      shortLabel: 'Summary',
      icon: FileText,
      onClick: onBackToPolicy,
      active: currentView === 'summary',
      show: Boolean(activePolicy)
    },
    {
      id: 'hospitals',
      label: t('navbar.hospitals', 'Hospital Discovery'),
      shortLabel: 'Hospitals',
      icon: Building2,
      onClick: onGoToHospitals,
      active: currentView === 'discovery',
      show: Boolean(activePolicy && activePolicy.confirmedByUser)
    },
    {
      id: 'journey',
      label: t('navbar.careJourney', 'Care Journey'),
      shortLabel: 'Journey',
      icon: Compass,
      onClick: onGoToJourney,
      active: currentView === 'journey',
      show: Boolean(activePolicy && activePolicy.confirmedByUser)
    },
    {
      id: 'assistant',
      label: 'Ask SehatSure',
      shortLabel: 'Ask AI',
      icon: Sparkles,
      onClick: onOpenAssistant,
      active: false,
      highlight: true,
      show: true
    },
    {
      id: 'how-it-works',
      label: t('navbar.howItWorks', 'How It Works'),
      shortLabel: 'Guide',
      icon: HelpCircle,
      onClick: onGoHowItWorks,
      active: currentView === 'how-it-works',
      show: true
    }
  ];

  return (
    <aside
      className={`app-sidebar ${isCollapsed ? 'app-sidebar-collapsed' : ''}`}
      aria-label="Primary Left Navigation"
    >
      {/* Brand Header */}
      <div className="sidebar-brand-box">
        <button
          type="button"
          onClick={onGoHome}
          className="sidebar-brand-btn"
          title="SehatSure Home"
        >
          <img
            src="/sehatsure-logo.png"
            alt="SehatSure Logo"
            className="sidebar-logo-img"
          />
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">SehatSure</span>
              <span className="sidebar-brand-sub">Healthcare AI</span>
            </div>
          )}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav-list" role="navigation">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`sidebar-nav-item ${item.active ? 'active' : ''} ${
                  item.highlight ? 'sidebar-nav-highlight' : ''
                }`}
                title={item.label}
                aria-current={item.active ? 'page' : undefined}
              >
                <span className="sidebar-nav-icon">
                  <Icon size={18} />
                </span>
                {!isCollapsed && (
                  <span className="sidebar-nav-label">{item.label}</span>
                )}
                {item.active && !isCollapsed && (
                  <span className="sidebar-active-indicator" />
                )}
              </button>
            );
          })}
      </nav>

      {/* Sidebar Footer with Collapse Toggle */}
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="sidebar-collapse-toggle-btn"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!isCollapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
