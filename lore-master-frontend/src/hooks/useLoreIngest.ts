import { useMemo, useState } from 'react';
import { getApiError, ingestLore } from '../services/loreApi';
import type { IngestResponse } from '../types/lore';

export function useLoreIngest() {
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('Boss');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResponse | null>(null);

  const canIngest = useMemo(() => url.trim().length > 0 && !isLoading, [url, isLoading]);

  async function submitIngest() {
    const trimmed = url.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await ingestLore(trimmed, category, replaceExisting);
      setResult(response);
      setUrl('');
    } catch (err) {
      setError(getApiError(err, 'La ingesta falló'));
    } finally {
      setIsLoading(false);
    }
  }

  function clearFeedback() {
    setError(null);
    setResult(null);
  }

  return {
    url,
    setUrl,
    category,
    setCategory,
    replaceExisting,
    setReplaceExisting,
    isLoading,
    error,
    result,
    canIngest,
    submitIngest,
    clearFeedback,
  };
}
