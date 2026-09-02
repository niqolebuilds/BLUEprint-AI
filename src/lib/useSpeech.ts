import { useEffect, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
}

/**
 * Thin wrapper over the Web Speech API. Streams final transcript chunks to
 * `onChunk`; exposes `supported` so the UI can hide the mic gracefully.
 */
export function useSpeech(onChunk: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onChunkRef = useRef(onChunk);
  onChunkRef.current = onChunk;

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : undefined;
  const supported = Boolean(SpeechRecognitionCtor);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const start = async () => {
    if (!SpeechRecognitionCtor || listening || loading) return;
    setError(null);
    setLoading(true);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      }
    } catch (err: any) {
      console.warn('getUserMedia permission request failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access was blocked. Please enable it in your browser settings.');
        setLoading(false);
        return;
      }
    }

    try {
      const recognition: SpeechRecognitionLike = new SpeechRecognitionCtor();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;
      
      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            onChunkRef.current(result[0].transcript.trim() + ' ');
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error event:', event);
        const errType = event?.error;
        if (errType === 'not-allowed') {
          setError('Microphone access was blocked.');
        } else if (errType === 'no-speech') {
          setError('No speech detected. Speak clearly.');
        } else if (errType === 'network') {
          setError('Network error occurred during speech recognition.');
        } else {
          setError(`Speech recognition issue (${errType || 'unknown'}) — try again.`);
        }
        setListening(false);
        setLoading(false);
      };

      recognition.onend = () => {
        setListening(false);
        setLoading(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setError('Could not initialize speech recognition. Try refreshing or using Chrome.');
      setLoading(false);
      setListening(false);
    }
  };

  const stop = () => {
    recognitionRef.current?.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setListening(false);
    setLoading(false);
  };

  return { supported, listening, loading, error, start, stop };
}
