export default function HomePage() {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="hero min-h-screen">
        <div className="hero-content text-center">
          <div className="max-w-md">
            <h1 className="text-5xl font-bold text-primary">Mythoria Admin</h1>
            <p className="py-6 text-lg">
              Welcome to the Mythoria Administrative Portal. 
              Manage users, stories, payments, and more.
            </p>
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title justify-center">Setup Status</h2>
                <p>[OK] NextJS 15.3.4 configured</p>
                <p>[OK] TailwindCSS 4 with DaisyUI ready</p>
                <p>[OK] Drizzle ORM 0.44.2 installed</p>
                <p>[OK] Cloud Run deployment successful</p>
                <p>[OK] Multi-database connections ready (Phase 3)</p>
                <p>[PENDING] Authentication system (Phase 4)</p>
                <p>[PENDING] Admin pages migration (Phase 5)</p>
                <div className="divider"></div>
                <div className="flex gap-2 justify-center">
                  <a 
                    href="/api/health" 
                    className="btn btn-primary btn-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Health Check
                  </a>
                  <a 
                    href="/api/health?debug=true" 
                    className="btn btn-secondary btn-sm"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Debug Info
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
