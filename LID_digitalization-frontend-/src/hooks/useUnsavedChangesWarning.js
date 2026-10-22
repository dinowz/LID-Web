import { useEffect, useRef, useState, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * useUnsavedChangesWarning
 *
 * Blocks in-app navigation and browser tab close/refresh
 * when the form has unsaved changes.
 *
 * Returns { blocker, isDirty, setIsDirty }
 */
const useUnsavedChangesWarning = (initialDirty = false) => {
  const [isDirty, _setIsDirty] = useState(initialDirty);
  const isDirtyRef = useRef(initialDirty);

  const setIsDirty = useCallback((val) => {
    isDirtyRef.current = Boolean(val);
    _setIsDirty(Boolean(val));
  }, []);

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => {
        if (!isDirtyRef.current) return false;
        return currentLocation.pathname !== nextLocation.pathname;
      },
      []
    )
  );

  // Block browser close / refresh
  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  return { blocker, isDirty, setIsDirty };
};

export default useUnsavedChangesWarning;
