# Production Deployment Checklist - Mythoria Admin Portal

## ✅ Pre-Deployment Setup Complete

### Authentication Configuration
- ✅ Auth.js v5 configured with JWT strategy
- ✅ Google OAuth provider configured
- ✅ Domain restrictions implemented (@mythoria.pt, @caravanconcierge.com)
- ✅ Custom sign-in and error pages created
- ✅ Middleware for route protection implemented

### Environment Variables
- ✅ AUTH_SECRET: Set in Cloud Build
- ✅ GOOGLE_CLIENT_ID: Set in Cloud Build
- ✅ GOOGLE_CLIENT_SECRET: Set in Cloud Build  
- ✅ NEXTAUTH_URL: Set to production URL
- ✅ NODE_ENV: Set to production

### Cloud Build Configuration
- ✅ Port changed from 3001 (dev) to 3000 (production)
- ✅ Environment variables configured as substitutions
- ✅ Production URL: `https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app`

## 🔧 Post-Deployment Actions Required

### 1. Update Google OAuth Redirect URIs
You need to add the production callback URL to your Google Cloud Console:

**Go to:** [Google Cloud Console](https://console.cloud.google.com/)
**Navigate to:** APIs & Services > Credentials
**Find:** OAuth 2.0 Client ID: `803421888801-0ls40ne2pm9vgj2nenomi1ee160mfmlf`
**Add Redirect URI:** 
```
https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app/api/auth/callback/google
```

### 2. Test Production Authentication
1. Visit the production URL
2. Try signing in with a @mythoria.pt email
3. Try signing in with a @caravanconcierge.com email
4. Verify that other domains are rejected
5. Test the error handling

### 3. Monitor Deployment
- Check Cloud Run logs for any errors
- Verify environment variables are loaded correctly
- Test all authentication flows

## 🚨 Known Issues & Solutions

### If Authentication Fails:
1. **Invalid Redirect URI**: Update Google OAuth settings
2. **Environment Variables**: Check Cloud Run environment tab
3. **CORS Issues**: Verify NEXTAUTH_URL matches exact production domain

### If Build Fails:
1. Check Cloud Build logs in GCP Console
2. Verify Docker build process
3. Check for missing dependencies

## 📊 Success Metrics
- [ ] Application loads without errors
- [ ] Authentication redirects to Google OAuth
- [ ] Domain restrictions work correctly
- [ ] Authorized users can access the dashboard
- [ ] Unauthorized users see appropriate error messages

## 🔒 Security Verification
- [ ] Only authorized domains can sign in
- [ ] Email verification is enforced
- [ ] JWT tokens are properly signed
- [ ] Error messages don't leak sensitive information
- [ ] All routes are properly protected by middleware

## 📝 Next Steps After Successful Deployment
1. Set up monitoring and alerts
2. Configure custom domain (if needed)
3. Plan Phase 5: Admin pages migration
4. Set up database adapter (when ready)
5. Implement user role management

---

**Deployment Command Used:**
```bash
gcloud beta builds submit --config cloudbuild.yaml
```

**Production URL:**
```
https://mythoria-admin-oceanic-beach-460916-n5-europe-west9.a.run.app
```
