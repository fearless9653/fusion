import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'collage',
      component: () => import('@/pages/CollagePage.vue'),
    },
    {
      path: '/custom-layout',
      name: 'custom-layout',
      component: () => import('@/pages/CustomLayoutPage.vue'),
    },
  ],
})
