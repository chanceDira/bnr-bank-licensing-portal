import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('returns the authenticated user', () => {
    const guard = new JwtAuthGuard();
    const user = { id: 'user-1' };

    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('maps missing or invalid credentials to 403', () => {
    const guard = new JwtAuthGuard();

    expect(() => guard.handleRequest(null, null)).toThrow(ForbiddenException);
    expect(() => guard.handleRequest(new Error('invalid token'), null)).toThrow(
      ForbiddenException,
    );
  });
});
