/**
 * Simple undo/redo stack of serializable snapshots.
 * Caller owns cloning; this store keeps references only.
 */
export type HistoryStack<T> = {
  past: T[]
  present: T
  future: T[]
  limit: number
}

export function createHistoryStack<T>(present: T, limit = 50): HistoryStack<T> {
  return {
    past: [],
    present,
    future: [],
    limit: Math.max(1, limit),
  }
}

/** Push a new present; clears redo branch. */
export function pushHistory<T>(stack: HistoryStack<T>, next: T): HistoryStack<T> {
  const past = [...stack.past, stack.present]
  while (past.length > stack.limit) {
    past.shift()
  }
  return {
    past,
    present: next,
    future: [],
    limit: stack.limit,
  }
}

export function undoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.past.length === 0) return stack
  const past = [...stack.past]
  const previous = past.pop()!
  return {
    past,
    present: previous,
    future: [stack.present, ...stack.future],
    limit: stack.limit,
  }
}

export function redoHistory<T>(stack: HistoryStack<T>): HistoryStack<T> {
  if (stack.future.length === 0) return stack
  const [next, ...rest] = stack.future
  return {
    past: [...stack.past, stack.present],
    present: next!,
    future: rest,
    limit: stack.limit,
  }
}

export function canUndo<T>(stack: HistoryStack<T>): boolean {
  return stack.past.length > 0
}

export function canRedo<T>(stack: HistoryStack<T>): boolean {
  return stack.future.length > 0
}
