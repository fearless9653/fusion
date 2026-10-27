/** Overlay sidebar layout: expanded width + large-screen stage inset. */

/** Tailwind `w-64` / expanded SidebarShell width in px. */
export const SIDEBAR_EXPANDED_WIDTH_PX = 256

/** Match Tailwind `lg` — stage insets apply at this width and above. */
export const SIDEBAR_INSET_MIN_WIDTH_PX = 1024

export const SIDEBAR_INSET_MEDIA_QUERY = `(min-width: ${SIDEBAR_INSET_MIN_WIDTH_PX}px)`

/**
 * Horizontal inset (px) for the stage content box given collapse flags and viewport.
 * Large screens inset by each *expanded* sidebar; small screens never inset (true overlay).
 */
export function stageSidebarInsetsPx(
  leftCollapsed: boolean,
  rightCollapsed: boolean,
  isLargeScreen: boolean,
): { paddingLeft: number; paddingRight: number } {
  if (!isLargeScreen) {
    return { paddingLeft: 0, paddingRight: 0 }
  }
  return {
    paddingLeft: leftCollapsed ? 0 : SIDEBAR_EXPANDED_WIDTH_PX,
    paddingRight: rightCollapsed ? 0 : SIDEBAR_EXPANDED_WIDTH_PX,
  }
}
