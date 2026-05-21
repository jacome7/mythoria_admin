/**
 * @jest-environment node
 */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/config/auth', () => ({
  ALLOWED_DOMAINS: ['@mythoria.pt'],
}));

jest.mock('@/db/services', () => ({
  adminService: {
    getPromotionCodeById: jest.fn(),
    updatePromotionCode: jest.fn(),
    deletePromotionCode: jest.fn(),
  },
}));

const { auth } = jest.requireMock('@/auth') as {
  auth: jest.Mock;
};

const { adminService } = jest.requireMock('@/db/services') as {
  adminService: Record<string, jest.Mock>;
};

let promotionCodePut: typeof import('@/app/api/admin/promotion-codes/[id]/route').PUT;
let promotionCodeDelete: typeof import('@/app/api/admin/promotion-codes/[id]/route').DELETE;

beforeAll(async () => {
  ({ PUT: promotionCodePut, DELETE: promotionCodeDelete } =
    await import('@/app/api/admin/promotion-codes/[id]/route'));
});

describe('promotion code API routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.mockResolvedValue({
      user: { email: 'admin@mythoria.pt' },
    } as never);
  });

  it('updates unused promotion codes', async () => {
    adminService.updatePromotionCode.mockResolvedValue({
      promotionCodeId: 'promo-1',
      code: 'SPRING25',
    } as never);
    adminService.getPromotionCodeById.mockResolvedValue({
      promotionCodeId: 'promo-1',
      code: 'SPRING25',
      totalRedemptions: 0,
    } as never);

    const response = await promotionCodePut(
      new Request('http://localhost/api/admin/promotion-codes/promo-1', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: 'spring25',
          type: 'partner',
          creditAmount: 25,
          maxGlobalRedemptions: null,
          maxRedemptionsPerUser: 1,
          validFrom: null,
          validUntil: null,
          active: true,
        }),
      }) as never,
      { params: Promise.resolve({ id: 'promo-1' }) },
    );

    expect(response.status).toBe(200);
    expect(adminService.updatePromotionCode).toHaveBeenCalledWith('promo-1', {
      code: 'spring25',
      type: 'partner',
      creditAmount: 25,
      maxGlobalRedemptions: null,
      maxRedemptionsPerUser: 1,
      validFrom: null,
      validUntil: null,
      active: true,
    });
  });

  it('returns conflicts for used promotion code edits', async () => {
    adminService.updatePromotionCode.mockRejectedValue(
      Object.assign(new Error('promotion_code_used'), { code: 'promotion_code_used' }) as never,
    );

    const response = await promotionCodePut(
      new Request('http://localhost/api/admin/promotion-codes/promo-used', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: 'USED',
          type: 'partner',
          creditAmount: 10,
        }),
      }) as never,
      { params: Promise.resolve({ id: 'promo-used' }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'promotion_code_used' });
  });

  it('deletes inactive unused promotion codes', async () => {
    adminService.deletePromotionCode.mockResolvedValue({
      promotionCodeId: 'promo-inactive',
      active: false,
    } as never);

    const response = await promotionCodeDelete(
      new Request('http://localhost/api/admin/promotion-codes/promo-inactive', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ id: 'promo-inactive' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it('returns conflicts for active promotion code deletes', async () => {
    adminService.deletePromotionCode.mockRejectedValue(
      Object.assign(new Error('promotion_code_active'), { code: 'promotion_code_active' }) as never,
    );

    const response = await promotionCodeDelete(
      new Request('http://localhost/api/admin/promotion-codes/promo-active', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ id: 'promo-active' }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'promotion_code_active' });
  });

  it('requires admin authentication', async () => {
    auth.mockResolvedValue(null as never);

    const response = await promotionCodeDelete(
      new Request('http://localhost/api/admin/promotion-codes/promo-1', {
        method: 'DELETE',
      }) as never,
      { params: Promise.resolve({ id: 'promo-1' }) },
    );

    expect(response.status).toBe(401);
  });
});
