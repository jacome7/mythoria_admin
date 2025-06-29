# Production Deployment - Attempt 2

## 🔧 Changes Made

### 1. Updated Google OAuth Credentials
- **Client ID**: Updated to production version `803421888801-fsse90vkqpobthd3runvv60dfijnh63t.apps.googleusercontent.com`
- **Client Secret**: Now stored in Google Secret Manager as `google-client-secret`

### 2. Secret Management
- ✅ Sensitive data (GOOGLE_CLIENT_SECRET) stored in Google Secret Manager
- ✅ Non-sensitive data (GOOGLE_CLIENT_ID) in Cloud Build substitutions
- ✅ Cloud Run configured to access secrets with `--set-secrets`

### 3. Environment Variables Added
```yaml
NODE_ENV=production
AUTH_SECRET=$_AUTH_SECRET
GOOGLE_CLIENT_ID=$_GOOGLE_CLIENT_ID
NEXTAUTH_URL=$_NEXTAUTH_URL
DB_HOST=10.19.192.3
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=Mythoria1GCould
MYTHORIA_DB_NAME=mythoria_db
WORKFLOWS_DB_NAME=workflows_db
BACKOFFICE_DB_NAME=backoffice_db
GOOGLE_CLOUD_PROJECT_ID=oceanic-beach-460916-n5
GOOGLE_CLOUD_REGION=europe-west9
```

### 4. Production URLs
- **App URL**: `https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app`
- **OAuth Callback**: `https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app/api/auth/callback/google`

## 🚨 Required OAuth Configuration

**IMPORTANT**: You must add the production callback URL to your Google OAuth settings:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services > Credentials**
3. Find OAuth Client ID: `803421888801-fsse90vkqpobthd3runvv60dfijnh63t`
4. **Add Authorized Redirect URI**:
   ```
   https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app/api/auth/callback/google
   ```

## 📊 Deployment Status
- **Command**: `gcloud beta builds submit --config cloudbuild.yaml`
- **Status**: In Progress...
- **Next Step**: Monitor Cloud Build logs and test authentication

## 🧪 Testing Plan
Once deployment completes:
1. Visit production URL
2. Test authentication with @mythoria.pt email
3. Test authentication with @caravanconcierge.com email
4. Verify domain restrictions work
5. Check error handling
