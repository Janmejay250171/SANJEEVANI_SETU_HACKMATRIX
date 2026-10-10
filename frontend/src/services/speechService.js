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
 * Creates and manages an active SpeechRecognition session
 */
export class SpeechRecognizer {
  constructor(options = {}) {
    this.options = {
      language: options.language || 'en-IN',
      continuous: options.continuous ?? false,
      interimResults: options.interimResults ?? true,
      onTranscript: options.onTranscript || (() => {}),
      onStart: options.onStart || (() => {}),
      onEnd: options.onEnd || (() => {}),
      onError: options.onError || (() => {})
    };

    this.recognition = null;
    this.isListening = false;
    this.finalTranscript = '';
  }

  start() {
    if (!isSpeechRecognitionSupported()) {
      this.options.onError({
        code: 'NOT_SUPPORTED',
        message: 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.'
      });
      return false;
    }

    if (this.isListening) {
      this.stop();
    }

    try {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognitionClass();
      this.recognition.lang = this.options.language;
      this.recognition.continuous = this.options.continuous;
      this.recognition.interimResults = this.options.interimResults;
      this.finalTranscript = '';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.options.onStart();
      };

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            this.finalTranscript += item[0].transcript;
          } else {
            interim += item[0].transcript;
          }
        }
        const full = (this.finalTranscript + ' ' + interim).trim();
        this.options.onTranscript(full, Boolean(this.finalTranscript));
      };

      this.recognition.onerror = (event) => {
        let message = 'Speech recognition error occurred.';
        let code = event.error || 'UNKNOWN';

        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            message = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
            break;
          case 'no-speech':
            message = 'No speech was detected. Please click the microphone and try speaking again.';
            break;
          case 'audio-capture':
            message = 'No microphone could be found or capture failed. Please check your audio input device.';
            break;
          case 'network':
            message = 'Network connection issue during speech recognition. You can still type your question.';
            break;
          case 'aborted':
            // Harmless user cancellation
            return;
          default:
            message = `Speech error: ${event.error}`;
        }

        this.options.onError({ code, message });
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.options.onEnd();
      };

      this.recognition.start();
      return true;
    } catch (err) {
      this.isListening = false;
      this.options.onError({
        code: 'INITIALIZATION_FAILED',
        message: err.message || 'Could not start microphone session.'
      });
      return false;
    }
  }

  stop() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
  }

  abort() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
    }
    this.isListening = false;
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
      onStart();
    };

    utterance.onend = () => {
      activeUtterance = null;
      onEnd();
    };

    utterance.onerror = (e) => {
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
    onError(err);
    return false;
  }
}
