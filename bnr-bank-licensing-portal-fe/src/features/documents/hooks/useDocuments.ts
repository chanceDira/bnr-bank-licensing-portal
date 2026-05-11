import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../../../shared/api/documents.api';

export function useDocuments(applicationId: string) {
  return useQuery({
    queryKey: ['documents', applicationId],
    queryFn:  () => documentsApi.list(applicationId),
    enabled:  !!applicationId,
  });
}

export function useUploadDocument(applicationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => documentsApi.upload(applicationId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', applicationId] });
      qc.invalidateQueries({ queryKey: ['application', applicationId] });
    },
  });
}

export async function downloadDocument(applicationId: string, documentId: string, fileName: string) {
  const { blob } = await documentsApi.download(applicationId, documentId);
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
