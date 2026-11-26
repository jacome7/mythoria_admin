/** @jest-environment node */
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/admin/stories/[storyId]/premium-edition/route';
import { GET as getImage } from '@/app/api/admin/stories/[storyId]/premium-edition/[image]/route';
import { POST as createStaffTicket } from '@/app/api/tickets/staff-print/route';
import { POST as generateClassicPdfs } from '@/app/api/stories/[storyId]/generate-pdfs/route';
import { GET as getClassicChapters } from '@/app/api/admin/stories/[storyId]/chapters/route';
import { PATCH as featureStory } from '@/app/api/admin/stories/[storyId]/feature/route';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { authenticateRequest } from '@/lib/auth/middleware';
import { TicketService } from '@/lib/ticketing/service';
import { publishPrintRequest } from '@/lib/pubsub';
import { callPremiumEditionImage, callPrintDomain } from '@/services/print';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/db/services', () => ({
  adminService: {
    getStoryById: jest.fn(),
    getStoryWithChapters: jest.fn(),
    featureStory: jest.fn(),
    unfeatureStory: jest.fn(),
  },
}));
jest.mock('@/lib/pubsub', () => ({ publishPrintRequest: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('@/lib/auth/middleware', () => ({
  authenticateRequest: jest.fn(),
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}));
jest.mock('@/lib/ticketing/service', () => ({
  TicketService: { createLinkedPrintTicket: jest.fn() },
}));
jest.mock('@/services/print', () => ({
  callPremiumEditionImage: jest.fn(),
  callPrintDomain: jest.fn(),
  PrintDomainError: class extends Error {},
}));

const storyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const revision = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ticketId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const printRequestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const email = 'admin@mythoria.pt';
const params = Promise.resolve({ storyId });
const editionUrl = `https://admin.example/api/admin/stories/${storyId}/premium-edition`;
const proof = {
  revision,
  shippingAddress: {
    name: 'Staff',
    street1: 'Rua 1',
    city: 'Lisboa',
    postcode: '1000-001',
    country_code: 'pt',
    phone_number: '+351210000000',
    email,
  },
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(authenticateAdmin).mockResolvedValue({ email });
  jest.mocked(auth).mockResolvedValue({ user: { email } } as never);
});

it('serves private, actor-audited reader metadata and only a pinned same-origin image', async () => {
  const read = jest.mocked(callPrintDomain).mockResolvedValue({ revision });
  const metadata = await GET(new Request(editionUrl), { params });
  expect(metadata.headers.get('Cache-Control')).toBe('private, no-store');
  expect(read).toHaveBeenCalledWith('getPremiumEdition', { storyId }, email);
  expect(logAdminAudit).toHaveBeenCalledWith(
    expect.objectContaining({
      actorEmail: email,
      action: 'premium_edition.read',
      entityId: storyId,
    }),
  );
  const image = jest
    .mocked(callPremiumEditionImage)
    .mockResolvedValue({ bytes: new Uint8Array([1, 2]), contentType: 'image/png' });
  const context = { params: Promise.resolve({ storyId, image: '2' }) };
  expect((await getImage(new Request(`${editionUrl}/2`), context)).status).toBe(404);
  expect(image).not.toHaveBeenCalled();
  const asset = await getImage(new Request(`${editionUrl}/2?revision=${revision}`), context);
  expect(image).toHaveBeenCalledWith({ storyId, image: '2', revision }, email);
  expect(asset.headers.get('Cache-Control')).toBe('private, no-store');
  expect(new Uint8Array(await asset.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
});

it('authorizes staff initiation, forwards only the frozen edition and staff address, and audits without the address', async () => {
  const request = (origin: string) =>
    new Request(editionUrl, {
      method: 'POST',
      headers: { origin },
      body: JSON.stringify({ ...proof, copies: 4 }),
    });
  expect((await POST(request('https://untrusted.example'), { params })).status).toBe(403);
  jest
    .mocked(authenticateAdmin)
    .mockResolvedValueOnce({ error: Response.json({}, { status: 401 }) } as never);
  expect((await POST(request('https://admin.example'), { params })).status).toBe(401);
  expect(callPrintDomain).not.toHaveBeenCalled();
  jest.mocked(callPrintDomain).mockResolvedValue({ ticketId });
  const created = await POST(request('https://admin.example'), { params });
  expect(await created.json()).toEqual({ data: { ticketId } });
  expect(callPrintDomain).toHaveBeenCalledWith(
    'createStaffProof',
    { storyId, ...proof, shippingAddress: { ...proof.shippingAddress, country_code: 'PT' } },
    email,
  );
  expect(logAdminAudit).toHaveBeenLastCalledWith({
    actorEmail: email,
    action: 'print.staff_proof_linked',
    entityId: storyId,
    entityType: 'story',
    metadata: { revision, ticketId },
  });
});

it('requires the service API key and exactly one hardcover before linking a staff ticket', async () => {
  const request = (numberOfCopies: number) =>
    new NextRequest('https://admin.example/api/tickets/staff-print', {
      method: 'POST',
      body: JSON.stringify({
        category: 'print_request',
        storyId,
        userId: storyId,
        printFormat: 'hardcover',
        numberOfCopies,
        orderDetails: {
          fulfillmentVersion: 1,
          printRequestId,
          proofOnly: { revision, requestedBy: email },
        },
      }),
    });
  jest.mocked(authenticateRequest).mockResolvedValueOnce({ success: true, source: 'session' });
  expect((await createStaffTicket(request(1))).status).toBe(403);
  jest.mocked(authenticateRequest).mockResolvedValue({ success: true, source: 'api-key' });
  expect((await createStaffTicket(request(2))).status).toBe(400);
  expect(TicketService.createLinkedPrintTicket).not.toHaveBeenCalled();
  jest.mocked(TicketService.createLinkedPrintTicket).mockResolvedValue({
    id: ticketId,
    metadata: { printRequestId, proofOnly: { revision } },
  } as never);
  const response = await createStaffTicket(request(1));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({
    id: ticketId,
    metadata: { printRequestId, staffProofRevision: revision },
  });
});

it('queues classic PDFs for the configured Admin origin behind Cloud Run', async () => {
  const publicOrigin = 'https://admin.example';
  const env = jest.replaceProperty(process, 'env', { ...process.env, NEXTAUTH_URL: publicOrigin });
  const request = (origin: string) =>
    new NextRequest(`http://localhost:8080/api/stories/${storyId}/generate-pdfs`, {
      method: 'POST',
      headers: { origin },
    });

  try {
    jest.mocked(adminService.getStoryById).mockResolvedValue({ storyId, features: null } as never);
    for (const origin of ['https://untrusted.example', 'http://localhost:8080']) {
      expect((await generateClassicPdfs(request(origin), { params })).status).toBe(403);
    }
    expect(publishPrintRequest).not.toHaveBeenCalled();

    const response = await generateClassicPdfs(request(publicOrigin), { params });
    expect(response.status).toBe(200);
    const { runId } = await response.json();
    expect(runId).toEqual(expect.any(String));
    expect(publishPrintRequest).toHaveBeenCalledWith({
      storyId,
      runId,
      initiatedBy: 'adminPortal',
      origin: 'admin',
    });
  } finally {
    env.restore();
  }
});

it('protects premium books from chapter and A5 PDF routes and permits metadata-only featuring', async () => {
  const premiumEdition = { state: 'published', revision };
  const story = {
    storyId,
    status: 'published',
    isPublic: true,
    featureImageUri: '/current-cover.jpg',
    features: { premiumBook: { ...premiumEdition, version: 1, type: 'premium_children' } },
  };
  jest.mocked(adminService.getStoryById).mockResolvedValue(story as never);
  jest
    .mocked(adminService.getStoryWithChapters)
    .mockResolvedValue({ storyId, premiumEdition } as never);
  expect(
    (await generateClassicPdfs(new NextRequest(editionUrl, { method: 'POST' }), { params })).status,
  ).toBe(409);
  expect(publishPrintRequest).not.toHaveBeenCalled();
  const chapters = await getClassicChapters(new Request(editionUrl), { params });
  expect(chapters.status).toBe(409);
  expect(await chapters.json()).toMatchObject({ code: 'premium_edition' });

  const request = (body: unknown) =>
    new Request(editionUrl, { method: 'PATCH', body: JSON.stringify(body) });
  expect(
    (await featureStory(request({ featureImageUri: '/different-cover.jpg' }), { params })).status,
  ).toBe(409);
  expect(adminService.featureStory).not.toHaveBeenCalled();
  jest
    .mocked(adminService.featureStory)
    .mockResolvedValue({ ...story, isFeatured: true, premiumEdition } as never);
  expect((await featureStory(request({}), { params })).status).toBe(200);
  expect(adminService.featureStory).toHaveBeenCalledWith(storyId, undefined);
});
