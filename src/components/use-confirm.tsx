import { useCallback, useState, type ReactNode } from 'react'
import ConfirmDialog, { type ConfirmOptions } from './ConfirmDialog'

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

// A modal "are you sure?" step for actions that cannot be undone. Built on the
// native <dialog> element, so focus stays inside it and Escape closes it.
// Usage: const [confirm, dialog] = useConfirm(); render {dialog}; then
// `if (await confirm({...})) doIt()`.
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  )

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok)
      setPending(null)
    },
    [pending],
  )

  return [confirm, pending ? <ConfirmDialog key={pending.title} options={pending} onClose={close} /> : null]
}

