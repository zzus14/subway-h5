<template>
  <div class="page-no-tab">
    <van-nav-bar
      :title="line ? line.name : '线路详情'"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    />

    <van-loading v-if="!line" color="#2F6BFF" style="padding: 60px 0; text-align: center" />

    <template v-else>
      <!-- 线路信息 -->
      <div class="card" style="margin-top: 12px">
        <div class="line-head">
          <span class="line-dot big" :style="{ background: line.color }"></span>
          <span class="line-title">{{ line.name }}</span>
          <van-tag :type="line.type === '地铁' ? 'primary' : 'warning'" size="medium">{{
            line.type
          }}</van-tag>
          <van-tag v-if="line.isNew" type="danger" size="medium" style="margin-left: 4px"
            >新线</van-tag
          >
        </div>
        <div v-if="line.openedAt" class="line-open">
          开通日期 {{ line.openedAt
          }}<span v-if="line.lengthKm"> · 全长 {{ line.lengthKm }} 公里</span>
        </div>
        <div class="line-meta-grid">
          <div class="meta-cell">
            <div class="meta-k">首末班</div>
            <div class="meta-v">{{ line.startTime }} - {{ line.endTime }}</div>
          </div>
          <div class="meta-cell">
            <div class="meta-k">票价</div>
            <div class="meta-v">{{ line.basicPrice }}-{{ line.totalPrice }}元</div>
          </div>
          <div class="meta-cell">
            <div class="meta-k">发车间隔</div>
            <div class="meta-v">{{ line.interval }}</div>
          </div>
          <div class="meta-cell">
            <div class="meta-k">途经站</div>
            <div class="meta-v">{{ line.busstops.length }} 站</div>
          </div>
        </div>
      </div>

      <!-- 方向切换 -->
      <div class="card">
        <div class="section-title" style="justify-content: space-between">
          <span style="display: flex; align-items: center; gap: 6px"
            ><span class="bar"></span>线路站点</span
          >
          <div class="dir-switch">
            <span class="dir-btn" :class="{ active: dirIndex === 0 }" @click="dirIndex = 0"
              >上行</span
            >
            <span class="dir-btn" :class="{ active: dirIndex === 1 }" @click="dirIndex = 1"
              >下行</span
            >
          </div>
        </div>
        <div class="dir-route">{{ dirIndex === 0 ? line.startStop : line.endStop }} 方向</div>
        <div class="stop-list">
          <div
            v-for="(st, i) in dirStops"
            :key="st.id + '-' + i"
            class="stop-node"
            @click="goStop(st)"
          >
            <div class="stop-rail">
              <span class="rail-line" :style="{ background: line.color }"></span>
              <span
                class="rail-dot"
                :style="{
                  background: i === 0 || i === dirStops.length - 1 ? line.color : 'var(--card)',
                  border: '2px solid ' + line.color
                }"
              ></span>
            </div>
            <div class="stop-name-cell">
              <span class="stop-name">{{ st.name }}</span>
              <van-tag v-if="i === 0" type="primary" size="mini" style="margin-left: 6px"
                >始发</van-tag
              >
              <van-tag
                v-else-if="i === dirStops.length - 1"
                type="danger"
                size="mini"
                style="margin-left: 6px"
                >终点</van-tag
              >
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../services/api'

const route = useRoute()
const router = useRouter()

const line = ref(null)
const dirIndex = ref(0)

const dirStops = computed(() => {
  if (!line.value) return []
  return dirIndex.value === 0 ? line.value.busstops : [...line.value.busstops].reverse()
})

function goStop(st) {
  router.push(`/stop/${st.id}`)
}

onMounted(async () => {
  line.value = await api.getLineById(route.params.id)
})
</script>

<style scoped>
.line-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.line-open {
  font-size: 12px;
  color: var(--placeholder);
  margin-bottom: 12px;
}
.line-dot.big {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}
.line-title {
  font-size: 20px;
  font-weight: 700;
}
.line-meta-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.meta-cell {
  background: var(--bg);
  border-radius: 10px;
  padding: 8px 6px;
  text-align: center;
}
.meta-k {
  font-size: 11px;
  color: var(--placeholder);
}
.meta-v {
  font-size: 13px;
  font-weight: 600;
  margin-top: 2px;
}
.dir-route {
  font-size: 13px;
  color: #2f6bff;
  font-weight: 600;
  padding: 8px 0 4px;
}
.dir-switch {
  display: flex;
  background: #f2f3f5;
  border-radius: 999px;
  padding: 2px;
}
.dir-btn {
  font-size: 13px;
  color: var(--text-2);
  padding: 4px 16px;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.2s;
}
.dir-btn.active {
  background: var(--card);
  color: #2f6bff;
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.stop-list {
  padding-top: 4px;
}
.stop-node {
  display: flex;
  align-items: center;
  cursor: pointer;
}
.stop-rail {
  position: relative;
  width: 22px;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rail-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
}
.rail-dot {
  position: relative;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  margin-top: 16px;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.stop-name-cell {
  flex: 1;
  padding: 12px 0 12px 10px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
}
.stop-list .stop-node:last-child .stop-name-cell {
  border-bottom: none;
}
.stop-name {
  font-size: 15px;
}
</style>
