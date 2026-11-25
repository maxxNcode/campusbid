// Small shared pieces of the CampusBid look: wordmark, status badges, page
// headings, loading and empty states. Styles are in index.css.
import type { ReactNode } from 'react'
import { LISTING_STATUS_LABELS, type ListingStatus } from '../lib/listing-rules'
import { REQUEST_STATUS_LABELS, type RequestStatus } from '../lib/request-rules'

// A price tag drawn on a square, with the CampusBid name beside it.
export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg className="cb-brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" opacity="0.12" />
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 9.5h7.2c.5 0 1 .2 1.4.6l6 6c.8.8.8 2 0 2.8l-5.2 5.2c-.8.8-2 .8-2.8 0l-6-6c-.4-.4-.6-.9-.6-1.4V9.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12.6" cy="13" r="1.6" fill="currentColor" />
    </svg>
  )
}

export function Wordmark({ by = false }: { by?: boolean }) {
  return (
    <>
      <BrandMark />
      <span>
        CampusBid
        {by && <span className="cb-brand-by">by Ctrl+Alt Build</span>}
      </span>
    </>
  )
}

const LISTING_TONES: Record<ListingStatus, string> = {
  active: 'green',
  reserved: 'amber',
  sold: 'slate',
  withdrawn: 'stone',
}

const REQUEST_TONES: Record<RequestStatus, string> = {
  pending: 'amber',
  accepted: 'teal',
  declined: 'red',
  cancelled: 'stone',
  completed: 'green',
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <span className={`cb-badge cb-badge--${LISTING_TONES[status]}`}>{LISTING_STATUS_LABELS[status]}</span>
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <span className={`cb-badge cb-badge--${REQUEST_TONES[status]}`}>{REQUEST_STATUS_LABELS[status]}</span>
}

export function PageHeader({ title, children, actions }: { title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="cb-page-head d-flex flex-wrap align-items-end gap-3">
      <div className="me-auto">
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="d-flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return (
    <p className="cb-loading" role="status">
      <span className="spinner-border spinner-border-sm" aria-hidden="true" />
      {children}
    </p>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="cb-empty">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p className="alert alert-danger" role="alert">
      {children}
    </p>
  )
}
