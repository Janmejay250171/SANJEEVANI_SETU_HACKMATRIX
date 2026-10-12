/**
 * SehatSure Web Speech API Service
 * Handles Browser Speech-to-Text (STT) and Text-to-Speech (TTS)
 */

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

/**
 * Healthcare and Indian insurance domain phonetic STT correction
 * Corrects typical speech recognition slips, mishearings, and word merges
 */
const STT_REPLACEMENTS = [
  // Brand name
  [/\b(?:see\s*hat\s*sure|sehat\s*shore|sehat\s*shure|sehat\s*sur|say\s*hath\s*sure|sehat\s*sir)\b/gi, 'SehatSure'],

  // Core Insurance & Healthcare Terminology
  [/\b(?:some\s*insured|sum\s*ensure|sum\s*insurer|some\s*insurer)\b/gi, 'sum insured'],
  [/\b(?:cope\s*pay|co\s*paying|cope\s*payment|co\s+pay)\b/gi, 'copay'],
  [/\b(?:room\s*rate|room\s*rent\s*rates)\b/gi, 'room rent'],
  [/\b(?:tea\s*pee\s*a|t\s*p\s*a|t\.p\.a\.)\b/gi, 'TPA'],
  [/\b(?:i\s*c\s*u|i\.c\.u\.)\b/gi, 'ICU'],
  [/\b(?:p\s*m\s*j\s*a\s*y|p\s*m\s*jay|pm\s*jay|pmjay)\b/gi, 'PM-JAY'],
  [/\b(?:e\s*s\s*i|e\.s\.i\.)\b/gi, 'ESI'],
  [/\b(?:e\s*s\s*i\s*c|e\.s\.i\.c\.)\b/gi, 'ESIC'],
  [/\b(?:ayushman\s*bhart|ayush\s*man\s*bharat)\b/gi, 'Ayushman Bharat'],
  [/\b(?:cash\s*less)\b/gi, 'cashless'],
  [/\b(?:non\s*network)\b/gi, 'non-network'],
  [/\b(?:out\s*of\s*packet)\b/gi, 'out-of-pocket'],
  [/\b(?:pre\s*auth|pre\s*authorization)\b/gi, 'pre-authorization'],
  [/\b(?:cat\s*rack|cat\s*racks)\b/gi, 'cataract'],
  [/\b(?:medi\s*claim)\b/gi, 'mediclaim'],
  [/\b(?:in\s*panelled|impanelled|in\s*panel)\b/gi, 'empanelled'],
  [/\b(?:day\s*care)\b/gi, 'daycare'],
  [/\b(?:laproscopy|laproscopic)\b/gi, 'laparoscopic'],
  [/\b(?:pre\s*existing)\b/gi, 'pre-existing'],
  [/\b(?:sub\s*limit|sub\s*limits)\b/gi, 'sublimit'],
  [/\b(?:de\s*ductable|deductables)\b/gi, 'deductible'],
  [/\b(?:rhinoplasti|rino\s*plasty)\b/gi, 'rhinoplasty'],
  [/\b(?:bio\s*resonance)\b/gi, 'bioresonance']
];

export function deduplicateRepeatedPhrases(text) {
  if (!text) return '';
  let str = text;

  // 1. Multi-word phrase deduplication (up to 8 consecutive words repeated)
  const phraseRegex = /(?:^|\s)([\p{L}\p{N}\p{M}\-]+(?:\s+[\p{L}\p{N}\p{M}\-]+){0,7})(?:\s+\1)+(?=\s|$|[.,?!])/giu;

  let prev = '';
  let count = 0;
  while (str !== prev && count < 3) {
    prev = str;
    str = str.replace(phraseRegex, (match, p1) => {
      const leadingSpace = match.startsWith(' ') ? ' ' : '';
      return leadingSpace + p1;
    });
    count++;
  }

  // 2. Token-level duplicate check for adjacent identical words (e.g. "what what", "is is")
  str = str.replace(/\b([\p{L}\p{N}\p{M}\-]+)\s+\1\b/giu, '$1');

  return str.replace(/\s+/g, ' ').trim();
}

export function cleanAndCorrectSpeechText(text) {
  if (!text) return '';
  let cleaned = text;

  // 1. Remove repeated phrases and words
  cleaned = deduplicateRepeatedPhrases(cleaned);

  // 2. Apply healthcare phonetic fixes
  for (const [pattern, replacement] of STT_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // 3. Deduplicate again in case phonetic replacement created duplicates
  cleaned = deduplicateRepeatedPhrases(cleaned);

  // 4. Clean redundant spaces and punctuation glitches
  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,?!])/g, '$1')
    .trim();

  return cleaned;
}

/**
 * Merges finalized text and interim speech without repeating overlapping phrases
 */
export function mergeFinalAndInterim(finalText, interimText) {
  if (!finalText) return interimText ? interimText.trim() : '';
  if (!interimText) return finalText ? finalText.trim() : '';

  const f = finalText.trim();
  const i = interimText.trim();
  const fLower = f.toLowerCase();
  const iLower = i.toLowerCase();

  // If interim text is already completely contained at the end of final text, ignore it
  if (fLower === iLower || fLower.endsWith(' ' + iLower)) {
    return f;
  }

  // If final text is already inside interim at start, return interim
  if (iLower.startsWith(fLower + ' ')) {
    return i;
  }

  // Check word overlap from max possible overlap down to 1 word
  const fWords = f.split(/\s+/);
  const iWords = i.split(/\s+/);

  const maxOverlap = Math.min(fWords.length, iWords.length);
  for (let len = maxOverlap; len >= 1; len--) {
    const fSlice = fWords.slice(-len).join(' ').toLowerCase();
    const iSlice = iWords.slice(0, len).join(' ').toLowerCase();
    if (fSlice === iSlice) {
      const remainingInterim = iWords.slice(len).join(' ');
      return remainingInterim ? `${f} ${remainingInterim}` : f;
    }
  }

  return `${f} ${i}`;
}

let isAssistantSpeaking = false;

export function isSpeakingNow() {
  return isAssistantSpeaking;
}

/**
 * Creates and manages an active SpeechRecognition session with high-accuracy
 * continuous listening, space preservation, and domain terminology awareness.
 */
export class SpeechRecognizer {
  constructor(options = {}) {
    this.options = {
      language: options.language || 'en-IN',
      continuous: options.continuous ?? true,
      interimResults: options.interimResults ?? true,
      onTranscript: options.onTranscript || (() => {}),
      onStart: options.onStart || (() => {}),
      onEnd: options.onEnd || (() => {}),
      onError: options.onError || (() => {})
    };

    this.recognition = null;
    this.isListening = false;
    this.isStarting = false;
    this.shouldStayListening = false;
    this.finalResults = new Map();
    this.sessionFinalText = '';
    this.interimTranscript = '';
  }

  _cleanupRecognition() {
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.isListening = false;
    this.isStarting = false;
  }

  start() {
    if (!isSpeechRecognitionSupported()) {
      this.options.onError({
        code: 'NOT_SUPPORTED',
        message: 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
      });
      return false;
    }

    // Echo suppression: stop TTS if assistant is currently speaking
    if (isSpeakingNow()) {
      stopSpeaking();
    }

    if (this.isListening || this.isStarting) {
      this._cleanupRecognition();
    }

    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.lang = this.options.language;
      this.recognition.continuous = this.options.continuous;
      this.recognition.interimResults = this.options.interimResults;
      this.recognition.maxAlternatives = 3;
      this.isStarting = true;
      this.shouldStayListening = true;

      this.recognition.onstart = () => {
        this.isStarting = false;
        this.isListening = true;
        this.options.onStart();
      };

      this.recognition.onresult = (event) => {
        // Echo suppression: if assistant is speaking through speakers, drop recognition
        if (isSpeakingNow()) {
          return;
        }

        const interimParts = [];

        // Accumulate final results by index to guarantee each result is processed once
        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (!res || !res[0]) continue;

          let bestText = res[0].transcript || '';
          if (res.length > 1) {
            const healthcareRegex = /policy|claim|hospital|cashless|copay|co-pay|deductible|room rent|sum insured|tpa|icu|ayushman|pmjay|esi|cataract|surgery|coverage|pre-auth|mediclaim|sehatsure|laparoscopic|appendectomy|rhinoplasty/i;
            for (let a = 0; a < res.length; a++) {
              if (res[a] && healthcareRegex.test(res[a].transcript)) {
                bestText = res[a].transcript;
                break;
              }
            }
          }

          if (res.isFinal) {
            this.finalResults.set(i, bestText.trim());
          } else {
            interimParts.push(bestText.trim());
          }
        }

        const currentFinal = Array.from(this.finalResults.values()).join(' ').trim();
        const combinedFinal = mergeFinalAndInterim(this.sessionFinalText, currentFinal);
        const rawInterim = interimParts.join(' ').trim();

        // Merge final and interim without repeating words across boundaries
        const fullRaw = mergeFinalAndInterim(combinedFinal, rawInterim);
        const full = cleanAndCorrectSpeechText(fullRaw);

        this.options.onTranscript(full, Boolean(combinedFinal));
      };

      this.recognition.onerror = (event) => {
        let message = 'Speech recognition error occurred.';
        let code = event.error || 'UNKNOWN';

        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            message = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
            this.shouldStayListening = false;
            break;
          case 'no-speech':
            // In continuous mode, no-speech is a temporary silence pause; do not interrupt user
            if (this.shouldStayListening) {
              return;
            }
            message = 'No speech detected. Please speak into your microphone.';
            break;
          case 'audio-capture':
            message = 'No microphone could be found or capture failed. Please check your audio input device.';
            this.shouldStayListening = false;
            break;
          case 'network':
            message = 'Network connection issue during speech recognition. You can still type your question.';
            this.shouldStayListening = false;
            break;
          case 'aborted':
            return;
          default:
            message = `Speech error: ${event.error}`;
        }

        this.options.onError({ code, message });
      };

      this.recognition.onend = () => {
        // If user is still supposed to be speaking in continuous mode, preserve final text and reconnect
        if (this.shouldStayListening && this.options.continuous) {
          const currentFinal = Array.from(this.finalResults.values()).join(' ').trim();
          this.sessionFinalText = mergeFinalAndInterim(this.sessionFinalText, currentFinal);
          this.finalResults.clear();
          this.interimTranscript = '';
          try {
            this.recognition.start();
            return;
          } catch {}
        }
        this.isListening = false;
        this.isStarting = false;
        this.options.onEnd();
      };

      this.recognition.start();
      return true;
    } catch (err) {
      this.isListening = false;
      this.isStarting = false;
      this.shouldStayListening = false;
      this.options.onError({
        code: 'INITIALIZATION_FAILED',
        message: err.message || 'Could not start microphone session.'
      });
      return false;
    }
  }

  stop() {
    this.shouldStayListening = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
    this.isStarting = false;
  }

  abort() {
    this.shouldStayListening = false;
    this._cleanupRecognition();
  }

  reset() {
    this.finalResults.clear();
    this.sessionFinalText = '';
    this.interimTranscript = '';
  }

  destroy() {
    this.shouldStayListening = false;
    this._cleanupRecognition();
    this.reset();
  }
}

/**
 * Clean text for Speech Synthesis
 */
export function sanitizeSpeechText(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '') // remove code
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_~>]/g, '')
    .replace(/^[-\t*+] /gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/₹/g, 'Rupees ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text-to-Speech manager using browser SpeechSynthesis
 */
let activeUtterance = null;

export function stopSpeaking() {
  isAssistantSpeaking = false;
  if (!isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  } catch {}
}

export function speakText(text, options = {}) {
  if (!isSpeechSynthesisSupported() || !text) return false;

  const {
    language = 'en-IN',
    onStart = () => {},
    onEnd = () => {},
    onError = () => {}
  } = options;

  stopSpeaking();

  const clean = sanitizeSpeechText(text);
  if (!clean) return false;

  try {
    isAssistantSpeaking = true;
    const utterance = new window.SpeechSynthesisUtterance(clean);
    utterance.lang = language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const isHindi = language.toLowerCase().startsWith('hi');
      const voice = voices.find((v) => {
        if (isHindi) {
          return v.lang.includes('hi') || v.name.toLowerCase().includes('hindi');
        }
        return (
          v.lang.toLowerCase() === 'en-in' ||
          v.name.toLowerCase().includes('india') ||
          v.lang.toLowerCase().startsWith('en')
        );
      });
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => {
      isAssistantSpeaking = true;
      onStart();
    };

    utterance.onend = () => {
      isAssistantSpeaking = false;
      activeUtterance = null;
      onEnd();
    };

    utterance.onerror = (e) => {
      isAssistantSpeaking = false;
      activeUtterance = null;
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        onError(e);
      } else {
        onEnd();
      }
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    isAssistantSpeaking = false;
    onError(err);
    return false;
  }
}
