import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetSelectionRecordIds = vi.hoisted(() => vi.fn());

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
      getSelectionRecordIds: mockGetSelectionRecordIds,
    }),
  },
}));

import { resolveSelection } from './selection-actions';

const validSession = {
  user: { id: 'ba-1', userGuid: '550e8400-e29b-41d4-a716-446655440000' },
  session: { id: 'sess-1' },
};

describe('resolveSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(validSession);
  });

  it('should resolve selection record IDs', async () => {
    mockGetSelectionRecordIds.mockResolvedValue([100, 200, 300]);

    const result = await resolveSelection(5, 292);

    expect(result).toEqual({ recordIds: [100, 200, 300], count: 3 });
    // No acting user id is passed from here: a selection belongs to a
    // specific MP user, so the acting User_ID is resolved by the
    // authorization gate inside the service instead of being supplied by
    // the caller.
    expect(mockGetSelectionRecordIds).toHaveBeenCalledWith(5, 292);
  });

  it('should return empty array when selection has no records', async () => {
    mockGetSelectionRecordIds.mockResolvedValue([]);

    const result = await resolveSelection(5, 292);

    expect(result).toEqual({ recordIds: [], count: 0 });
  });

  it('should throw when user is not authenticated', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(resolveSelection(5, 292)).rejects.toThrow('Unauthorized');
  });

  it('propagates a refusal from the service-layer authorization gate', async () => {
    // Resolving the acting user and refusing an unauthorized one are now the
    // service's job, so this action simply must not swallow the refusal.
    mockGetSelectionRecordIds.mockRejectedValue(new Error('Not authorized'));

    await expect(resolveSelection(5, 292)).rejects.toThrow('Not authorized');
  });
});
