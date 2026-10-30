import { describe, expect, it } from 'vitest'
import { stageSidebarInsetsPx } from './sidebarOverlayLayout'

describe('stageSidebarInsetsPx', () => {
  it('insets both sides when large and both expanded', () => {
    expect(stageSidebarInsetsPx(false, false, true)).toEqual({
      paddingLeft: 256,
      paddingRight: 256,
    })
  })

  it('removes inset on collapsed sides (large screen)', () => {
    expect(stageSidebarInsetsPx(true, false, true)).toEqual({
      paddingLeft: 0,
      paddingRight: 256,
    })
    expect(stageSidebarInsetsPx(false, true, true)).toEqual({
      paddingLeft: 256,
      paddingRight: 0,
    })
    expect(stageSidebarInsetsPx(true, true, true)).toEqual({
      paddingLeft: 0,
      paddingRight: 0,
    })
  })

  it('never insets on small screens', () => {
    expect(stageSidebarInsetsPx(false, false, false)).toEqual({
      paddingLeft: 0,
      paddingRight: 0,
    })
    expect(stageSidebarInsetsPx(true, true, false)).toEqual({
      paddingLeft: 0,
      paddingRight: 0,
    })
  })
})
