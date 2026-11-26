import type { ReactNode } from 'react'

/** A pending "are you sure?" — the confirm card owns the wording, the caller the action. */
export interface Confirm {
  title: string
  body: ReactNode
  label: string
  /** Not a removal: a green car badge and a green button instead of the red trash. */
  calm?: boolean
  onConfirm: () => void
}
