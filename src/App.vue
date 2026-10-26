<template>
  <div class="app-shell">
    <router-view v-slot="{ Component }">
      <keep-alive :include="['HomeView', 'SubwayMapView']">
        <component :is="Component" />
      </keep-alive>
    </router-view>

    <van-tabbar
      v-if="$route.meta.tab"
      route
      active-color="#2F6BFF"
      inactive-color="#9AA3AF"
      :border="true"
      safe-area-inset-bottom
    >
      <van-tabbar-item replace to="/" icon="wap-home-o">首页</van-tabbar-item>
      <van-tabbar-item replace to="/map" icon="map-marked">地铁图</van-tabbar-item>
    </van-tabbar>
  </div>
</template>

<script setup></script>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  background: var(--bg);
}
</style>
