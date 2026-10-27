import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from '@/app/App.vue'
import { setupPlugins } from '@/app/plugins'
import { logRepoInfo } from '@/app/repoInfo'
import '@/app/styles/main.css'

/** How often to ask the browser to re-check for a new service worker (ms). */
const SW_UPDATE_INTERVAL_MS = 60 * 60 * 1000

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const checkForUpdate = (): void => {
      void registration.update()
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate()
    })

    window.setInterval(checkForUpdate, SW_UPDATE_INTERVAL_MS)
  },
})
logRepoInfo()

const app = createApp(App)
setupPlugins(app)
app.mount('#app')
