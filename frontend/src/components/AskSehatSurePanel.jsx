import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  X,
  FileText,
  AlertTriangle,
  IndianRupee,
  Check,
  Copy,
  ChevronRight,
  Sparkles,
  Shield,
  HelpCircle,
  RefreshCw,
  Info
} from 'lucide-react';
import { askPolicyQuestionApi } from '../services/api';
import { renderFormattedText } from '../utils/textFormatter';

const DEFAULT_SUGGESTIONS = [
  'What is my room-rent limit?',
  'Do I have a co-payment?',
  'What does my policy exclude?'
];

export default function AskSehatSurePanel({ isOpen, onClose, policy }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading || !policy?._id) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      // Build lightweight history context
      const historyContext = nextMessages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text
      }));

      const res = await askPolicyQuestionApi(policy._id, text, historyContext);

      const assistantMsg = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        text: res.answer || 'I could not find an answer for that policy question.',
        evidence: res.evidence,
        provenance: res.provenance || 'Document-Stated',
        confidence: res.confidence || 'High',
        missingInformation: res.missingInformation || [],
        costEstimate: res.costEstimate || null,
        suggestedQuestions: res.suggestedQuestions || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('[AskSehatSure Error]:', err);
      const errorMsg = {
        id: `err_${Date.now()}`,
        sender: 'assistant',
        text: "SehatSure couldn't determine this from the available policy information right now. Please verify your policy document.",
        confidence: 'Low',
        provenance: 'System Assessment',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopySnippet = (snippet, id) => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([]);
    setInputValue('');
  };

  if (!isOpen) return null;

  return (
    <div className="sehat-drawer-backdrop" onClick={onClose}>
      <aside
        className="sehat-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ask SehatSure Policy Assistant"
      >
        {/* Drawer Header */}
        <div className="sehat-drawer-header">
          <div className="sehat-drawer-header-left">
            <div className="sehat-drawer-brand-badge">
              <Sparkles size={14} className="sehat-drawer-sparkle" />
              <span>ASK SEHATSURE</span>
            </div>
            <h2 className="sehat-drawer-title">Understand your uploaded policy</h2>
            <div className="sehat-drawer-policy-chip" title={policy?.insurer || 'Policy'}>
              <span className="sehat-drawer-dot" />
              <span className="sehat-drawer-policy-name">
                {policy?.insurer || 'Health Insurer'}
                {policy?.planName ? ` • ${policy.planName}` : ''}
              </span>
            </div>
          </div>

          <div className="sehat-drawer-header-actions">
            {messages.length > 0 && (
              <button
                type="button"
                className="sehat-drawer-btn-icon"
                onClick={handleResetChat}
                title="Reset conversation"
              >
                <RefreshCw size={15} />
              </button>
            )}
            <button
              type="button"
              className="sehat-drawer-btn-close"
              onClick={onClose}
              title="Close panel (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Message Area */}
        <div className="sehat-drawer-messages">
          {messages.length === 0 ? (
            <div className="sehat-drawer-welcome">
              <div className="sehat-drawer-welcome-icon">
                <MessageSquare size={28} />
              </div>
              <h3 className="sehat-drawer-welcome-title">Ask a question about your policy...</h3>
              <p className="sehat-drawer-welcome-sub">
                Answers are grounded strictly in your uploaded schedule with page citations, extracted provenance, and confidence levels.
              </p>

              <div className="sehat-drawer-suggestions-box">
                <div className="sehat-drawer-suggestions-label">Suggested questions:</div>
                <div className="sehat-drawer-suggestions-grid">
                  {DEFAULT_SUGGESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="sehat-drawer-suggestion-btn"
                      onClick={() => handleSendMessage(q)}
                    >
                      <span>• {q}</span>
                      <ChevronRight size={13} className="sehat-drawer-suggestion-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="sehat-drawer-thread">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`sehat-msg ${m.sender === 'user' ? 'sehat-msg-user' : 'sehat-msg-assistant'}`}
                >
                  <div className="sehat-msg-bubble">
                    {/* Message Header (for assistant) */}
                    {m.sender === 'assistant' && (
                      <div className="sehat-msg-header">
                        <div className="sehat-msg-brand">
                          <Sparkles size={12} color="var(--color-primary)" />
                          <span>SehatSure Policy Intelligence</span>
                        </div>
                        <span className="sehat-msg-time">{m.timestamp}</span>
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="sehat-msg-text">
                      {m.text.split('\n\n').map((paragraph, pIdx) => (
                        <p key={pIdx} style={{ margin: pIdx === 0 ? 0 : '10px 0 0 0' }}>
                          {paragraph.split('\n').map((line, lIdx) => (
                            <React.Fragment key={lIdx}>
                              {lIdx > 0 && <br />}
                              {formatFormattedText(line)}
                            </React.Fragment>
                          ))}
                        </p>
                      ))}
                    </div>

                    {/* Missing Information Callout */}
                    {m.missingInformation && m.missingInformation.length > 0 && (
                      <div className="sehat-card-missing-info">
                        <div className="sehat-card-missing-header">
                          <AlertTriangle size={15} style={{ color: '#d97706', flexShrink: 0 }} />
                          <strong>Information Missing from Uploaded Document:</strong>
                        </div>
                        <ul className="sehat-card-missing-list">
                          {m.missingInformation.map((info, iIdx) => (
                            <li key={iIdx}>{info}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cost Estimate & OOP Breakdown Card */}
                    {m.costEstimate && (
                      <div className="sehat-card-cost-estimate">
                        <div className="sehat-card-cost-header">
                          <IndianRupee size={16} color="var(--color-primary)" />
                          <strong>Treatment Cost & Out-of-Pocket Estimate</strong>
                        </div>

                        {m.costEstimate.procedureName && (
                          <div className="sehat-card-cost-procedure">
                            {m.costEstimate.procedureName}
                          </div>
                        )}

                        <div className="sehat-card-cost-grid">
                          <div className="sehat-card-cost-col">
                            <span className="sehat-card-cost-col-label">Estimated Treatment</span>
                            <span className="sehat-card-cost-col-val">{m.costEstimate.treatmentCostRange}</span>
                          </div>
                          <div className="sehat-card-cost-col">
                            <span className="sehat-card-cost-col-label">Potentially Covered</span>
                            <span className="sehat-card-cost-col-val" style={{ color: '#166534' }}>
                              {m.costEstimate.coveredRange}
                            </span>
                          </div>
                          <div className="sehat-card-cost-col">
                            <span className="sehat-card-cost-col-label">Estimated Patient OOP</span>
                            <span className="sehat-card-cost-col-val" style={{ color: '#b45309' }}>
                              {m.costEstimate.oopRange}
                            </span>
                          </div>
                        </div>

                        {m.costEstimate.explanation && (
                          <p className="sehat-card-cost-expl">{m.costEstimate.explanation}</p>
                        )}

                        {m.costEstimate.assumptions && m.costEstimate.assumptions.length > 0 && (
                          <div className="sehat-card-cost-assumptions">
                            <span className="sehat-card-cost-assumptions-title">Key Assumptions:</span>
                            <ul>
                              {m.costEstimate.assumptions.map((assump, aIdx) => (
                                <li key={aIdx}>{assump}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="sehat-card-cost-disclaimer">
                          <Info size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                          <span>
                            Subject to applicable policy conditions, exclusions, and pre-authorization. Does not constitute a final claim settlement guarantee.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Evidence & Provenance Block (assistant only) */}
                    {m.sender === 'assistant' && m.evidence && (
                      <div className="sehat-card-evidence">
                        <div className="sehat-card-evidence-header">
                          <div className="sehat-card-evidence-title">
                            <FileText size={13} style={{ color: 'var(--color-primary)' }} />
                            <span>
                              Evidence: Page {m.evidence.pageNumber || '1'} • {m.evidence.sectionName || 'Policy Terms'}
                            </span>
                          </div>

                          <div className="sehat-card-badges-group">
                            {/* Provenance Badge */}
                            <span
                              className={`sehat-provenance-pill sehat-provenance-${(
                                m.provenance || 'document-stated'
                              )
                                .toLowerCase()
                                .replace(/\s+/g, '-')}`}
                            >
                              {m.provenance || 'Document-Stated'}
                            </span>

                            {/* Confidence Badge */}
                            <span
                              className={`sehat-confidence-pill sehat-confidence-${(
                                m.confidence || 'high'
                              ).toLowerCase()}`}
                            >
                              {m.confidence || 'High'} Confidence
                            </span>
                          </div>
                        </div>

                        {m.evidence.snippet ? (
                          <div className="sehat-card-evidence-quote-box">
                            <blockquote className="sehat-card-evidence-quote">
                              "{m.evidence.snippet}"
                            </blockquote>
                            <button
                              type="button"
                              className="sehat-card-copy-btn"
                              onClick={() => handleCopySnippet(m.evidence.snippet, m.id)}
                              title="Copy evidence snippet"
                            >
                              {copiedId === m.id ? (
                                <>
                                  <Check size={12} color="#166534" />
                                  <span style={{ color: '#166534' }}>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="sehat-card-evidence-unavailable">
                            Page-level evidence unavailable from the current extraction.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Follow-up Questions Chips */}
                    {m.suggestedQuestions && m.suggestedQuestions.length > 0 && (
                      <div className="sehat-msg-followups">
                        <span className="sehat-msg-followups-title">Related questions:</span>
                        <div className="sehat-msg-followups-chips">
                          {m.suggestedQuestions.slice(0, 3).map((fq, fIdx) => (
                            <button
                              key={fIdx}
                              type="button"
                              className="sehat-followup-chip"
                              onClick={() => handleSendMessage(fq)}
                            >
                              {fq}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="sehat-msg sehat-msg-assistant">
                  <div className="sehat-msg-bubble sehat-msg-loading">
                    <div className="sehat-loading-dots">
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="sehat-loading-label">Grounding response in your uploaded policy...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Drawer Input Area */}
        <div className="sehat-drawer-footer">
          <form
            className="sehat-drawer-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="sehat-drawer-input"
              placeholder="Ask a question about your policy..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              maxLength={400}
            />
            <button
              type="submit"
              className="sehat-drawer-send-btn"
              disabled={!inputValue.trim() || isLoading}
              title="Send question"
              aria-label="Send question"
            >
              <Send size={16} />
            </button>
          </form>
          <div className="sehat-drawer-disclaimer">
            Ask SehatSure is grounded exclusively in your uploaded policy schedule. Non-network terms remain unassumed.
          </div>
        </div>
      </aside>
    </div>
  );
}

/**
 * Lightweight helper to format basic markdown elements like **bold** in plain lines.
 */
function formatFormattedText(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
