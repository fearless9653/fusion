import { readonly, ref } from 'vue'

export type ToastKind = 'info' | 'success' | 'error'

type ToastState = {
  message: string
  kind: ToastKind
}

const current = ref<ToastState | null>(null)
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

/** Lightweight global toast (no third-party deps). */
export function showToast(message: string, kind: ToastKind = 'info', durationMs = 2800): void {
  const text = message.trim()
  if (!text) return
  clearTimer()
  current.value = { message: text, kind }
  timer = setTimeout(
    () => {
      current.value = null
      timer = null
    },
    Math.max(800, durationMs),
  )
}

export function dismissToast(): void {
  clearTimer()
  current.value = null
}

export function useToastState() {
  return {
    toast: readonly(current),
    showToast,
    dismissToast,
  }
}
