import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type {
  AdminCreatePostInput,
  AdminTranslationInput,
  AdminUpdatePostInput,
} from '@/db/services/blog';
import type { CreateCampaignInput, UpdateCampaignInput } from '@/lib/schemas/campaigns';

function toolErr(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const campaignStatusFilterSchema = z
  .enum(['draft', 'active', 'paused', 'completed', 'cancelled'])
  .optional();

const registrationRangeMcpSchema = z.enum(['7d', '30d', '90d', 'forever']);

const getProjectStatisticsFields = {
  range: registrationRangeMcpSchema
    .optional()
    .describe(
      'Preset time window. Mutually exclusive with startDate/endDate. Use with optional includeDaily.',
    ),
  startDate: z
    .string()
    .optional()
    .describe('Custom window start (ISO 8601 date/time, interpreted in UTC).'),
  endDate: z
    .string()
    .optional()
    .describe('Custom window end (ISO 8601 date/time, interpreted in UTC).'),
  includeDaily: z
    .boolean()
    .optional()
    .describe(
      'If true, include merged daily (or monthly for forever) statistics array. Requires a window.',
    ),
  includeAiBreakdowns: z
    .boolean()
    .optional()
    .describe(
      'If true, attach per-model and per-action AI cost breakdown (large). Requires a window.',
    ),
};

const getProjectStatisticsInputSchema = z
  .object(getProjectStatisticsFields)
  .refine((d) => !d.range || (!d.startDate && !d.endDate), {
    message: 'Do not pass range together with startDate/endDate',
  })
  .refine((d) => (d.startDate == null) === (d.endDate == null), {
    message: 'startDate and endDate must both be set for a custom window',
  })
  .refine(
    (d) =>
      (d.includeDaily !== true && d.includeAiBreakdowns !== true) ||
      !!(d.range || (d.startDate && d.endDate)),
    {
      message: 'includeDaily or includeAiBreakdowns requires range or both startDate and endDate',
    },
  );

/** Arbitrary JSON object from MCP clients (validated at service layer). */
const recordPayload = z.record(z.string(), z.unknown());

type FaqCreateInput = {
  sectionId: string;
  faqKey: string;
  locale: string;
  title: string;
  contentMdx: string;
  questionSortOrder?: number;
  isPublished?: boolean;
};

type FaqUpdateInput = {
  sectionId?: string;
  title?: string;
  contentMdx?: string;
  questionSortOrder?: number;
  isPublished?: boolean;
};

type PromoCreateInput = {
  code: string;
  type: string;
  creditAmount: number;
  maxGlobalRedemptions?: number | null;
  maxRedemptionsPerUser?: number;
  validFrom?: string | null;
  validUntil?: string | null;
  active?: boolean;
};

export function registerMcpTools(server: McpServer) {
  // -----------------------------------------------------
  // Group A & B: Stats & Server Status
  // -----------------------------------------------------
  server.tool(
    'get_project_statistics',
    'Get project KPIs. With no arguments: { users, stories, openTickets } only. With range or startDate/endDate: adds window summary (registrations, revenue, credits, AI costs, stories, tickets). Set includeDaily for merged per-day (or per-month for forever) buckets. Currency: revenue from payment orders; AI cost in EUR.',
    getProjectStatisticsFields,
    async (args) => {
      try {
        const parsed = getProjectStatisticsInputSchema.parse(args ?? {});
        const legacy =
          parsed.range == null &&
          parsed.startDate == null &&
          parsed.endDate == null &&
          parsed.includeDaily !== true &&
          parsed.includeAiBreakdowns !== true;

        if (legacy) {
          const { adminService } = await import('@/db/services');
          const { TicketService } = await import('@/lib/ticketing/service');
          const [users, stories, ticketMetrics] = await Promise.all([
            adminService.getTotalAuthorsCount(),
            adminService.getTotalStoriesCount(),
            TicketService.getMetrics(),
          ]);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  users,
                  stories,
                  openTickets: ticketMetrics.openTickets + ticketMetrics.inProgressTickets,
                }),
              },
            ],
          };
        }

        const { getProjectStatisticsReport } = await import('@/db/services/projectStatistics');
        const report = await getProjectStatisticsReport({
          range: parsed.range ?? undefined,
          startDate: parsed.startDate ?? undefined,
          endDate: parsed.endDate ?? undefined,
          includeDaily: parsed.includeDaily,
          includeAiBreakdowns: parsed.includeAiBreakdowns,
        });
        return { content: [{ type: 'text', text: JSON.stringify(report) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'get_server_status',
    'List the health check of all Mythoria external services.',
    { serviceName: z.string().optional().describe('Optional specific service to check.') },
    async ({ serviceName }) => {
      try {
        const adminUrl = process.env.ADMIN_URL || 'http://localhost:3001';
        const urlOptions = serviceName ? `?service=${serviceName}` : '';
        const res = await fetch(`${adminUrl}/api/server-status${urlOptions}`);
        if (!res.ok) throw new Error(`Failed to fetch status`);
        return { content: [{ type: 'text', text: JSON.stringify(await res.json()) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  // -----------------------------------------------------
  // Group C: User Management
  // -----------------------------------------------------
  server.tool(
    'list_users',
    'List users with optional search and limit.',
    {
      query: z.string().optional().describe('Search email or username'),
      limit: z.number().max(50).default(10).describe('Number of users to return'),
    },
    async ({ query, limit }) => {
      try {
        const { adminService } = await import('@/db/services');
        const list = await adminService.getUsers(1, limit, query);
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'get_user_details',
    'Get full details of a user by their ID, including credits.',
    { id: z.string() },
    async ({ id }) => {
      try {
        const { adminService } = await import('@/db/services');
        const user = await adminService.getUserById(id);
        const credits = await adminService.getUserCreditBalance(id);
        return { content: [{ type: 'text', text: JSON.stringify({ user, credits }) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'update_user_credits',
    'Update user credits by assigning an amount.',
    {
      authorId: z.string(),
      amount: z.number(),
      eventType: z.enum(['refund', 'voucher', 'promotion']),
    },
    async ({ authorId, amount, eventType }) => {
      try {
        const { adminService } = await import('@/db/services');
        await adminService.assignCreditsToUser(authorId, amount, eventType);
        return {
          content: [
            { type: 'text', text: `Successfully assigned ${amount} credits to ${authorId}.` },
          ],
        };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  // -----------------------------------------------------
  // Group D: Stories Management
  // -----------------------------------------------------
  server.tool(
    'list_stories',
    'List stories with optional search.',
    {
      query: z.string().optional(),
      limit: z.number().max(50).default(10),
    },
    async ({ query, limit }) => {
      try {
        const { adminService } = await import('@/db/services');
        const list = await adminService.getStories(1, limit, query);
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'get_story_details',
    'Get full details of a story by ID.',
    { id: z.string() },
    async ({ id }) => {
      try {
        const { adminService } = await import('@/db/services');
        const story = await adminService.getStoryByIdWithAuthor(id);
        return { content: [{ type: 'text', text: JSON.stringify(story) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'restart_story_workflow',
    'Restart a stuck story generation workflow.',
    { storyId: z.string() },
    async ({ storyId }) => {
      try {
        const { adminService } = await import('@/db/services');
        const run = await adminService.createWorkflowRun(storyId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ message: 'Restart triggered successfully.', run }),
            },
          ],
        };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  // -----------------------------------------------------
  // Group E: Tickets
  // -----------------------------------------------------
  server.tool('list_tickets', 'List support tickets.', {}, async () => {
    try {
      const { TicketService } = await import('@/lib/ticketing/service');
      const tickets = await TicketService.getTickets();
      return { content: [{ type: 'text', text: JSON.stringify(tickets) }] };
    } catch (e: unknown) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
    }
  });

  server.tool(
    'update_ticket_status',
    'Update a ticket status.',
    {
      ticketId: z.string(),
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
    },
    async ({ ticketId, status }) => {
      try {
        const { TicketService } = await import('@/lib/ticketing/service');
        await TicketService.updateStatus(ticketId, status);
        return {
          content: [{ type: 'text', text: `Ticket ${ticketId} status updated to ${status}.` }],
        };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  // -----------------------------------------------------
  // Group F: Blog
  // -----------------------------------------------------
  server.tool(
    'list_blogs',
    'List blog posts.',
    { limit: z.number().max(50).default(10) },
    async ({ limit }) => {
      try {
        const { adminBlogService } = await import('@/db/services');
        const list = await adminBlogService.list({ page: 1, limit });
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'create_blog',
    'Create a new blog post.',
    { payload: recordPayload },
    async ({ payload }) => {
      try {
        const { adminBlogService } = await import('@/db/services');
        const post = await adminBlogService.create(payload as unknown as AdminCreatePostInput);
        return { content: [{ type: 'text', text: JSON.stringify(post) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'update_blog',
    'Update a blog post.',
    { id: z.string(), payload: recordPayload },
    async ({ id, payload }) => {
      try {
        const { adminBlogService } = await import('@/db/services');
        const post = await adminBlogService.update(id, payload as unknown as AdminUpdatePostInput);
        return { content: [{ type: 'text', text: JSON.stringify(post) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'translate_blog',
    'Translate a blog post. Payload should contain language and translated fields.',
    { id: z.string(), payload: recordPayload },
    async ({ id, payload }) => {
      try {
        const { adminBlogService } = await import('@/db/services');
        const post = await adminBlogService.upsertTranslation(
          id,
          payload as unknown as AdminTranslationInput,
        );
        return { content: [{ type: 'text', text: JSON.stringify(post) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'update_blog_status',
    'Publish or Archive a blog post.',
    { id: z.string(), action: z.enum(['publish', 'archive']) },
    async ({ id, action }) => {
      try {
        const { adminBlogService } = await import('@/db/services');
        const result =
          action === 'publish'
            ? await adminBlogService.publish(id)
            : await adminBlogService.archive(id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  // -----------------------------------------------------
  // Group G: Email Marketing
  // -----------------------------------------------------
  server.tool(
    'list_campaigns',
    'List email marketing campaigns.',
    { limit: z.number().max(50).default(10), status: campaignStatusFilterSchema },
    async ({ limit, status }) => {
      try {
        const { campaignService } = await import('@/db/services/campaigns');
        const list = await campaignService.listCampaigns(1, limit, status);
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'create_campaign',
    'Create a new email campaign.',
    { payload: recordPayload, adminEmail: z.string() },
    async ({ payload, adminEmail }) => {
      try {
        const { campaignService } = await import('@/db/services/campaigns');
        const created = await campaignService.createCampaign(
          payload as CreateCampaignInput,
          adminEmail,
        );
        return { content: [{ type: 'text', text: JSON.stringify(created) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'get_campaign_details',
    'Get email campaign details.',
    { id: z.string() },
    async ({ id }) => {
      try {
        const { campaignService } = await import('@/db/services/campaigns');
        const details = await campaignService.getCampaign(id);
        return { content: [{ type: 'text', text: JSON.stringify(details) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'edit_campaign',
    'Edit an email campaign.',
    { id: z.string(), payload: recordPayload, adminEmail: z.string() },
    async ({ id, payload, adminEmail }) => {
      try {
        const { campaignService } = await import('@/db/services/campaigns');
        const updated = await campaignService.updateCampaign(
          id,
          payload as UpdateCampaignInput,
          adminEmail,
        );
        return { content: [{ type: 'text', text: JSON.stringify(updated) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'pause_campaign',
    'Pause an active email campaign.',
    { id: z.string(), adminEmail: z.string() },
    async ({ id, adminEmail }) => {
      try {
        const { campaignService } = await import('@/db/services/campaigns');
        const transitioned = await campaignService.transitionCampaignStatus(
          id,
          'paused',
          adminEmail,
        );
        return { content: [{ type: 'text', text: JSON.stringify(transitioned) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'resume_campaign',
    'Resume a paused email campaign (transition to active).',
    { id: z.string(), adminEmail: z.string() },
    async ({ id, adminEmail }) => {
      try {
        const { campaignService } = await import('@/db/services/campaigns');
        const transitioned = await campaignService.transitionCampaignStatus(
          id,
          'active',
          adminEmail,
        );
        return { content: [{ type: 'text', text: JSON.stringify(transitioned) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  // -----------------------------------------------------
  // Group H: FAQs
  // -----------------------------------------------------
  server.tool(
    'list_faqs',
    'List FAQ entries.',
    { limit: z.number().max(50).default(10) },
    async ({ limit }) => {
      try {
        const { adminService } = await import('@/db/services');
        const list = await adminService.getFaqEntries(1, limit);
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'create_faq',
    'Create a new FAQ entry.',
    { payload: recordPayload },
    async ({ payload }) => {
      try {
        const { adminService } = await import('@/db/services');
        const created = await adminService.createFaqEntry(payload as FaqCreateInput);
        return { content: [{ type: 'text', text: JSON.stringify(created) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'update_faq',
    'Update an FAQ entry.',
    { id: z.string(), payload: recordPayload },
    async ({ id, payload }) => {
      try {
        const { adminService } = await import('@/db/services');
        const updated = await adminService.updateFaqEntry(id, payload as FaqUpdateInput);
        return { content: [{ type: 'text', text: JSON.stringify(updated) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool('delete_faq', 'Delete an FAQ entry.', { id: z.string() }, async ({ id }) => {
    try {
      const { adminService } = await import('@/db/services');
      await adminService.deleteFaqEntry(id);
      return { content: [{ type: 'text', text: `Deleted FAQ: ${id}` }] };
    } catch (e: unknown) {
      return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
    }
  });

  // -----------------------------------------------------
  // Group I Extended: Promo Codes
  // -----------------------------------------------------
  server.tool(
    'get_promo_code_details',
    'Get promo code details.',
    { id: z.string() },
    async ({ id }) => {
      try {
        const { adminService } = await import('@/db/services');
        const details = await adminService.getPromotionCodeById(id);
        return { content: [{ type: 'text', text: JSON.stringify(details) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'create_promo_code',
    'Create a new promo code.',
    { payload: recordPayload },
    async ({ payload }) => {
      try {
        const { adminService } = await import('@/db/services');
        const created = await adminService.createPromotionCode(payload as PromoCreateInput);
        return { content: [{ type: 'text', text: JSON.stringify(created) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );
  // -----------------------------------------------------
  server.tool(
    'list_promo_codes',
    'List promo codes.',
    { query: z.string().optional() },
    async ({ query }) => {
      try {
        const { adminService } = await import('@/db/services');
        const list = await adminService.getPromotionCodes(1, 10, query);
        return { content: [{ type: 'text', text: JSON.stringify(list) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );

  server.tool(
    'toggle_promo_code',
    'Toggle a promo code active status.',
    { id: z.string() },
    async ({ id }) => {
      try {
        const { adminService } = await import('@/db/services');
        const code = await adminService.togglePromotionCodeActive(id);
        return { content: [{ type: 'text', text: JSON.stringify(code) }] };
      } catch (e: unknown) {
        return { isError: true, content: [{ type: 'text', text: `Error: ${toolErr(e)}` }] };
      }
    },
  );
}
