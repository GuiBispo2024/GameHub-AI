import { useState, useEffect, useCallback } from 'react';
import { HealthResponse } from '../types';
import { ApiService } from '../services/api';

export function useHealth(pollIntervalMs: number = 8000) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const result = await ApiService.getHealth();
      setData(result);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao conectar com o backend Express';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();

    const interval = setInterval(() => {
      fetchHealth();
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [fetchHealth, pollIntervalMs]);

  return {
    health: data,
    isLoading,
    error,
    isOnline: !error && !!data,
    refresh: fetchHealth,
  };
}
