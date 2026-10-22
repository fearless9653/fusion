import { afterEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, showToast, useToastState } from './toast'

describe('toast', () => {
  afterEach(() => {
    dismissToast()
    vi.useRealTimers()
  })

  it('shows and auto-dismisses', () => {
    vi.useFakeTimers()
    const { toast } = useToastState()
    showToast('hello', 'success', 1000)
    expect(toast.value?.message).toBe('hello')
    expect(toast.value?.kind).toBe('success')
    vi.advanceTimersByTime(1000)
    expect(toast.value).toBeNull()
  })
})
