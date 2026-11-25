import { Wordmark } from './ui'

export default function SetupNotice() {
  return (
    <main className="cb-auth">
      <div className="cb-card cb-auth-card mx-auto" style={{ maxWidth: '40rem' }}>
        <p className="cb-brand mb-3">
          <Wordmark by />
        </p>
        <h1 className="h3">CampusBid is not connected to a database yet</h1>
        <p>
          This copy has no <code>.env</code> file, so it cannot sign anyone in. The app itself starts fine; it just has
          nothing to talk to.
        </p>
        <ol>
          <li>
            Copy <code>.env.example</code> to <code>.env</code>.
          </li>
          <li>
            Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> from the team's Supabase
            project (Project Settings, API).
          </li>
          <li>
            Stop and start <code>npm run dev</code>.
          </li>
        </ol>
        <p className="alert alert-info">
          No database or internet here? Run <code>npm run demo</code> for the offline demo mode. It is clearly labelled,
          keeps its data only in this browser, and is not the real app.
        </p>
        <p className="cb-muted mb-0">
          The access-rule checks do not need a database: run <code>npm run test:offline</code>.
        </p>
      </div>
    </main>
  )
}
