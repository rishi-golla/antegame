import { useEffect, useCallback } from 'react';
import { moodController, type MoodType } from '@/lib/moodController';

/**
 * React hook for managing visual mood system
 */
export function useMood() {
  const setMood = useCallback((mood: MoodType) => {
    moodController.setMood(mood);
  }, []);

  const getCurrentMood = useCallback(() => {
    return moodController.getCurrentMood();
  }, []);

  const resetMood = useCallback(() => {
    moodController.reset();
  }, []);

  // Initialize mood on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      moodController.setMood('neutral');
    }
  }, []);

  return {
    setMood,
    getCurrentMood,
    resetMood
  };
}