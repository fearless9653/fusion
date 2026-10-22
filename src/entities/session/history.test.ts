import { describe, expect, it } from 'vitest'
import {
  canRedo,
  canUndo,
  createHistoryStack,
  pushHistory,
  redoHistory,
  undoHistory,
} from './history'

describe('history stack', () => {
  it('undoes and redoes snapshots', () => {
    let stack = createHistoryStack({ n: 0 }, 10)
    stack = pushHistory(stack, { n: 1 })
    stack = pushHistory(stack, { n: 2 })
    expect(stack.present).toEqual({ n: 2 })
    expect(canUndo(stack)).toBe(true)

    stack = undoHistory(stack)
    expect(stack.present).toEqual({ n: 1 })
    expect(canRedo(stack)).toBe(true)

    stack = redoHistory(stack)
    expect(stack.present).toEqual({ n: 2 })
  })

  it('clears future on push and respects limit', () => {
    let stack = createHistoryStack(0, 2)
    stack = pushHistory(stack, 1)
    stack = pushHistory(stack, 2)
    stack = undoHistory(stack)
    stack = pushHistory(stack, 9)
    expect(stack.future).toEqual([])
    expect(stack.present).toBe(9)
    // limit 2 past entries max
    stack = pushHistory(stack, 10)
    stack = pushHistory(stack, 11)
    expect(stack.past.length).toBeLessThanOrEqual(2)
  })
})
