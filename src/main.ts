import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from '@/app/App.vue'
import { setupPlugins } from '@/app/plugins'
import '@/app/styles/main.css'

registerSW({ immediate: true })

const app = createApp(App)
setupPlugins(app)
app.mount('#app')
