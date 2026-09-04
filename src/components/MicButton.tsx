"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictation control for a single text field: transcribes speech and hands the
 * final transcript to `onResult`, same as if the user had typed it. No
 * command parsing — the caller decides what to do with the text.
 */
export function MicButton({
  onResult,
  label,
  variant,
  appearance = "plain",
  children,
  className = "mic-button",
}: {
  onResult: (transcript: string) => void;
  label: string;
  variant?: "neutral" | "brand" | "success" | "warning" | "danger";
  appearance?: "plain" | "accent" | "filled" | "outlined" | "filled-outlined";
  children?: React.ReactNode;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getSpeechRecognitionCtor() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    setError(null);
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onResult(transcript.trim());
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "Microphone access denied" : "Didn't catch that — try again");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  if (!supported) return null;

  return (
    <span className="mic-wrap">
      <wa-button suppressHydrationWarning variant={variant}
        appearance={appearance}
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? `Stop dictating ${label}` : `Dictate ${label} by voice`}
        className={className}
        title={listening ? "Listening…" : `Dictate ${label}`}
      >
        <wa-icon suppressHydrationWarning canvas="fixed" slot={children ? "start" : undefined} name={listening ? "microphone-lines" : "microphone"}></wa-icon>
        <span>{listening ? "Listening…" : children}</span>
      </wa-button>
      {error && (
        <span className="mic-error" role="status">
          {error}
        </span>
      )}
    </span>
  );
}
