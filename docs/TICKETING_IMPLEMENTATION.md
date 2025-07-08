# Ticketing System Implementation

## Overview

This document describes the implementation of the ticketing system for handling customer requests in the Mythoria platform. The system is built using PostgreSQL, Drizzle ORM, and Next.js API routes.

## Phase 2: Form Integrations ✅ COMPLETED

### Overview
Integrated the existing contact, print, and payment forms in mythoria-webapp to automatically create tickets in the admin system when users submit requests.

### Implementation Details

#### **1. Contact Form Integration**
- **File**: `mythoria-webapp/src/components/ContactForm.tsx`
- **Changes**: 
  - Added ticket creation before sending notification email
  - Maps contact categories to admin-friendly names
  - Handles both authenticated and anonymous submissions
  - Graceful fallback if ticket creation fails

#### **2. Print Request Integration**  
- **File**: `mythoria-webapp/src/components/print-order/PrintOrderContent.tsx`
- **Changes**:
  - Added ticket creation when print orders are placed
  - Includes story ID, user ID, shipping address, and print format
  - Maintains existing print request workflow

#### **3. Payment Request Integration**
- **File**: `mythoria-webapp/src/app/[locale]/buy-credits/page.tsx` 
- **Changes**:
  - Added ticket creation when payment orders are initiated
  - Includes amount, user ID, and payment method
  - Maintains existing payment workflow (placeholder)

#### **4. Environment Configuration**
- **File**: `mythoria-webapp/config/environment.js`
- **Changes**: Added `admin.apiUrl` configuration for admin API endpoint

### Integration Flow

```
User Action → Form Submission → [Create Ticket] → Original Workflow
                                      ↓
                               Admin Ticket System
```

### Category Mapping

**Contact Form Categories**:
- General Inquiry → General
- Bug Report → Bug
- Feature Request → Feature Request  
- Technical Support → Support
- Payment Issue → Payment
- Other → Other

**Error Handling**:
- Ticket creation failure doesn't block user workflow
- Errors logged for monitoring
- User sees normal success/error messages from original forms

---

## Phase 3: Admin UI for Ticket Management ✅ COMPLETED

### Overview
Built a complete admin interface for ticket management including list view, detail view, and dashboard widget.

### Implementation Details

#### **1. Navigation Integration**
- **File**: `mythoria_admin/src/components/AdminHeader.tsx`
- **Changes**: Added "Customer Tickets" link to the Tasks dropdown menu

#### **2. Tickets List Page**
- **File**: `mythoria_admin/src/app/tickets/page.tsx`
- **Features**:
  - Complete ticket listing with search and filters
  - Filter by status, priority, and type
  - Responsive table with ticket details
  - Metrics cards showing key statistics
  - Direct links to individual ticket details

#### **3. Ticket Detail Page**
- **File**: `mythoria_admin/src/app/tickets/[id]/page.tsx`
- **Features**:
  - Full ticket information display
  - Customer information sidebar
  - Comments system with admin/system differentiation
  - Quick actions for status and priority updates
  - Metadata display for category-specific information
  - Real-time status updates

#### **4. Dashboard Widget**
- **File**: `mythoria_admin/src/components/TicketsWidget.tsx`
- **Features**:
  - Key ticket metrics at a glance
  - Warning alerts for urgent/open tickets
  - Quick navigation to full tickets view
  - Responsive design matching dashboard theme

#### **5. Dashboard Integration**
- **File**: `mythoria_admin/src/app/page.tsx`
- **Changes**: Added TicketsWidget to the dashboard layout

### UI Features

#### **Tickets List View**
- **Metrics Dashboard**: Total, Open, In Progress, Resolved, Urgent counts
- **Advanced Filters**: Status, Priority, Type with real-time filtering
- **Responsive Table**: 
  - Ticket ID (truncated with hover)
  - Subject with description preview
  - Type, Status, Priority badges with color coding
  - Customer name and email
  - Creation date and time
  - Action buttons
- **Color-coded Status System**:
  - Open: Red (Error)
  - In Progress: Yellow (Warning)  
  - Resolved: Green (Success)
  - Closed: Gray (Neutral)
- **Priority System**:
  - Urgent: Red (Error)
  - High: Yellow (Warning)
  - Medium: Blue (Info)
  - Low: Gray (Ghost)

#### **Ticket Detail View**
- **Header**: Breadcrumb navigation and ticket subject
- **Main Content**:
  - Ticket details with type/status/priority badges
  - Full description display
  - Metadata rendering for additional information
  - Comments section with add/view functionality
- **Sidebar**:
  - Customer information panel
  - Quick action controls for status and priority
  - Visual loading states during updates
- **Comments System**:
  - Add new comments with admin attribution
  - View all comments with timestamps
  - Admin vs System comment differentiation
  - Real-time comment addition

#### **Dashboard Widget**
- **Quick Metrics**: Total tickets and urgent count
- **Status Breakdown**: Open, In Progress, Resolved counts
- **Alert System**: Warnings for urgent tickets needing attention
- **Quick Access**: Direct link to full tickets interface

### User Experience Features
- **Loading States**: Spinner animations during data fetching
- **Error Handling**: Graceful error display and fallback states
- **Responsive Design**: Mobile-friendly layouts
- **Real-time Updates**: Status changes reflect immediately
- **Intuitive Navigation**: Clear breadcrumbs and action buttons
- **Visual Feedback**: Color-coded statuses and loading indicators

---

## Implementation Status

### ✅ **Completed Phases**
- `feature_ideas` → "Feature request"
- `bug_report` → "Bug" 
- `technical_issues` → "Story failure"
- `delivery` → "Delivery"
- `credits` → "Credits"
- `business_partnership` → "Business partner"
- `general` → "General"

### Error Handling

- **Graceful Degradation**: If ticket creation fails, the original form workflow continues
- **Logging**: Failed ticket creation attempts are logged for debugging
- **Non-blocking**: Ticket creation failures don't interrupt user experience

### Technical Implementation

#### Ticket Creation Pattern
```typescript
// Standard pattern used across all forms
try {
  const ticketResponse = await fetch(`${config.admin.apiUrl}/api/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      category: 'contact|print_request|payment_request',
      // category-specific fields...
      userId: user?.id, // null for anonymous
    })
  });
  
  if (ticketResponse.ok) {
    console.log('Ticket created:', await ticketResponse.json());
  }
} catch (error) {
  console.warn('Ticket creation failed:', error);
  // Continue with original workflow
}
```

#### User Context
- **Authenticated Users**: User ID from Clerk authentication is included
- **Anonymous Users**: `userId` is null (handled in API)
- **Data Consistency**: All user-related data is captured in ticket metadata

### Benefits Achieved

1. **Centralized Request Management**: All customer requests now automatically create tickets
2. **Better Tracking**: Each request gets a unique ticket ID for follow-up
3. **Improved Workflow**: Admins can manage all requests from one interface
4. **Historical Record**: Complete audit trail of all customer interactions
5. **Non-disruptive**: Users experience no change in their workflows

### Environment Variables

Add to `.env.local` in mythoria-webapp:
```bash
ADMIN_API_URL=http://localhost:3001  # Development
# ADMIN_API_URL=https://your-admin-domain.com  # Production
```

### Build Status
✅ **Build successful** - All TypeScript and ESLint errors resolved
✅ **Next.js 15 compatibility** - Route parameters updated for async params pattern
✅ **Database migrations applied** - Tables and indexes created successfully

### Database Schema

The ticketing system uses the `backoffice_db` database with the following tables:

#### Tables Created

1. **tickets** - Main tickets table
   - `id` (serial, primary key)
   - `user_id` (uuid, nullable) - Links to users in mythoria_db
   - `category` (varchar) - 'contact', 'print_request', 'payment_request'
   - `subject` (varchar)
   - `description` (text)
   - `status` (enum) - 'open', 'in_progress', 'resolved', 'closed'
   - `priority` (enum) - 'low', 'medium', 'high'
   - `metadata` (jsonb) - Stores request-specific data
   - `created_at`, `updated_at`, `resolved_at` (timestamps)

2. **ticket_comments** - Comment threads for tickets
   - `id` (serial, primary key)
   - `ticket_id` (integer, foreign key)
   - `author_id` (uuid) - Admin who commented
   - `body` (text)
   - `is_internal` (boolean) - Internal notes vs customer-visible
   - `created_at` (timestamp)

3. **ticket_notification_config** - Notification settings
   - `id` (serial, primary key)
   - `category` (varchar)
   - `ticket_event` (varchar) - 'created', 'resolved', 'closed'
   - `send_to_customer` (boolean)
   - `email_template` (varchar)
   - `enabled` (boolean)
   - `created_at` (timestamp)

#### Indexes Created

- `idx_tickets_status` - For filtering by status
- `idx_tickets_category` - For filtering by category  
- `idx_tickets_created_at` - For date-based ordering
- `idx_ticket_comments_ticket_id` - For comment lookups

### API Endpoints

#### Core Ticket Management

```
GET    /api/tickets              # List tickets with filtering
POST   /api/tickets              # Create new ticket
GET    /api/tickets/:id          # Get ticket details with comments
PATCH  /api/tickets/:id          # Update ticket status/priority
POST   /api/tickets/:id/comments # Add comment to ticket
GET    /api/tickets/metrics      # Get ticket metrics for dashboard
```

#### Request Body Examples

**Create Contact Ticket:**
```json
{
  "category": "contact",
  "email": "user@example.com",
  "name": "John Doe",
  "type": "Bug",
  "description": "Detailed description of the issue",
  "userId": "optional-user-id"
}
```

**Create Print Request Ticket:**
```json
{
  "category": "print_request",
  "storyId": "story-uuid",
  "userId": "user-id",
  "shippingAddress": { "street": "...", "city": "..." },
  "printFormat": "standard"
}
```

**Create Payment Request Ticket:**
```json
{
  "category": "payment_request",
  "amount": 29.99,
  "userId": "user-id",
  "paymentMethod": "stripe"
}
```

**Update Ticket Status:**
```json
{
  "status": "in_progress"
}
```

**Add Comment:**
```json
{
  "body": "Comment text here",
  "isInternal": false
}
```

#### Query Parameters for GET /api/tickets

- `status` - Comma-separated list: "open,in_progress"
- `category` - Single category: "contact"
- `priority` - Single priority: "high"
- `search` - Text search in subject/description
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

### Service Layer

The `TicketService` class provides all business logic:

```typescript
// Create tickets
TicketService.createContactTicket(data)
TicketService.createPrintTicket(data) 
TicketService.createPaymentTicket(data)

// Manage tickets
TicketService.getTickets(filters)
TicketService.getTicketById(id)
TicketService.updateStatus(id, status)
TicketService.updatePriority(id, priority)
TicketService.addComment(ticketId, body, authorId, isInternal)

// Analytics
TicketService.getMetrics()
```

### Authentication & Authorization

All API endpoints require:
1. Valid authentication session
2. Email domain restriction (@mythoria.pt, @caravanconcierge.com)

### Notification Configuration

Default notification configurations are seeded:

- Contact tickets: Send confirmation on creation, notification on resolution
- Print requests: Confirmation on receipt, notification when completed
- Payment requests: Confirmation on receipt

## Files Created/Modified

### New Files
- `src/db/schema/tickets.ts` - Database schema
- `src/lib/ticketing/service.ts` - Business logic service
- `src/lib/ticketing/seed.ts` - Seed notification configs
- `src/lib/ticketing/test-types.ts` - Type verification
- `src/app/api/tickets/route.ts` - Main tickets API
- `src/app/api/tickets/[id]/route.ts` - Individual ticket API
- `src/app/api/tickets/[id]/comments/route.ts` - Comments API
- `src/app/api/tickets/metrics/route.ts` - Metrics API

### Modified Files
- `src/db/schema/index.ts` - Export tickets schema
- `drizzle.config.ts` - Include tickets schema in migrations
- `src/db/seed.ts` - Include ticketing seed data

### Database Migrations
- `drizzle/0001_stormy_microbe.sql` - Create tables and enums
- `drizzle/0002_illegal_spacker_dave.sql` - Add indexes

## Testing

The implementation includes:
- Type safety verification in `test-types.ts`
- Proper error handling in all API endpoints
- Input validation for all request types
- Comprehensive TypeScript interfaces

## Next Steps

This completes **Phase 1** of the ticketing system implementation. The next phases will include:

- **Phase 2**: Integration with existing forms (contact, print, payment)
- **Phase 3**: Admin UI for ticket management
- **Phase 4**: Notification engine integration
### ✅ **Completed Phases**
- **Phase 1**: Database Schema + Core API ✅
- **Phase 2**: Form Integrations ✅  
- **Phase 3**: Admin UI for Ticket Management ✅

### 🚧 **Remaining Phases**
- **Phase 4**: Notification engine integration for ticket events
- **Phase 5**: Advanced analytics and reporting

---

## Architecture Notes

### Simplified Design
- No role-based routing (all tickets visible to admin)
- No auto-assignment (manual handling only)
- No real-time updates (page refresh to see changes)
- No SLA tracking (simple timestamp tracking)
- No file attachments (can be added later)
- Single admin interface (no customer portal)

### Extensibility
The system is designed to be easily extensible:
- Metadata field allows category-specific data storage
- Service layer abstracts business logic from API
- Notification config table supports flexible notification rules
- Clean separation between database, service, and API layers

## Usage Examples

### Creating a Contact Ticket via API

```bash
curl -X POST /api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "category": "contact",
    "email": "user@example.com",
    "name": "John Doe", 
    "type": "Bug",
    "description": "Story generation failed"
  }'
```

### Listing Open Tickets

```bash
curl "/api/tickets?status=open,in_progress&limit=20"
```

### Updating Ticket Status

```bash
curl -X PATCH /api/tickets/123 \
  -H "Content-Type: application/json" \
  -d '{"status": "resolved"}'
```

### Adding a Comment

```bash
curl -X POST /api/tickets/123/comments \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Issue has been resolved",
    "isInternal": false
  }'
```

The ticketing system core infrastructure is now ready for the next implementation phases!
