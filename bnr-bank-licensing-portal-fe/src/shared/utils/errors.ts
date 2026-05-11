export function getApiErrorMessage(error: unknown, fallback = 'Action failed.'): string {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback
  );
}
