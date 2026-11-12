import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <main className="container py-4">
      <h1 className="h3">Page not found</h1>
      <p>
        <Link to="/">Go to CampusBid</Link>
      </p>
    </main>
  )
}
