# Google Postmaster Tools API Integration Setup Guide

This document explains how to configure the Google Postmaster Tools API for email deliverability monitoring in the Mythoria Admin Portal.

## Overview

The Postmaster Tools API integration displays email deliverability metrics including:

- Domain reputation (HIGH, MEDIUM, LOW, BAD)
- User-reported spam rates
- Authentication success rates (SPF, DKIM, DMARC)
- Encryption rates (TLS)
- Delivery errors breakdown
- IP reputation distribution

Data is fetched from Google Postmaster Tools and cached for 6 hours to respect API rate limits.

## Prerequisites

1. **Domain Ownership**: You must own and operate the domain `mythoria.pt`
2. **Email Volume**: Sufficient email volume to Gmail users (Google requires a minimum volume for data availability)
3. **Google Workspace Account**: The impersonation user must have a Google account (e.g., `rodrigo.jacome@mythoria.pt`)
4. **Service Account**: Already set up for Gmail API (notification-engine)

## Setup Steps

### 1. Verify Domain in Postmaster Tools

The domain must be verified in Google Postmaster Tools before the API can return data.

1. Go to [Google Postmaster Tools](https://postmaster.google.com)
2. Sign in with the impersonation account (`rodrigo.jacome@mythoria.pt`)
3. Click "Add Domain" (+ button)
4. Enter `mythoria.pt`
5. Follow the verification steps:
   - Add a TXT record to your DNS
   - Wait for verification (usually instant, can take up to 10 minutes)
6. Once verified, data will start appearing within 24-48 hours (if sufficient volume)

### 2. Enable Postmaster Tools API

1. Go to [Google Cloud Console APIs](https://console.cloud.google.com/apis/library)
2. Select project: `oceanic-beach-460916-n5`
3. Search for "Gmail Postmaster Tools API"
4. Click **Enable**

### 3. Add API Scope to Domain-Wide Delegation

**IMPORTANT**: The service account already has domain-wide delegation configured for Gmail API. We only need to add the Postmaster Tools scope.

#### Steps:

1. Go to [Google Workspace Admin Console](https://admin.google.com)
2. Sign in as a super administrator
3. Navigate to: **Security > Access and data control > API Controls > Domain-wide delegation**
4. Find the service account: `notification-engine-gmail@oceanic-beach-460916-n5.iam.gserviceaccount.com`
5. Click **Edit** (or **View Details**)
6. Add the following scope to the existing list:
   ```
   https://www.googleapis.com/auth/postmaster.readonly
   ```
7. Keep existing scopes:
   ```
   https://www.googleapis.com/auth/gmail.send
   https://www.googleapis.com/auth/gmail.readonly
   ```
8. Click **Authorize**

**Note**: If you can't find the service account, you may need to add it:

- Client ID: Find in [Service Account Details](https://console.cloud.google.com/iam-admin/serviceaccounts) (looks like: `123456789012345678901`)
- OAuth Scopes: All three scopes listed above

### 4. Grant Postmaster Tools Access to Impersonation User

The impersonation user must have access to view Postmaster Tools data.

1. Go to [Google Postmaster Tools](https://postmaster.google.com)
2. Sign in as the domain owner
3. Click on the domain `mythoria.pt`
4. Click **More** > **Manage**
5. Click **Add** (bottom right)
6. Enter: `rodrigo.jacome@mythoria.pt`
7. The user will now have read access to Postmaster data

### 5. Environment Variables

The following environment variables are already configured in `.env.local`:

```bash
# Google Postmaster Tools API
POSTMASTER_DOMAIN=mythoria.pt
POSTMASTER_SERVICE_ACCOUNT_EMAIL=notification-engine-gmail@oceanic-beach-460916-n5.iam.gserviceaccount.com
POSTMASTER_SERVICE_ACCOUNT_KEY=../notification-engine/scripts/oceanic-beach-460916-n5-ca6af2727c51.json
POSTMASTER_IMPERSONATE_EMAIL=rodrigo.jacome@mythoria.pt
```

For production (Cloud Run), add to `cloudbuild.yaml` or set via Cloud Build substitutions.

## Testing

### Local Testing

1. Start the admin portal:

   ```bash
   npm run dev
   ```

2. Navigate to: http://localhost:3001/email-marketing

3. Scroll down to "Email Deliverability Health" card

4. Click **Load Data** button

5. Expected behaviors:
   - **Success**: Displays metrics with domain reputation badge
   - **No Data (204)**: "Insufficient data" warning (normal if volume is low or domain just verified)
   - **Access Denied (403)**: Domain-wide delegation scope not added
   - **Not Found (404)**: Domain not verified in Postmaster Tools
   - **Not Configured (503)**: Environment variables missing

### API Testing

Test the API endpoint directly:

```bash
curl http://localhost:3001/api/postmaster/traffic-stats \
  -H "Cookie: your-auth-cookie"
```

Or use the browser dev tools Network tab when clicking "Load Data".

## Troubleshooting

### "Insufficient data" Message

**Cause**: Google requires minimum email volume to protect user privacy.

**Solution**:

- Wait 24-48 hours after domain verification
- Ensure you're sending significant volume to Gmail users
- Check volume thresholds aren't met yet

### "Access denied" Error

**Cause**: Domain-wide delegation scope not configured correctly.

**Solution**:

1. Verify scope is added: `https://www.googleapis.com/auth/postmaster.readonly`
2. Check service account email matches exactly
3. Wait 5-10 minutes for changes to propagate
4. Try refreshing the data

### "Domain not found" Error

**Cause**: Domain not verified in Postmaster Tools.

**Solution**:

1. Visit [Google Postmaster Tools](https://postmaster.google.com)
2. Verify domain is listed and marked as "Verified"
3. Add domain if not present
4. Complete DNS verification

### No Data After Verification

**Cause**: Insufficient email volume or waiting period.

**Solution**:

- Google requires minimum daily volume (exact threshold not published)
- Data appears 24-48 hours after verification
- Ensure emails are authenticated with SPF/DKIM
- Check that emails are sent to @gmail.com addresses

### Service Account Key Not Found

**Cause**: Relative path to key file is incorrect.

**Solution**:

1. Verify file exists: `../notification-engine/scripts/oceanic-beach-460916-n5-ca6af2727c51.json`
2. Use absolute path if needed in production
3. Check file permissions (must be readable)

## Production Deployment

### Cloud Build Configuration

Add to `cloudbuild.yaml` in the `--set-env-vars` section:

```yaml
--set-env-vars=POSTMASTER_DOMAIN=mythoria.pt,\
POSTMASTER_SERVICE_ACCOUNT_EMAIL=notification-engine-gmail@oceanic-beach-460916-n5.iam.gserviceaccount.com,\
POSTMASTER_IMPERSONATE_EMAIL=rodrigo.jacome@mythoria.pt
```

Add to `--set-secrets` section:

```yaml
--set-secrets=POSTMASTER_SERVICE_ACCOUNT_KEY=gmail-service-account-key:latest
```

**Note**: The service account key should be stored in Google Secret Manager as `gmail-service-account-key` (same key used for notification-engine).

## API Reference

### GET /api/postmaster/traffic-stats

Fetch latest email deliverability metrics.

**Query Parameters:**

- `refresh=true` - Bypass cache and fetch fresh data

**Response (200 Success):**

```json
{
  "success": true,
  "cached": false,
  "data": {
    "date": "2025-01-30",
    "domainReputation": "HIGH",
    "userSpamRate": 0.12,
    "authenticationRates": {
      "spf": 99.8,
      "dkim": 99.9,
      "dmarc": 99.7
    },
    "encryptionRates": {
      "inbound": 98.5,
      "outbound": 100.0
    },
    "deliveryErrors": {
      "permanent": [],
      "temporary": [],
      "totalErrorRate": 0.05
    },
    "ipReputation": {
      "high": 10,
      "medium": 0,
      "low": 0,
      "bad": 0
    }
  }
}
```

**Response (204 No Data):**

```json
{
  "success": false,
  "error": "No data available",
  "message": "No traffic statistics available. Domain may not be verified or volume too low."
}
```

## Security Considerations

1. **Service Account Key**: Never commit the JSON key to version control
2. **Least Privilege**: Only `postmaster.readonly` scope is used (read-only)
3. **Authentication**: API routes require admin authentication
4. **Rate Limiting**: Built-in 6-hour cache prevents API abuse
5. **Domain-Wide Delegation**: Limited to specific impersonation user

## Support Links

- [Google Postmaster Tools](https://postmaster.google.com)
- [Postmaster Tools Help](https://support.google.com/mail/answer/9981691)
- [API Documentation](https://developers.google.com/gmail/postmaster)
- [Email Sender Guidelines](https://support.google.com/a/answer/81126)

## Changelog

### 2025-01-31

- Initial setup documentation
- Domain-wide delegation scope configuration
- API integration with caching
- UI component with manual refresh

---

**Questions?** Contact the development team or refer to the main [AGENTS.md](../AGENTS.md) documentation.
