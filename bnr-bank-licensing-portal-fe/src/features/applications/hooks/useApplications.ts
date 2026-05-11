import { useQuery } from '@tanstack/react-query';
import { applicationsApi, type QueryApplicationsParams } from '../../../shared/api/applications.api';

export const APPLICATIONS_KEY = 'applications';

export function useApplications(params?: QueryApplicationsParams) {
  return useQuery({
    queryKey: [APPLICATIONS_KEY, params],
    queryFn:  () => applicationsApi.list(params),
  });
}
