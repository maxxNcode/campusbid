import type { ReactNode } from 'react'
import { SiteFooter } from './AppLayout'
import { Wordmark } from './ui'

// Layout for the signed-out pages and the pending page: a short, factual
// introduction beside the form card.
export default function AuthShell({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="cb-auth">
        <div className="cb-auth-inner">
          <section className="cb-auth-intro" aria-label="About CampusBid">
            <p className="cb-brand mb-3">
              <Wordmark by />
            </p>
            <h2 className="h4">Campus gear, from student to student.</h2>
            <p>
              Buy and sell calculators, reference books, drafting tools and project kits with other approved
              engineering and IT students.
            </p>
            <ul>
              <li>Every account is checked in person by a CampusBid admin before it can trade.</li>
              <li>Fixed prices in pesos, with the condition and known defects written out.</li>
              <li>You agree on a campus meetup; payment and handover happen in person.</li>
            </ul>
          </section>
          <div className="cb-card cb-auth-card">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
