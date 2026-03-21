import { useCallback, useEffect, useState } from 'react';
import { getApiError, listDocuments } from '../services/loreApi';
import type { DocumentListItem } from '../types/lore';

export function useDocumentsLibrary() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await listDocuments();
      setDocuments(response);
    } catch (err) {
      setError(getApiError(err, 'No pude listar los documentos disponibles'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadDocuments();
  }, [reloadDocuments]);

  return {
    documents,
    isLoading,
    error,
    reloadDocuments,
  };
}
