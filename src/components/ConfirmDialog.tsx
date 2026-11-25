import { useEffect, useRef, type ReactNode } from 'react'

export type ConfirmOptions = {
  title: string
  body: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

// The dialog itself; open it through useConfirm().
export default function ConfirmDialog({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    // Start on the safe choice.
    cancelRef.current?.focus()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className="cb-dialog"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onCancel={(event) => {
        event.preventDefault()
        onClose(false)
      }}
    >
      <h2 id="confirm-title" className="cb-dialog-title">{options.title}</h2>
      <div id="confirm-body" className="cb-dialog-body">{options.body}</div>
      <div className="cb-dialog-actions">
        <button ref={cancelRef} type="button" className="btn btn-outline-secondary" onClick={() => onClose(false)}>
          {options.cancelLabel ?? 'Go back'}
        </button>
        <button
          type="button"
          className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => onClose(true)}
        >
          {options.confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
