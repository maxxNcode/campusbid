import { Link } from 'react-router'
import { SiteFooter } from '../components/AppLayout'
import { Wordmark } from '../components/ui'

export default function NotFoundPage() {
  return (
    <>
      <main className="cb-auth">
        <div className="cb-card cb-auth-card mx-auto text-center" style={{ maxWidth: '32rem' }}>
          <p className="cb-brand justify-content-center mx-auto mb-3">
            <Wordmark />
          </p>
          <h1 className="h3">Page not found</h1>
          <p className="cb-muted">This address does not match any CampusBid page. The link may be old or mistyped.</p>
          <Link to="/" className="btn btn-primary">
            Go to Browse
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
