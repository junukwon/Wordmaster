import { useCallback, useEffect, useRef, useState } from 'react';

export function useAnswerRevealGuard(delayMs = 600) {
  const [revealed, setRevealed] = useState(false);
  const [ratingReady, setRatingReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearActivation = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reveal = useCallback(() => {
    clearActivation();
    setRevealed(true);
    setRatingReady(false);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setRatingReady(true);
    }, delayMs);
  }, [clearActivation, delayMs]);

  const reset = useCallback(() => {
    clearActivation();
    setRevealed(false);
    setRatingReady(false);
  }, [clearActivation]);

  useEffect(() => clearActivation, [clearActivation]);

  return { revealed, ratingReady, reveal, reset };
}
