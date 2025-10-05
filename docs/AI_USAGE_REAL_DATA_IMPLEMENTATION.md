# AI Usage Real Data Implementation

## Overview

Successfully implemented real data fetching for the AI Usage page in `mythoria_admin` by connecting to the `workflows_db` database and fetching actual token usage tracking data.

## Implementation Summary

### 1. Schema Synchronization ✅

- **Created**: `scripts/sync-workflows-schema.ts` - Manual schema sync script
- **Added**: `npm run sync-workflows-schema` command to package.json
- **Status**: Workflows schema is already synchronized between projects

### 2. Multi-Database Setup ✅

- **Confirmed**: Multi-database configuration already exists in `mythoria_admin`
- **Available**: Connection to `workflows_db` via `getWorkflowsDb()`
- **Schema**: Token usage tracking schema already available at `src/db/schema/workflows/token-usage.ts`

### 3. API Endpoints ✅

Created two new API endpoints:

#### `/api/ai-usage/stats`

- **Purpose**: Aggregated statistics for dashboard overview
- **Features**:
  - Time period filtering (1d, 7d, 30d, 90d)
  - Model breakdown with costs and token counts
  - Action breakdown by AI action types
  - Daily usage aggregation
  - Real-time cost calculations

#### `/api/ai-usage/records`

- **Purpose**: Detailed token usage records with pagination
- **Features**:
  - Pagination support (page, pageSize)
  - Search functionality (across models, actions, IDs)
  - Filtering by model and action
  - Sorting by multiple columns
  - Time period filtering

### 4. Frontend Updates ✅

- **Updated**: `src/app/ai-usage/page.tsx`
- **Replaced**: Mock data with real API calls
- **Added**: 1d (24 hours) time period option
- **Enhanced**: Data transformation to match existing UI structure
- **Maintained**: Backward compatibility with existing UI components

### 5. Authentication & Security ✅

- **Implemented**: Proper authentication checks using NextAuth
- **Added**: Domain validation (only @mythoria.pt and @caravanconcierge.com)
- **Secured**: Both API endpoints require valid authentication

## Data Flow

```
1. User selects time period (1d/7d/30d/90d) on AI Usage page
2. Frontend calls `/api/ai-usage/stats?period={timePeriod}`
3. API authenticates user and validates domain
4. API queries `workflows_db.token_usage_tracking` table
5. API aggregates data by models, actions, and daily usage
6. API calculates real-time costs from stored estimates
7. Frontend transforms data to match existing UI structure
8. Dashboard displays real usage data and statistics
```

## Database Schema Utilized

The implementation uses the existing `token_usage_tracking` table with:

- **tokenUsageId**: Primary key
- **authorId**: Cross-database reference to user
- **storyId**: Cross-database reference to story
- **action**: AI action type (story_structure, chapter_writing, etc.)
- **aiModel**: Model identifier (gpt-4-turbo, gemini-pro, etc.)
- **inputTokens**: Number of input tokens used
- **outputTokens**: Number of output tokens generated
- **estimatedCostInEuros**: Calculated cost in euros
- **inputPromptJson**: Stored prompt data
- **createdAt**: Timestamp of usage

## Key Features Implemented

### Real-Time Calculations

- ✅ Total costs calculated from actual database records
- ✅ Token counts aggregated from real usage data
- ✅ Average costs per request computed dynamically
- ✅ Daily/period usage properly filtered and aggregated

### Performance Optimizations

- ✅ Database indexes on frequently queried columns
- ✅ Proper SQL aggregation queries
- ✅ Efficient pagination for large datasets
- ✅ Connection pooling for database access

### Data Transformation

- ✅ Raw database records transformed to UI-compatible format
- ✅ Model names mapped to provider information
- ✅ Action types properly categorized
- ✅ Time-based aggregations for charts and metrics

## Schema Sync Process

To keep schemas synchronized between `story-generation-workflow` and `mythoria_admin`:

```powershell
# Run the manual sync script
npm run sync-workflows-schema
```

This script:

1. Copies all `.ts` files from `story-generation-workflow/src/db/workflows-schema/`
2. Fixes import paths (removes `.js` extensions)
3. Checks modification times to avoid unnecessary copies
4. Updates the index.ts file automatically
5. Provides detailed sync results

## Testing & Validation

### API Testing

- ✅ Authentication validation
- ✅ Domain access control
- ✅ Time period filtering
- ✅ Data aggregation accuracy
- ✅ Error handling

### Frontend Integration

- ✅ Replaced mock data with real API calls
- ✅ Added 1d time period option
- ✅ Maintained existing UI structure
- ✅ Proper error handling and loading states

## Next Steps

1. **Performance Monitoring**: Monitor API response times with real data volumes
2. **Caching Strategy**: Consider implementing Redis caching for expensive aggregations
3. **Data Visualization**: Enhance charts with more detailed real-time insights
4. **Alerts**: Add threshold monitoring for unusual usage patterns
5. **Export Features**: Add CSV/Excel export for detailed usage reports

## Files Modified/Created

### New Files

- `scripts/sync-workflows-schema.ts` - Schema synchronization script
- `src/app/api/ai-usage/stats/route.ts` - Statistics API endpoint
- `src/app/api/ai-usage/records/route.ts` - Records API endpoint

### Modified Files

- `package.json` - Added sync script command
- `src/app/ai-usage/page.tsx` - Updated to use real data APIs

### Database Infrastructure (Already Existing)

- `src/lib/database-config.ts` - Multi-database configuration
- `src/db/index.ts` - Database connection management
- `src/db/schema/workflows/` - Synchronized workflows schema

The implementation is now complete and ready for testing with real token usage data from the `workflows_db` database.
