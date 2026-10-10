import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  X,
  RotateCcw,
  Volume2,
  VolumeX,
  Square,
  Sparkles,
  Bot,
  User as UserIcon,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { askAssistant } from '../../services/api';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  SpeechRecognizer,
  speakText,
  stopSpeaking
} from '../../services/speechService';

export default function AskSehatSureDrawer({
  isOpen,
  onClose,
  currentView = 'upload',
  activePolicy = null,
  journeyHospital = null,
  discoveryContext = null,
  token = null
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState(null);
  const [speechError, setSpeechError] = useState(null);
  const [language, setLanguage] = useState('en');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const recognizerRef = useRef(null);

  // Initialize SpeechRecognizer
  useEffect(() => {
    recognizerRef.current = new SpeechRecognizer({
      language: language === 'hi' ? 'hi-IN' : 'en-IN',
      continuous: false,
      interimResults: true,
      onStart: () => {
        setIsListening(true);
        setSpeechError(null);
      },
      onTranscript: (transcript) => {
        setInput(transcript);
      },
      onEnd: () => {
        setIsListening(false);
      },
      onError: (err) => {
        setIsListening(false);
        setSpeechError(err);
      }
    });

    return () => {
      if (recognizerRef.current) {
        recognizerRef.current.abort();
      }
      stopSpeaking();
    };
  }, [language]);

  // Handle panel close: stop speech and mic
  useEffect(() => {
    if (!isOpen) {
      if (recognizerRef.current) recognizerRef.current.abort();
      stopSpeaking();
      setIsListening(false);
      setIsSpeaking(false);
      setActiveSpeakingId(null);
    } else {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 150);
    }
  }, [isOpen]);

  // Scroll to bottom of message list on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Context-aware dynamic suggestions
  const getContextSuggestions = () => {
    if (currentView === 'claims') {
      return [
        'Why was my surgeon fee reduced?',
        'Which hospital bill items are non-payable?',
        'How does a policy amendment change my payable amount?'
      ];
    }
    if (currentView === 'discovery') {
      if (discoveryContext?.procedureName) {
        return [
          `Which are the best hospitals for ${discoveryContext.procedureName}?`,
          `What is my expected out-of-pocket cost for ${discoveryContext.procedureName}?`,
          `Are the top recommended hospitals cashless under my policy?`
        ];
      }
      return [
        'Which hospitals offer cashless settlement for my insurer?',
        'What is the typical cost for a cholecystectomy in private hospitals?',
        'How do I verify if my hospital is an active network partner?'
      ];
    }
    if (currentView === 'journey') {
      return [
        'What documents are required for TPA pre-authorization?',
        'How do I avoid out-of-pocket deductions before admission?',
        'What should I verify at the hospital discharge desk?'
      ];
    }
    if (activePolicy) {
      return [
        'What is my room rent and ICU limit?',
        'Does my policy have a proportionate deduction clause?',
        'What is my co-payment for non-network hospitals?',
        'Are pre-existing conditions covered?'
      ];
    }
    return [
      'What documents do I need to analyze my health insurance?',
      'How does SehatSure calculate out-of-pocket expenses?',
      'Can I compare private and government hospital rates?'
    ];
  };

  const handleSendMessage = async (textToSend = null) => {
    const rawMessage = typeof textToSend === 'string' ? textToSend : input;
    const message = (rawMessage || '').trim();
    if (!message || isLoading) return;

    // Cancel speech and listening
    if (isListening && recognizerRef.current) recognizerRef.current.stop();
    stopSpeaking();
    setIsSpeaking(false);
    setActiveSpeakingId(null);
    setSpeechError(null);

    const userMessage = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-8).map((m) => ({
        sender: m.sender,
        text: m.text
      }));

      const contextPayload = {
        currentView,
        policyId: activePolicy?.id || activePolicy?._id || activePolicy?.key,
        hospitalId: journeyHospital?.id || journeyHospital?._id,
        ...(discoveryContext ? {
          city: discoveryContext.city,
          specialty: discoveryContext.specialty,
          procedureName: discoveryContext.procedureName,
          roomCategory: discoveryContext.roomCategory,
          mode: discoveryContext.mode,
          recommendedHospitals: discoveryContext.recommendedHospitals,
          guidanceText: discoveryContext.guidanceText
        } : {})
      };

      const res = await askAssistant({
        message,
        history: historyPayload,
        context: contextPayload,
        language,
        token
      });

      const assistantMessage = {
        id: `msg_a_${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        evidence: res.evidence,
        provenance: res.provenance,
        confidence: res.confidence,
        suggestedQuestions: res.suggestedQuestions,
        missingInformation: res.missingInformation,
        spokenText: res.spokenText || res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Automatically speak the response if enabled
      if (autoSpeak && isSpeechSynthesisSupported() && assistantMessage.spokenText) {
        handlePlaySpeech(assistantMessage);
      }
    } catch (err) {
      const errorMessage = {
        id: `msg_e_${Date.now()}`,
        sender: 'assistant',
        text: `Error: ${err.message || 'Unable to connect to SehatSure assistant.'}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      if (recognizerRef.current) recognizerRef.current.stop();
      setIsListening(false);
    } else {
      stopSpeaking();
      setIsSpeaking(false);
      setActiveSpeakingId(null);
      setSpeechError(null);
      if (recognizerRef.current) {
        recognizerRef.current.start();
      }
    }
  };

  const handlePlaySpeech = (msg) => {
    if (!isSpeechSynthesisSupported()) {
      setSpeechError({
        code: 'TTS_UNSUPPORTED',
        message: 'Text-to-speech is not supported in this browser.'
      });
      return;
    }

    if (isSpeaking && activeSpeakingId === msg.id) {
      stopSpeaking();
      setIsSpeaking(false);
      setActiveSpeakingId(null);
      return;
    }

    stopSpeaking();
    setIsSpeaking(true);
    setActiveSpeakingId(msg.id);

    const speechLang = language === 'hi' ? 'hi-IN' : 'en-IN';
    speakText(msg.spokenText || msg.text, {
      language: speechLang,
      onStart: () => {
        setIsSpeaking(true);
        setActiveSpeakingId(msg.id);
      },
      onEnd: () => {
        setIsSpeaking(false);
        setActiveSpeakingId(null);
      },
      onError: (err) => {
        setIsSpeaking(false);
        setActiveSpeakingId(null);
      }
    });
  };

  const handleStopSpeaking = () => {
    stopSpeaking();
    setIsSpeaking(false);
    setActiveSpeakingId(null);
  };

  const handleCopyText = (msgId, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetConversation = () => {
    stopSpeaking();
    if (recognizerRef.current) recognizerRef.current.abort();
    setMessages([]);
    setInput('');
    setIsSpeaking(false);
    setActiveSpeakingId(null);
    setSpeechError(null);
  };

  const suggestions = messages.length > 0 && messages[messages.length - 1].suggestedQuestions?.length > 0
    ? messages[messages.length - 1].suggestedQuestions
    : getContextSuggestions();

  if (!isOpen) return null;

  return (
    <div className="ask-sehatsure-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Ask SehatSure Assistant">
      <div
        className="ask-sehatsure-drawer"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ask-drawer-header">
          <div className="ask-header-brand">
            <div className="ask-brand-avatar">
              <Sparkles size={18} className="sparkle-icon" />
              <Bot size={20} />
            </div>
            <div className="ask-brand-text">
              <h3 className="ask-title">Ask SehatSure</h3>
              <span className="ask-badge">Voice & Insurance AI</span>
            </div>
          </div>

          <div className="ask-header-actions">
            {/* Language Selector */}
            <button
              type="button"
              onClick={() => setLanguage((l) => (l === 'en' ? 'hi' : 'en'))}
              className={`ask-pill-toggle ${language === 'hi' ? 'active' : ''}`}
              title="Toggle English / Hindi language"
            >
              {language === 'en' ? 'EN' : 'हिन्दी'}
            </button>

            {/* Auto-Speech Toggle */}
            <button
              type="button"
              onClick={() => {
                if (isSpeaking) handleStopSpeaking();
                setAutoSpeak((prev) => !prev);
              }}
              className={`ask-icon-btn ${autoSpeak ? 'active' : ''}`}
              title={autoSpeak ? 'Spoken Responses ON (click to mute)' : 'Spoken Responses MUTED (click to enable)'}
            >
              {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            {/* Reset Chat */}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleResetConversation}
                className="ask-icon-btn"
                title="Reset conversation"
              >
                <RotateCcw size={15} />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="ask-icon-btn ask-close-btn"
              title="Close Assistant (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Active Context Banner */}
        <div className="ask-context-banner">
          <span className="ask-context-label">Context:</span>
          {currentView === 'claims' && <span className="ask-context-chip claims">Claim Intelligence</span>}
          {currentView === 'discovery' && <span className="ask-context-chip hospital">Hospital Directory</span>}
          {currentView === 'journey' && <span className="ask-context-chip journey">Care Journey</span>}
          {discoveryContext?.procedureName && (
            <span className="ask-context-chip hospital" title={`Specialty: ${discoveryContext.specialty || 'General'}`}>
              {discoveryContext.procedureName}
            </span>
          )}
          {activePolicy ? (
            <span className="ask-context-chip policy" title={activePolicy.insurer || 'Active Policy'}>
              {activePolicy.planName || activePolicy.insurer || 'Policy Active'}
            </span>
          ) : (
            <span className="ask-context-chip neutral">General Healthcare Navigation</span>
          )}
        </div>

        {/* Global Active Audio Banner */}
        {isSpeaking && (
          <div className="ask-audio-banner">
            <div className="ask-audio-pulse">
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
              <span className="wave-bar"></span>
            </div>
            <span className="ask-audio-label">Speaking response...</span>
            <button
              type="button"
              onClick={handleStopSpeaking}
              className="ask-stop-speech-btn"
              title="Stop speaking"
            >
              <Square size={13} fill="currentColor" /> Stop
            </button>
          </div>
        )}

        {/* Speech / Permission Error Banner */}
        {speechError && (
          <div className="ask-error-banner">
            <AlertCircle size={15} className="error-icon" />
            <div className="error-text">
              <span>{speechError.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setSpeechError(null)}
              className="error-dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Conversation Message List */}
        <div className="ask-messages-container">
          {messages.length === 0 ? (
            <div className="ask-welcome-card">
              <div className="welcome-icon-box">
                <Bot size={32} />
              </div>
              <h4>Welcome to Ask SehatSure</h4>
              <p>
                Your conversational insurance and healthcare navigator. Speak or type your question about coverage terms, hospital networks, or itemized bill deductions.
              </p>

              <div className="welcome-hints">
                <span className="hints-heading">Suggested questions to get started:</span>
                <div className="hints-list">
                  {suggestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      className="hint-chip"
                    >
                      <HelpCircle size={13} />
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`ask-message-row ${msg.sender === 'user' ? 'user' : 'assistant'}`}
              >
                <div className="message-avatar">
                  {msg.sender === 'user' ? <UserIcon size={14} /> : <Bot size={14} />}
                </div>

                <div className="message-bubble-wrapper">
                  <div className={`message-bubble ${msg.sender}`}>
                    <div className="message-text">
                      {msg.text.split('\n\n').map((paragraph, pIdx) => (
                        <p key={pIdx}>
                          {paragraph.split('\n').map((line, lIdx) => (
                            <React.Fragment key={lIdx}>
                              {line}
                              {lIdx < paragraph.split('\n').length - 1 && <br />}
                            </React.Fragment>
                          ))}
                        </p>
                      ))}
                    </div>

                    {/* Evidence & Policy Clause Excerpt Accordion */}
                    {msg.evidence && msg.evidence.snippet && (
                      <div className="message-evidence-box">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEvidenceId(expandedEvidenceId === msg.id ? null : msg.id)
                          }
                          className="evidence-toggle-btn"
                        >
                          <FileText size={13} />
                          <span>
                            Supporting Evidence: {msg.evidence.sectionName || 'Policy Excerpt'}
                          </span>
                          {expandedEvidenceId === msg.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {expandedEvidenceId === msg.id && (
                          <div className="evidence-content">
                            <blockquote>"{msg.evidence.snippet}"</blockquote>
                            {msg.evidence.documentStated && (
                              <span className="evidence-badge verified">Document-Stated Fact</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Metadata Footer */}
                    {msg.sender === 'assistant' && !msg.isError && (
                      <div className="message-meta-footer">
                        {msg.provenance && (
                          <span className={`meta-pill provenance ${msg.provenance.toLowerCase().replace(/\s+/g, '-')}`}>
                            {msg.provenance}
                          </span>
                        )}
                        {msg.confidence && (
                          <span className={`meta-pill confidence ${msg.confidence.toLowerCase()}`}>
                            {msg.confidence} Confidence
                          </span>
                        )}

                        <div className="message-actions">
                          <button
                            type="button"
                            onClick={() => handlePlaySpeech(msg)}
                            className={`action-btn ${activeSpeakingId === msg.id ? 'active' : ''}`}
                            title={activeSpeakingId === msg.id ? 'Stop audio' : 'Listen aloud'}
                          >
                            {activeSpeakingId === msg.id ? <Square size={13} /> : <Volume2 size={13} />}
                            <span>{activeSpeakingId === msg.id ? 'Stop' : 'Listen'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.id, msg.text)}
                            className="action-btn"
                            title="Copy response"
                          >
                            {copiedId === msg.id ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="message-timestamp">{msg.timestamp}</span>
                </div>
              </div>
            ))
          )}

          {/* AI Generating Indicator */}
          {isLoading && (
            <div className="ask-message-row assistant">
              <div className="message-avatar">
                <Bot size={14} />
              </div>
              <div className="message-bubble assistant loading">
                <div className="ai-typing-indicator">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
                <span className="loading-text">Analyzing with SehatSure Intelligence...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Interactive Dynamic Suggestions Carousel (Below message stream) */}
        {messages.length > 0 && !isLoading && suggestions.length > 0 && (
          <div className="ask-dynamic-suggestions">
            <span className="dynamic-suggestions-title">Follow-up questions:</span>
            <div className="dynamic-chips-scroll">
              {suggestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  className="dynamic-chip"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Composer Area */}
        <div className="ask-composer-wrapper">
          {/* Active Listening Indicator */}
          {isListening && (
            <div className="listening-pulse-indicator">
              <span className="mic-dot"></span>
              <span>Listening... Speak your insurance or healthcare question</span>
              <button
                type="button"
                onClick={handleToggleMic}
                className="cancel-listening-btn"
              >
                Stop
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="ask-composer-form"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                isListening
                  ? 'Transcribing speech...'
                  : language === 'hi'
                  ? 'अपना सवाल यहाँ टाइप करें या बोलें...'
                  : 'Ask about coverage, limits, hospitals, or deductions...'
              }
              className={`ask-composer-textarea ${isListening ? 'listening' : ''}`}
            />

            <div className="ask-composer-buttons">
              {/* Microphone Button */}
              <button
                type="button"
                onClick={handleToggleMic}
                className={`ask-mic-btn ${isListening ? 'listening' : ''}`}
                title={
                  !isSpeechRecognitionSupported()
                    ? 'Voice recognition not supported in this browser'
                    : isListening
                    ? 'Click to stop listening'
                    : 'Click to speak question'
                }
                disabled={!isSpeechRecognitionSupported()}
              >
                {isListening ? (
                  <MicOff size={18} className="mic-listening-pulse" />
                ) : (
                  <Mic size={18} />
                )}
              </button>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="ask-send-btn"
                title="Send message (Enter)"
              >
                <Send size={16} />
              </button>
            </div>
          </form>

          <div className="ask-composer-caption">
            <span>Ask SehatSure provides healthcare decision intelligence • Review official TPA documents at admission</span>
          </div>
        </div>
      </div>
    </div>
  );
}
