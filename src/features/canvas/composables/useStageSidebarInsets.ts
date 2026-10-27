import { computed, onMounted, onUnmounted, ref, toValue, type MaybeRefOrGetter } from 'vue'
import {
  SIDEBAR_INSET_MEDIA_QUERY,
  stageSidebarInsetsPx,
} from '@/features/canvas/sidebarOverlayLayout'

/**
 * Shared overlay-sidebar stage insets for CollagePage + CustomLayoutPage.
 * ≥1024px: padding matches each expanded sidebar width; collapsing removes that side's inset.
 * <1024px: no inset (sidebars cover the full-bleed stage).
 */
export function useStageSidebarInsets(
  leftCollapsed: MaybeRefOrGetter<boolean>,
  rightCollapsed: MaybeRefOrGetter<boolean>,
) {
  const isLargeScreen = ref(
    typeof window !== 'undefined' ? window.matchMedia(SIDEBAR_INSET_MEDIA_QUERY).matches : true,
  )

  let mql: MediaQueryList | null = null

  function onMqlChange(event: MediaQueryListEvent): void {
    isLargeScreen.value = event.matches
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    mql = window.matchMedia(SIDEBAR_INSET_MEDIA_QUERY)
    isLargeScreen.value = mql.matches
    mql.addEventListener('change', onMqlChange)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', onMqlChange)
    mql = null
  })

  const stageInsetStyle = computed(() => {
    const { paddingLeft, paddingRight } = stageSidebarInsetsPx(
      toValue(leftCollapsed),
      toValue(rightCollapsed),
      isLargeScreen.value,
    )
    return {
      paddingLeft: `${paddingLeft}px`,
      paddingRight: `${paddingRight}px`,
    }
  })

  return { isLargeScreen, stageInsetStyle }
}
