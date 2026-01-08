import { useState, useCallback } from 'react';

export const useLoading = () => {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  
  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);
  
  const isLoading = useCallback((key: string) => {
    return loadingStates[key] || false;
  }, [loadingStates]);
  
  const isAnyLoading = useCallback(() => {
    return Object.values(loadingStates).some(Boolean);
  }, [loadingStates]);
  
  const clearAllLoading = useCallback(() => {
    setLoadingStates({});
  }, []);
  
  return { 
    setLoading, 
    isLoading, 
    isAnyLoading, 
    clearAllLoading,
    loadingStates 
  };
}; 