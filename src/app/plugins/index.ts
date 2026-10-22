import type { App } from 'vue'
import { createPinia } from 'pinia'
import { i18n } from '@/app/plugins/i18n'
import { router } from '@/app/router'

export function setupPlugins(app: App): void {
  app.use(createPinia())
  app.use(router)
  app.use(i18n)
}
