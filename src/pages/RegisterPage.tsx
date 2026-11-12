import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { registerAccount } from '../lib/accounts'
import { PROGRAMS, YEAR_LEVELS } from '../lib/programs'

const MIN_PASSWORD_LENGTH = 8

type FormErrors = Partial<Record<'fullName' | 'email' | 'password' | 'program' | 'yearLevel', string>>

export default function RegisterPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [program, setProgram] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({})
  const [errorMessage, setErrorMessage] = useState('')
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  function validate(): FormErrors {
    const errors: FormErrors = {}
    if (fullName.trim().length < 2) errors.fullName = 'Enter your full name.'
    if (!email.includes('@')) errors.email = 'Enter a valid email address.'
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = 'This password is too short.'
    }
    if (!program) errors.program = 'Choose your program.'
    if (!yearLevel) errors.yearLevel = 'Choose your year level.'
    return errors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const result = await registerAccount({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        program,
        yearLevel: Number(yearLevel),
      })
      if (result.session) {
        navigate('/', { replace: true })
      } else {
        // Only happens if email confirmation is switched on in Supabase.
        setConfirmationSent(true)
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error && /already registered/i.test(error.message)
          ? 'An account with this email already exists. Sign in instead.'
          : 'Registration failed. Check your details and try again.',
      )
    }
    setSubmitting(false)
  }

  if (confirmationSent) {
    return (
      <main className="container py-4 form-narrow">
        <h1 className="h3">Check your email</h1>
        <p>Open the confirmation link we sent to {email.trim()}, then sign in.</p>
        <Link to="/sign-in">Go to sign in</Link>
      </main>
    )
  }

  return (
    <main className="container py-4 form-narrow">
      <h1 className="h3">Create a CampusBid account</h1>
      <p>
        New accounts start as pending. An admin confirms your student status in person before you
        can browse or trade.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label htmlFor="register-name" className="form-label">
            Full name
          </label>
          <input
            id="register-name"
            className={`form-control${fieldErrors.fullName ? ' is-invalid' : ''}`}
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            aria-describedby="register-name-error"
          />
          <div id="register-name-error" className="invalid-feedback">
            {fieldErrors.fullName}
          </div>
        </div>
        <div className="mb-3">
          <label htmlFor="register-email" className="form-label">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            className={`form-control${fieldErrors.email ? ' is-invalid' : ''}`}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-describedby="register-email-error"
          />
          <div id="register-email-error" className="invalid-feedback">
            {fieldErrors.email}
          </div>
        </div>
        <div className="mb-3">
          <label htmlFor="register-password" className="form-label">
            Password
          </label>
          <input
            id="register-password"
            type="password"
            className={`form-control${fieldErrors.password ? ' is-invalid' : ''}`}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="register-password-help register-password-error"
          />
          <div id="register-password-help" className="form-text">
            At least {MIN_PASSWORD_LENGTH} characters.
          </div>
          <div id="register-password-error" className="invalid-feedback">
            {fieldErrors.password}
          </div>
        </div>
        <div className="mb-3">
          <label htmlFor="register-program" className="form-label">
            Program
          </label>
          <select
            id="register-program"
            className={`form-select${fieldErrors.program ? ' is-invalid' : ''}`}
            value={program}
            onChange={(event) => setProgram(event.target.value)}
            aria-describedby="register-program-error"
          >
            <option value="">Choose a program</option>
            {PROGRAMS.map((programName) => (
              <option key={programName} value={programName}>
                {programName}
              </option>
            ))}
          </select>
          <div id="register-program-error" className="invalid-feedback">
            {fieldErrors.program}
          </div>
        </div>
        <div className="mb-3">
          <label htmlFor="register-year" className="form-label">
            Year level
          </label>
          <select
            id="register-year"
            className={`form-select${fieldErrors.yearLevel ? ' is-invalid' : ''}`}
            value={yearLevel}
            onChange={(event) => setYearLevel(event.target.value)}
            aria-describedby="register-year-error"
          >
            <option value="">Choose a year level</option>
            {YEAR_LEVELS.map((level) => (
              <option key={level} value={level}>
                Year {level}
              </option>
            ))}
          </select>
          <div id="register-year-error" className="invalid-feedback">
            {fieldErrors.yearLevel}
          </div>
        </div>
        {errorMessage && (
          <p className="text-danger" role="alert">
            {errorMessage}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-3">
        Already registered? <Link to="/sign-in">Sign in</Link>
      </p>
    </main>
  )
}
