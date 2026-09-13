import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetSession, mockGetUserTools } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockGetUserTools: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/services/toolService', () => ({
  ToolService: {
    getInstance: vi.fn().mockResolvedValue({
      getUserTools: mockGetUserTools,
    }),
  },
}));

import { getUserTools } from './user-tools-actions';

/**
 * Resolving the acting MP User_ID — and refusing a caller who holds no MP
 * security role — moved into `ToolService.getUserTools`, where the
 * authorization gate is the single source of both. What remains this action's
 * responsibility is the dev-session guard, and not swallowing a refusal.
 */
describe('getUserTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when no session exists', async () => {
    mockGetSession.mockResolvedValueOnce(null);

    await expect(getUserTools()).rejects.toThrow('Unauthorized');
  });

  it('passes no caller-supplied user id to the service', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'internal-id', userGuid: '550e8400-e29b-41d4-a716-446655440000' },
    });
    mockGetUserTools.mockResolvedValueOnce(['/contacts', '/events']);

    const result = await getUserTools();

    expect(mockGetUserTools).toHaveBeenCalledWith();
    expect(result).toEqual(['/contacts', '/events']);
  });

  it('propagates a refusal from the service-layer authorization gate', async () => {
    mockGetSession.mockResolvedValueOnce({
      user: { id: 'internal-id', userGuid: '550e8400-e29b-41d4-a716-446655440000' },
    });
    mockGetUserTools.mockRejectedValueOnce(new Error('Not authorized'));

    await expect(getUserTools()).rejects.toThrow('Not authorized');
  });
});
