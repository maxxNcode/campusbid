import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { signIn } from '../lib/accounts'
import { demoAccounts, demoMode } from '../lib/demo'
import AuthShell from '../components/AuthShell'

export default function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message === 'Invalid login credentials'
          ? 'The email or password is incorrect.'
          : 'Sign in failed. Check your connection and try again.',
      )
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="h3 mb-1">Sign in</h1>
      <p className="cb-muted">Use the email you registered with.</p>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="sign-in-email" className="form-label">
            Email
          </label>
          <input
            id="sign-in-email"
            type="email"
            className="form-control"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="mb-3">
          <label htmlFor="sign-in-password" className="form-label">
            Password
          </label>
          <input
            id="sign-in-password"
            type="password"
            className="form-control"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {errorMessage && (
          <p className="alert alert-danger py-2" role="alert">
            {errorMessage}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {demoMode && (
        <section className="alert alert-warning mt-4 mb-0" aria-labelledby="demo-accounts-heading">
          <h2 id="demo-accounts-heading" className="h6">
            Demo accounts (offline demo mode only)
          </h2>
          <p className="mb-2">Any password works here, because nothing is checked against a real account.</p>
          <ul className="mb-0">
            {demoAccounts().map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  className="btn btn-link p-0 align-baseline"
                  onClick={() => {
                    setEmail(account.email)
                    setPassword('demo')
                  }}
                >
                  {account.email}
                </button>{' '}
                {account.name}, {account.status}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-3">
        New to CampusBid? <Link to="/register">Create an account</Link>
      </p>
    </AuthShell>
  )
}
