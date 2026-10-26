<template>
  <div class="page-no-tab">
    <van-nav-bar title="路线规划" left-arrow fixed placeholder @click-left="$router.back()" />

    <div class="card plan-card">
      <div class="endpoint">
        <span class="dot dot-from">起</span>
        <div class="endpoint-main" @click="openPicker('from')">
          <div class="endpoint-label">起点</div>
          <div class="endpoint-value" :class="{ empty: !fromStation }">
            {{ fromStation ? fromStation.name : '请选择起点' }}
          </div>
        </div>
        <van-icon name="arrow" color="var(--icon-muted)" />
      </div>

      <div class="swap-row">
        <span class="divider"></span>
        <van-button class="swap-btn" size="mini" round plain icon="exchange" @click="swap" />
      </div>

      <div class="endpoint">
        <span class="dot dot-to">终</span>
        <div class="endpoint-main" @click="openPicker('to')">
          <div class="endpoint-label">终点</div>
          <div class="endpoint-value" :class="{ empty: !toStation }">
            {{ toStation ? toStation.name : '请选择终点' }}
          </div>
        </div>
        <van-icon name="arrow" color="var(--icon-muted)" />
      </div>
    </div>

    <div class="card">
      <div class="section-title"><span class="bar"></span>出行偏好</div>
      <div class="modes">
        <div
          v-for="m in modes"
          :key="m.key"
          class="mode-item"
          :class="{ active: mode === m.key }"
          @click="mode = m.key"
        >
          <div class="mode-label">{{ m.label }}</div>
          <div class="mode-desc">{{ m.desc }}</div>
        </div>
      </div>
    </div>

    <div class="submit-wrap">
      <van-button type="primary" round block color="#2F6BFF" :loading="submitting" @click="submit">
        查询路线
      </van-button>
      <div v-if="tip" class="tip">{{ tip }}</div>
    </div>

    <StationPicker v-model:show="pickerVisible" :title="pickerTitle" @select="onPick" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import StationPicker from '../components/StationPicker.vue'
import { api, MODE_OPTIONS } from '../services/api'

const route = useRoute()
const router = useRouter()

const modes = MODE_OPTIONS
const fromStation = ref(null)
const toStation = ref(null)
const mode = ref('recommended')
const pickerVisible = ref(false)
const pickerTarget = ref('from')
const submitting = ref(false)
const tip = ref('')

const pickerTitle = computed(() => (pickerTarget.value === 'from' ? '选择起点' : '选择终点'))

function openPicker(target) {
  pickerTarget.value = target
  pickerVisible.value = true
}

function onPick(station) {
  if (pickerTarget.value === 'from') fromStation.value = station
  else toStation.value = station
  tip.value = ''
}

function swap() {
  const temp = fromStation.value
  fromStation.value = toStation.value
  toStation.value = temp
}

async function submit() {
  if (!fromStation.value || !toStation.value) {
    tip.value = '请先选择起点和终点'
    return
  }
  if (fromStation.value.id === toStation.value.id) {
    tip.value = '起点和终点不能相同'
    return
  }
  submitting.value = true
  try {
    router.push({
      path: '/result',
      query: { from: fromStation.value.id, to: toStation.value.id, mode: mode.value }
    })
  } finally {
    submitting.value = false
  }
}

// 从其它页面带参数进入时预填（站点详情页的"到这里去 / 从这里出发"） 
onMounted(async () => {
  const { from, to, mode: m } = route.query
  if (m && modes.some((x) => x.key === m)) mode.value = m
  try {
    if (from) fromStation.value = await api.getStopById(String(from))
    if (to) toStation.value = await api.getStopById(String(to))
    if (!fromStation.value && toStation.value) {
      showToast('已选择终点，请选择起点')
    }
  } catch (e) {
    // 站点不存在时静默，用户重新选择即可
  }
})
</script>

<style scoped>
.plan-card {
  padding: 8px 14px;
}
.endpoint {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
}
.endpoint-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.endpoint-label {
  font-size: 12px;
  color: var(--placeholder);
}
.endpoint-value {
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  margin-top: 2px;
}
.endpoint-value.empty {
  color: var(--placeholder);
  font-weight: 400;
}
.dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dot-from {
  background: #2f6bff;
}
.dot-to {
  background: #ff6b35;
}
.swap-row {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}
.divider {
  position: absolute;
  left: 38px;
  right: 0;
  height: 1px;
  background: var(--border);
}
.swap-btn {
  position: relative;
  z-index: 1;
  background: var(--card);
}
.modes {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.mode-item {
  flex: 1;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 4px;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-item.active {
  border-color: #2f6bff;
  background: var(--primary-light);
}
.mode-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.mode-item.active .mode-label {
  color: #2f6bff;
}
.mode-desc {
  font-size: 11px;
  color: var(--placeholder);
  margin-top: 3px;
}
.submit-wrap {
  padding: 18px 14px 24px;
}
.tip {
  text-align: center;
  font-size: 12px;
  color: #e23d2e;
  margin-top: 10px;
}
</style>
