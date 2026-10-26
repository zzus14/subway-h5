import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { tab: true }
  },
  {
    path: '/map',
    name: 'map',
    component: () => import('../views/SubwayMapView.vue'),
    meta: { tab: true }
  },
  { path: '/search', name: 'search', component: () => import('../views/SearchView.vue') },
  { path: '/plan', name: 'plan', component: () => import('../views/PlanView.vue') },
  { path: '/result', name: 'result', component: () => import('../views/ResultView.vue') },
  {
    path: '/route-detail',
    name: 'route-detail',
    component: () => import('../views/RouteDetailView.vue')
  },
  {
    path: '/stop/:id',
    name: 'stop-detail',
    component: () => import('../views/StopDetailView.vue')
  },
  {
    path: '/line/:id',
    name: 'line-detail',
    component: () => import('../views/LineDetailView.vue')
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
