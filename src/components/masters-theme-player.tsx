"use client";

import { useState, useRef, useEffect } from "react";

export function MastersThemePlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element
    const audio = new Audio("/masters-theme.mp3");
    audio.loop = true;
    audio.volume = 0.3;

    audio.addEventListener("canplaythrough", () => {
      setIsLoaded(true);
    });

    audio.addEventListener("error", () => {
      setHasError(true);
    });

    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = async () => {
    if (!audioRef.current || hasError) return;

    setHasInteracted(true);

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Failed to play audio:", err);
        setHasError(true);
      }
    }
  };

  // Don't show the button if there's an error (file missing)
  if (hasError) {
    return null;
  }

  return (
    <button
      onClick={togglePlay}
      disabled={!isLoaded}
      className={`fixed bottom-4 right-4 z-50 ${
        isLoaded
          ? "bg-green-800/90 hover:bg-green-700"
          : "bg-gray-600/90 cursor-wait"
      } text-white p-3 rounded-full shadow-lg transition-all duration-300 backdrop-blur-sm border border-green-600/50`}
      title={
        !isLoaded
          ? "Loading audio..."
          : isPlaying
          ? "Pause Masters Theme"
          : "Play Masters Theme"
      }
    >
      {isPlaying ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      )}
      {!hasInteracted && isLoaded && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
        </span>
      )}
    </button>
  );
}
