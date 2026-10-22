<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Globe, Monitor, Moon, Sun } from '@lucide/vue'
import {
  AppToast,
  MenuSelect,
  applyTheme,
  cycleTheme,
  normalizeLocale,
  persistLocale,
  readStoredTheme,
  type ThemeMode,
} from '@/shared/ui'

const { t, locale } = useI18n()

const theme = ref<ThemeMode>(readStoredTheme())
applyTheme(theme.value)

watchEffect(() => {
  const title = t('app.seoTitle')
  const description = t('app.description')
  document.title = title
  document.documentElement.lang = locale.value === 'en' ? 'en' : 'zh-CN'
  setMeta('description', description)
  setMeta('og:title', title, 'property')
  setMeta('og:description', description, 'property')
  setMeta('twitter:title', title)
  setMeta('twitter:description', description)
})

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name'): void {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, name)
    document.head.appendChild(el)
  }
  el.content = content
}

const themeLabel = computed(() => {
  if (theme.value === 'dark') return t('app.themeDark')
  if (theme.value === 'system') return t('app.themeSystem')
  return t('app.themeLight')
})

const localeOptions = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
]

const localeValue = computed({
  get: () => (locale.value === 'en' ? 'en' : 'zh-CN'),
  set: (v: string) => {
    const next = normalizeLocale(v)
    locale.value = next
    persistLocale(next)
  },
})

function onCycleTheme(): void {
  theme.value = cycleTheme(theme.value)
}
</script>

<template>
  <div class="flex h-dvh max-h-dvh flex-col overflow-hidden">
    <header class="z-50 shrink-0 border-b border-border bg-surface">
      <div class="flex items-center justify-between gap-4 px-4 py-2.5">
        <RouterLink
          to="/"
          class="inline-flex cursor-pointer items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          :title="t('app.title')"
          :aria-label="t('app.title')"
        >
          <img src="/favicon.svg" class="h-8 w-8 object-contain" :alt="t('app.title')" />
        </RouterLink>
        <div class="flex items-center gap-2">
          <MenuSelect
            v-model="localeValue"
            :options="localeOptions"
            :label="t('app.language')"
            align="end"
            trigger-class="w-[7.25rem]"
          >
            <template #icon>
              <Globe class="h-4 w-4" />
            </template>
          </MenuSelect>
          <button
            type="button"
            class="inline-flex h-8 w-8 min-h-8 items-center justify-center rounded-full bg-border-muted text-ink-muted hover:bg-border hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            :title="themeLabel"
            :aria-label="themeLabel"
            @click="onCycleTheme"
          >
            <Sun v-if="theme === 'light'" class="h-4 w-4" aria-hidden="true" />
            <Moon v-else-if="theme === 'dark'" class="h-4 w-4" aria-hidden="true" />
            <Monitor v-else class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
    <main class="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3">
      <RouterView />
    </main>
    <AppToast />
  </div>
</template>
