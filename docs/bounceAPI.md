# API Specification: Email Bounce Tracking Endpoints

## Overview

The system tracks email campaign performance through the **leads** table with an `emailStatus` field that supports bounce tracking. The existing infrastructure allows updating lead email statuses through authenticated endpoints.

---

## **API Key Authentication (Service-to-Service)**
For external services (e.g., notification engine, email providers) to report bounces:

- **Method**: Bearer token or X-API-Key header
- **Header Options**:
  - `Authorization: Bearer YOUR_API_KEY` (Recommended)
  - `X-API-Key: YOUR_API_KEY`
- **Environment Variable**: `ADMIN_API_KEY`
- **Security**: Symmetric key validation (key must match environment configuration)
- **Permissions**: `tickets:read`, `tickets:create`, `tickets:update` (extendable for leads)

**Example API Key Request:**
```bash
curl -X PATCH https://admin.mythoria.pt/api/admin/leads/{id} \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"emailStatus": "hard_bounce"}'
```

---

## Endpoints for Marking Emails as Bounced

### 1. **Update Single Lead Email Status**

#### `PATCH /api/admin/leads/{id}`

Mark a specific lead email as bounced (soft or hard bounce).

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Lead ID |

**Request Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "emailStatus": "hard_bounce"
}
```

**Available Email Statuses:**
- `ready` - Ready to send
- `sent` - Email sent
- `open` - Email opened
- `click` - Link clicked
- `soft_bounce` - Temporary delivery failure (mailbox full, server down)
- `hard_bounce` - Permanent delivery failure (invalid email, domain doesn't exist)
- `unsub` - Unsubscribed

**Success Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "mobilePhone": null,
  "language": "en-US",
  "emailStatus": "hard_bounce",
  "lastEmailSentAt": "2025-01-15T10:30:00.000Z",
  "lastUpdatedAt": "2025-01-15T11:00:00.000Z"
}
```

**Error Responses:**

| Code | Description | Response Body |
|------|-------------|---------------|
| 400 | Invalid request | `{"error": "Invalid email status"}` |
| 401 | Unauthorized | `{"error": "Unauthorized"}` |
| 403 | Forbidden | `{"error": "Forbidden"}` |
| 404 | Lead not found | `{"error": "Lead not found"}` |
| 500 | Server error | `{"error": "Internal server error"}` |

**Example:**
```bash
curl -X PATCH https://admin.mythoria.pt/api/admin/leads/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer abc123xyz456" \
  -H "Content-Type: application/json" \
  -d '{
    "emailStatus": "hard_bounce"
  }'
```

---

### 2. **Bulk Update Lead Email Statuses**

#### `POST /api/admin/leads/bulk`

Mark multiple leads as bounced in a single request.

**Request Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "action": "changeStatus",
  "ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "emailStatus": "soft_bounce"
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | string | Yes | Must be `"changeStatus"` |
| `ids` | array[string] | Yes | Array of lead UUIDs |
| `emailStatus` | string | Yes | Target email status (see list above) |

**Success Response (200 OK):**
```json
{
  "message": "Successfully updated 2 lead(s) to status: soft_bounce",
  "count": 2,
  "leads": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user1@example.com",
      "emailStatus": "soft_bounce",
      "lastUpdatedAt": "2025-01-15T11:00:00.000Z"
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "email": "user2@example.com",
      "emailStatus": "soft_bounce",
      "lastUpdatedAt": "2025-01-15T11:00:00.000Z"
    }
  ]
}
```

**Error Responses:**

| Code | Description | Response Body |
|------|-------------|---------------|
| 400 | Invalid request | `{"error": "Invalid request. Required: action (string), ids (array)"}` |
| 400 | Invalid IDs | `{"error": "All IDs must be strings"}` |
| 400 | Invalid status | `{"error": "Invalid email status. Must be one of: ready, sent, open, click, soft_bounce, hard_bounce, unsub"}` |
| 401 | Unauthorized | `{"error": "Unauthorized"}` |
| 403 | Forbidden | `{"error": "Forbidden"}` |
| 500 | Server error | `{"error": "Internal server error"}` |

**Example:**
```bash
curl -X POST https://admin.mythoria.pt/api/admin/leads/bulk \
  -H "Authorization: Bearer abc123xyz456" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "changeStatus",
    "ids": [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
    ],
    "emailStatus": "hard_bounce"
  }'
```

---

### 3. **Look Up Lead by Email** (Alternative Approach)

#### `GET /api/admin/leads?search={email}`

Find a lead by email address before marking as bounced.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | Yes | Email address to search |
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Results per page (default: 50) |

**Request Headers:**
```
Authorization: Bearer YOUR_API_KEY
```

**Success Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "mobilePhone": null,
      "language": "en-US",
      "emailStatus": "sent",
      "lastEmailSentAt": "2025-01-15T10:30:00.000Z",
      "lastUpdatedAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "totalPages": 1,
    "totalCount": 1,
    "hasNext": false,
    "hasPrev": false,
    "limit": 50
  }
}
```

**Example:**
```bash
curl -X GET "https://admin.mythoria.pt/api/admin/leads?search=john.doe%40example.com" \
  -H "Authorization: Bearer abc123xyz456"
```

---

## Recommended Implementation Flow

### For Email Service Providers (Webhook Approach)

When your email service provider (e.g., SendGrid, Mailgun, AWS SES) detects a bounce:

1. **Receive bounce webhook** from your email provider
2. **Extract email address** and bounce type from webhook payload
3. **Look up lead ID** using `GET /api/admin/leads?search={email}`
4. **Update email status** using `PATCH /api/admin/leads/{id}`

**Example Integration Code (Node.js):**

```javascript
// Webhook handler for email bounce notifications
async function handleEmailBounce(bouncePayload) {
  const { email, bounceType } = bouncePayload;
  
  // Determine status based on bounce type
  const emailStatus = bounceType === 'hard' ? 'hard_bounce' : 'soft_bounce';
  
  // Step 1: Find lead by email
  const searchResponse = await fetch(
    `https://admin.mythoria.pt/api/admin/leads?search=${encodeURIComponent(email)}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      }
    }
  );
  
  const searchData = await searchResponse.json();
  
  if (searchData.data.length === 0) {
    console.log(`Lead not found for email: ${email}`);
    return;
  }
  
  const leadId = searchData.data[0].id;
  
  // Step 2: Update lead status
  const updateResponse = await fetch(
    `https://admin.mythoria.pt/api/admin/leads/${leadId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ emailStatus })
    }
  );
  
  if (updateResponse.ok) {
    console.log(`Successfully marked ${email} as ${emailStatus}`);
  } else {
    console.error(`Failed to update lead: ${updateResponse.status}`);
  }
}
```

---

## Database Schema Reference

The leads are stored in the **mythoria** database:

```typescript
// Table: leads
interface Lead {
  id: string;              // UUID v4 primary key
  name: string | null;     // Contact name (optional)
  email: string;           // Normalized email (unique, lowercase)
  mobilePhone: string | null;
  language: string;        // Format: 'en-US', 'pt-PT'
  lastEmailSentAt: Date | null;
  emailStatus: 'ready' | 'sent' | 'open' | 'click' | 'soft_bounce' | 'hard_bounce' | 'unsub';
  lastUpdatedAt: Date;     // Auto-updated on status change
}
```

**Indexes:**
- `leads_email_idx` (unique)
- `leads_email_status_idx`
- `leads_last_email_sent_at_idx`
- `leads_status_sent_at_idx` (composite)

---

## Security Notes

1. **API Key Storage**: Store `ADMIN_API_KEY` in Secret Manager (Google Cloud) or equivalent secure storage
2. **Key Rotation**: Plan for periodic API key rotation
3. **Rate Limiting**: Consider implementing rate limits for bulk operations
4. **Validation**: All email addresses are normalized to lowercase before storage
5. **Audit Trail**: `lastUpdatedAt` tracks when status changes occur

---

## Testing Endpoints

Use the **ping endpoint** to verify API key authentication:

```bash
curl -X GET https://admin.mythoria.pt/api/ping \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Pong! API key valid",
  "timestamp": "2025-01-15T11:00:00.000Z",
  "keyInfo": {
    "isValid": true,
    "source": "environment"
  }
}
```

---

## Support

For implementation questions or issues, contact the Mythoria development team at **@mythoria.pt** or **@caravanconcierge.com**.
