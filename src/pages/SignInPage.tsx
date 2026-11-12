import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { signIn } from '../lib/accounts'

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
    <main className="container py-4 form-narrow">
      <h1 className="h3">Sign in to CampusBid</h1>
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
          <p className="text-danger" role="alert">
            {errorMessage}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-3">
        New to CampusBid? <Link to="/register">Create an account</Link>
      </p>
    </main>
  )
}
