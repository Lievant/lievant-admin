'use client';
import { useCallback, useEffect, useState } from 'react';

export type HealthStatus = 'checking' | 'ok' | 'degraded' | 'offline';

export function useApiHealth(intervalMs = 30000) {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const [failCount, setFailCount] = useState(0);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/health', {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setStatus('ok');
        setFailCount(0);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch {
      setFailCount((prev) => {
        const next = prev + 1;
        if (next >= 2) setStatus('offline');
        else setStatus('degraded');
        return next;
      });
    }
    setLastChecked(new Date());
  }, []);

  useEffect(() => {
    void check();
    const interval = setInterval(() => { void check(); }, intervalMs);
    return () => clearInterval(interval);
  }, [check, intervalMs]);

  return { status, failCount, lastChecked, retry: check };
}
