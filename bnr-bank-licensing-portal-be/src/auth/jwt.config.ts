export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'test') {
    return secret ?? 'test-only-jwt-secret';
  }

  if (!secret || secret === 'dev-jwt-secret-change-me') {
    throw new Error('JWT_SECRET must be configured with a non-default value');
  }

  return secret;
}
