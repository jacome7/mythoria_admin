/** @jest-environment node */
import { NextResponse } from 'next/server';
import { DELETE, GET, POST } from '@/app/api/tickets/print-destinations/route';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import {
  listStaffPrintDestinations,
  removeStaffPrintDestination,
  saveStaffPrintDestination,
} from '@/services/staff-print-destinations';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/lib/admin-request-origin', () => ({ hasTrustedAdminOrigin: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('@/services/staff-print-destinations', () => ({
  listStaffPrintDestinations: jest.fn(),
  removeStaffPrintDestination: jest.fn(),
  saveStaffPrintDestination: jest.fn(),
}));

const email = 'staff@example.test';
const destination = {
  id: '00000000-0000-4000-8000-000000000001',
  label: 'Studio',
  address: {
    name: 'Studio Staff',
    email: 'studio@example.test',
    phone_number: '+351210000000',
    country_code: 'PT',
    street1: 'Studio Avenue 1',
    city: 'Lisboa',
    postcode: '1000-001',
  },
};

function request(method: 'POST' | 'DELETE', body: object) {
  return new Request('https://admin.example.test/api/tickets/print-destinations', {
    method,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(authenticateAdmin).mockResolvedValue({ email });
  jest.mocked(hasTrustedAdminOrigin).mockReturnValue(true);
});

it('scopes destination reads to the current staff session and disables caching', async () => {
  jest.mocked(listStaffPrintDestinations).mockResolvedValue([destination]);
  const result = await GET();
  expect(result.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await result.json()).toEqual({ destinations: [destination] });
  expect(listStaffPrintDestinations).toHaveBeenCalledWith(email);
});

it('rejects unauthenticated reads and cross-origin writes', async () => {
  jest
    .mocked(authenticateAdmin)
    .mockResolvedValueOnce({ error: NextResponse.json({}, { status: 401 }) });
  expect((await GET()).status).toBe(401);
  jest.mocked(hasTrustedAdminOrigin).mockReturnValue(false);
  expect((await POST(request('POST', destination))).status).toBe(403);
  expect(saveStaffPrintDestination).not.toHaveBeenCalled();
  expect(listStaffPrintDestinations).not.toHaveBeenCalled();
});

it('excludes recipient tax IDs and shipping details from destination audit records', async () => {
  jest.mocked(saveStaffPrintDestination).mockResolvedValue(destination);
  const result = await POST(
    request('POST', {
      label: destination.label,
      address: { ...destination.address, recipient_tax_id: 'fixture-tax-id' },
    }),
  );
  expect(result.status).toBe(201);
  expect(saveStaffPrintDestination).toHaveBeenCalledWith(
    email,
    destination.label,
    destination.address,
  );
  expect(logAdminAudit).toHaveBeenCalledWith({
    actorEmail: email,
    action: 'print.staff_destination_saved',
    entityType: 'staff_print_destination',
    entityId: destination.id,
  });
});

it('scopes removals to the current staff session even if another email is supplied', async () => {
  jest.mocked(removeStaffPrintDestination).mockResolvedValue(false);
  const result = await DELETE(
    request('DELETE', { id: destination.id, email: 'other@example.test' }),
  );
  expect(result.status).toBe(404);
  expect(removeStaffPrintDestination).toHaveBeenCalledWith(email, destination.id);
  expect(logAdminAudit).not.toHaveBeenCalled();
});
