import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicationsApi } from '../../../shared/api/applications.api';
import { APPLICATIONS_KEY } from './useApplications';

export const APPLICATION_KEY = 'application';

export function useApplication(id: string) {
  return useQuery({
    queryKey: [APPLICATION_KEY, id],
    queryFn:  () => applicationsApi.get(id),
    enabled:  !!id,
  });
}

export function useApplicationMutations(id: string) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [APPLICATION_KEY, id] });
    qc.invalidateQueries({ queryKey: [APPLICATIONS_KEY] });
    qc.invalidateQueries({ queryKey: ['audit', id] });
  };

  const submit         = useMutation({ mutationFn: () => applicationsApi.submit(id),                               onSuccess: invalidate });
  const startReview    = useMutation({ mutationFn: () => applicationsApi.startReview(id),                          onSuccess: invalidate });
  const requestInfo    = useMutation({ mutationFn: (notes?: string) => applicationsApi.requestInfo(id, notes),    onSuccess: invalidate });
  const resubmit       = useMutation({ mutationFn: () => applicationsApi.resubmit(id),                             onSuccess: invalidate });
  const completeReview = useMutation({
    mutationFn: (reviewComment?: string) => applicationsApi.completeReview(id, reviewComment),
    onSuccess: invalidate,
  });
  const decide         = useMutation({
    mutationFn: ({ decision, rejectionReason }: { decision: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
      applicationsApi.decide(id, decision, rejectionReason),
    onSuccess: invalidate,
  });

  return { submit, startReview, requestInfo, resubmit, completeReview, decide };
}
