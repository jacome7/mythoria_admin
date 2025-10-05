import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';

// GET /api/workflows - List workflow runs
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') as
      | 'queued'
      | 'running'
      | 'failed'
      | 'completed'
      | 'cancelled'
      | null;
    const search = searchParams.get('search');
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as
      | 'createdAt'
      | 'startedAt'
      | 'endedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Get workflows
    const workflows = await adminService.getWorkflowRuns(
      page,
      limit,
      status || undefined,
      search || undefined,
      sortBy,
      sortOrder,
    );

    // Get total count for pagination
    const totalCount = await adminService.getWorkflowRunsCount(status || undefined);

    return NextResponse.json({
      workflows,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
