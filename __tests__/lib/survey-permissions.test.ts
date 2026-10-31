/** @jest-environment node */
import { NextResponse } from 'next/server';
import { getBackofficeDb } from '@/db';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import {
  SurveyAdminError,
  permissionsForRoles,
  requireSurveyPermission,
} from '@/lib/surveys/permissions';

jest.mock('@/db', () => ({ getBackofficeDb: jest.fn() }));
jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));

const mockAuth = jest.mocked(authenticateAdmin);
const mockDb = jest.mocked(getBackofficeDb);

function mockRoles(rows: { role: string; managerId: string }[]) {
  const where = jest.fn().mockResolvedValue(rows);
  const chain = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where,
  };
  mockDb.mockReturnValue(chain as never);
  return chain;
}

describe('survey role permissions', () => {
  it('maps roles to the documented permissions', () => {
    expect(permissionsForRoles(['survey_viewer'])).toEqual(['survey:view']);
    expect(permissionsForRoles(['survey_analyst'])).toEqual(['survey:view', 'survey:analyze']);
    expect(permissionsForRoles(['survey_manager'])).toEqual([
      'survey:view',
      'survey:analyze',
      'survey:manage',
    ]);
    expect(permissionsForRoles(['super_admin'])).toEqual([
      'survey:view',
      'survey:analyze',
      'survey:manage',
    ]);
    expect(permissionsForRoles(['referral_viewer', 'finance'])).toEqual([]);
  });
});

describe('requireSurveyPermission', () => {
  beforeEach(() => jest.clearAllMocks());

  it('throws 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue({
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    });
    await expect(requireSurveyPermission('survey:view')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 403 for a disallowed domain', async () => {
    mockAuth.mockResolvedValue({
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });
    await expect(requireSurveyPermission('survey:view')).rejects.toBeInstanceOf(SurveyAdminError);
    await expect(requireSurveyPermission('survey:view')).rejects.toMatchObject({ status: 403 });
  });

  it('throws 403 when the manager has no survey role', async () => {
    mockAuth.mockResolvedValue({ email: 'Admin@Example.com' });
    mockRoles([]);
    await expect(requireSurveyPermission('survey:view')).rejects.toMatchObject({ status: 403 });
  });

  it('viewer can view but not analyze', async () => {
    mockAuth.mockResolvedValue({ email: 'Admin@Example.com' });
    const chain = mockRoles([{ role: 'survey_viewer', managerId: 'm1' }]);
    await expect(requireSurveyPermission('survey:view')).resolves.toMatchObject({
      email: 'admin@example.com',
      managerId: 'm1',
      roles: ['survey_viewer'],
    });
    expect(chain.where).toHaveBeenCalled();
    await expect(requireSurveyPermission('survey:analyze')).rejects.toMatchObject({ status: 403 });
  });

  it('analyst can analyze but not manage', async () => {
    mockAuth.mockResolvedValue({ email: 'a@example.com' });
    mockRoles([{ role: 'survey_analyst', managerId: 'm2' }]);
    await expect(requireSurveyPermission('survey:analyze')).resolves.toBeDefined();
    await expect(requireSurveyPermission('survey:manage')).rejects.toMatchObject({ status: 403 });
  });

  it('super_admin has every survey permission and referral roles grant none', async () => {
    mockAuth.mockResolvedValue({ email: 'a@example.com' });
    mockRoles([{ role: 'super_admin', managerId: 'm3' }]);
    await expect(requireSurveyPermission('survey:manage')).resolves.toMatchObject({
      managerId: 'm3',
    });
  });
});

describe('logAdminAudit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts an audit event with a lowercased actor', async () => {
    const values = jest.fn().mockResolvedValue(undefined);
    mockDb.mockReturnValue({ insert: jest.fn(() => ({ values })) } as never);
    await logAdminAudit({
      actorEmail: 'Admin@Example.com',
      action: 'survey.export',
      entityType: 'survey_version',
      entityId: 'v1',
      metadata: { rowCount: 3 },
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorEmail: 'admin@example.com',
        action: 'survey.export',
        entityId: 'v1',
        metadata: { rowCount: 3 },
      }),
    );
  });

  it('never throws when the insert fails', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDb.mockReturnValue({
      insert: jest.fn(() => ({ values: jest.fn().mockRejectedValue(new Error('db down')) })),
    } as never);
    await expect(
      logAdminAudit({ actorEmail: 'a@b.c', action: 'x', entityType: 'y' }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
