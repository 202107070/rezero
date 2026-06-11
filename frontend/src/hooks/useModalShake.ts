import { useCallback, useState } from 'react';

const SHAKE_DURATION_MS = 450;

export function useModalShake() {
  const [shaking, setShaking] = useState(false);

  const triggerShake = useCallback(() => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), SHAKE_DURATION_MS);
  }, []);

  return { shaking, triggerShake };
}
