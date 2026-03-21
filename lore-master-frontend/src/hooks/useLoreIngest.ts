import { useMemo, useState } from 'react';
import { getApiError, ingestDocuments, ingestFiles } from '../services/loreApi';
import type { IngestBatchResponse } from '../types/lore';

type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface FileUploadProgress {
  id: string;
  name: string;
  status: FileUploadStatus;
  detail?: string;
}

const MAX_FILE_SIZE_MB = 15;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function useLoreIngest(onSuccess?: () => void) {
  const [mode, setMode] = useState<'urls' | 'files'>('urls');
  const [urlsText, setUrlsText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileValidationErrors, setFileValidationErrors] = useState<string[]>([]);
  const [fileProgress, setFileProgress] = useState<FileUploadProgress[]>([]);
  const [tagsText, setTagsText] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestBatchResponse | null>(null);

  const canIngest = useMemo(() => {
    if (isLoading) return false;
    if (mode === 'urls') return urlsText.trim().length > 0;
    if (mode === 'files') return uploadedFiles.length > 0;
    return false;
  }, [urlsText, uploadedFiles, isLoading, mode]);

  async function submitIngest() {
    if (!canIngest || isLoading) {
      return;
    }

    const tags = tagsText
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let response: IngestBatchResponse;
      
      if (mode === 'urls') {
        const urls = urlsText
          .split(/\r?\n|,/)
          .map((value) => value.trim())
          .filter(Boolean);
        response = await ingestDocuments(urls, replaceExisting, tags);
        setUrlsText('');
      } else {
        const initializedProgress = uploadedFiles.map((file, index) => ({
          id: `${file.name}-${file.lastModified}-${index}`,
          name: file.name,
          status: 'pending' as const,
        }));
        setFileProgress(initializedProgress);

        const aggregatedResults: IngestBatchResponse = {
          message: '',
          processedUrls: uploadedFiles.length,
          successfulUrls: 0,
          failedUrls: 0,
          results: [],
          failures: [],
        };

        for (const [index, file] of uploadedFiles.entries()) {
          const progressId = `${file.name}-${file.lastModified}-${index}`;
          setFileProgress((current) =>
            current.map((item) =>
              item.id === progressId ? { ...item, status: 'uploading', detail: 'Procesando...' } : item,
            ),
          );

          try {
            const singleResponse = await ingestFiles([file], replaceExisting, tags);
            aggregatedResults.results.push(...singleResponse.results);
            aggregatedResults.failures.push(...singleResponse.failures);

            const failed = singleResponse.failedUrls > 0 || singleResponse.failures.length > 0;
            setFileProgress((current) =>
              current.map((item) =>
                item.id === progressId
                  ? {
                    ...item,
                    status: failed ? 'error' : 'done',
                    detail: failed
                      ? singleResponse.failures[0]?.reason ?? 'Falló la ingesta'
                      : 'Ingesta completada',
                  }
                  : item,
              ),
            );
          } catch (singleError) {
            const reason = getApiError(singleError, `No se pudo procesar ${file.name}`);
            aggregatedResults.failures.push({ url: file.name, reason });
            setFileProgress((current) =>
              current.map((item) =>
                item.id === progressId
                  ? {
                    ...item,
                    status: 'error',
                    detail: reason,
                  }
                  : item,
              ),
            );
          }
        }

        aggregatedResults.successfulUrls = aggregatedResults.results.length;
        aggregatedResults.failedUrls = aggregatedResults.failures.length;
        aggregatedResults.message =
          aggregatedResults.failedUrls === 0
            ? `Ingesta completada para ${aggregatedResults.successfulUrls} archivo(s).`
            : `Ingesta completada con incidencias: ${aggregatedResults.successfulUrls} archivo(s) correctos, ${aggregatedResults.failedUrls} fallidos.`;

        response = aggregatedResults;
        setUploadedFiles([]);
      }

      setResult(response);
      if (response.successfulUrls > 0) {
        onSuccess?.();
      }
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

  function handleFileSelect(files: FileList | null) {
    if (!files) {
      setUploadedFiles([]);
      setFileValidationErrors([]);
      setFileProgress([]);
      return;
    }

    const selected = Array.from(files);
    const valid: File[] = [];
    const invalid: string[] = [];

    for (const file of selected) {
      const isValidType = /\.(txt|md|pdf)$/i.test(file.name);
      if (!isValidType) {
        invalid.push(`${file.name}: formato no permitido (usa TXT, MD o PDF).`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        invalid.push(`${file.name}: excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB.`);
        continue;
      }

      valid.push(file);
    }

    setUploadedFiles(valid);
    setFileValidationErrors(invalid);
    setFileProgress([]);
  }

  return {
    mode,
    setMode,
    urlsText,
    setUrlsText,
    uploadedFiles,
    setUploadedFiles,
    fileValidationErrors,
    fileProgress,
    handleFileSelect,
    tagsText,
    setTagsText,
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
