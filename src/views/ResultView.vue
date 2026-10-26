<template>
  <div class="page-no-tab">
    <van-nav-bar title="路线方案" left-arrow fixed placeholder @click-left="$router.back()">
      <template #right>
        <van-icon name="edit" size="18" color="#fff" @click="edit" />
      </template>
    </van-nav-bar>

    <!-- 起终点摘要 -->
    <div class="card od-card">
      <div class="od-row">
        <span class="od-dot from"></span>
        <span class="od-name">{{ fromName || '起点' }}</span>
      </div>
      <div class="od-line"></div>
      <div class="od-row">
        <span class="od-dot to"></span>
        <span class="od-name">{{ toName || '终点' }}</span>
      </div>
    </div>

    <!-- 排序策略 -->
    <div class="mode-bar">
      <div
        v-for="m in modes"
        :key="m.key"
        class="mode-tab"
        :class="{ active: activeMode === m.key }"
        @click="switchMode(m.key)"
      >
        {{ m.label }}
      </div>
    </div>

    <div v-if="loading" style="padding: 50px 0; text-align: center">
      <van-loading color="#2F6BFF" size="24">正在计算最优路线…</van-loading>
    </div>

    <div v-else-if="error" class="card err-card">
      <van-icon name="warning-o" size="28" color="#E23D2E" />
      <div class="err-title">查询失败</div>
      <div class="err-msg">{{ error }}</div>
      <div class="err-actions">
        <van-button size="small" round plain color="#2F6BFF" @click="load">重试</van-button>
        <van-button size="small" round color="#2F6BFF" @click="edit">修改起终点</van-button>
      </div>
    </div>

    <template v-else>
      <div
        v-if="!plans.length"
        class="card"
        style="padding: 30px 14px; text-align: center; color: var(--text-2)"
      >
        暂无可用方案，请调整起终点后重试
      </div>

      <div
        v-for="(plan, index) in plans"
        :key="plan.planId"
        class="card plan-card"
        @click="openDetail(plan)"
      >
        <div class="plan-head">
          <span class="plan-index">方案 {{ index + 1 }}</span>
          <span v-for="tag in tagsOf(plan)" :key="tag" class="plan-tag">{{ tag }}</span>
          <span class="plan-more">详情 <van-icon name="arrow" size="12" /></span>
        </div>

        <div class="plan-main">
          <div>
            <span class="duration-num">{{ plan.duration }}</span>
            <span class="duration-unit">分钟</span>
          </div>
          <div class="metrics">
            <span>{{ plan.stops }} 站</span>
            <span class="sep">·</span>
            <span>{{ plan.transfers ? `${plan.transfers} 次换乘` : '无需换乘' }}</span>
            <span class="sep">·</span>
            <span>步行 {{ plan.walkDistance }} 米</span>
          </div>
        </div>

        <!-- 分段色条 -->
        <div class="segments">
          <div
            v-for="(seg, i) in plan.segments"
            :key="i"
            class="segment"
            :style="{ flex: Math.max(1, seg.stopCount) }"
          >
            <span class="seg-chip" :style="{ background: seg.lineColor }">{{ seg.lineName }}</span>
            <span class="seg-bar" :style="{ background: seg.lineColor }"></span>
            <span v-if="i < plan.segments.length - 1" class="seg-transfer">换</span>
          </div>
        </div>

        <div class="plan-foot">
          <span class="strategy">{{ plan.strategy }}</span>
          <span class="foot-stops">{{ stopSummary(plan) }}</span>
        </div>
      </div>

      <div class="hint">数据：长春轨道交通真实线路 · 算法：Dijkstra（站点×线路状态图）</div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPlans, MODE_OPTIONS } from '../services/api'

const route = useRoute()
const router = useRouter()

const modes = MODE_OPTIONS
const activeMode = ref('recommended')
const plans = ref([])
const loading = ref(false)
const error = ref('')
const fromName = ref('')
const toName = ref('')

const from = computed(() => String(route.query.from || ''))
const to = computed(() => String(route.query.to || ''))

async function load() {
  if (!from.value || !to.value) {
    error.value = '缺少起终点参数，请返回重新选择'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await getPlans({ from: from.value, to: to.value, mode: activeMode.value })
    plans.value = data.plans || []
    fromName.value = data.fromName || ''
    toName.value = data.toName || ''
  } catch (e) {
    plans.value = []
    error.value = e.message || '查询失败'
  } finally {
    loading.value = false
  }
}

function tagsOf(plan) {
  const list = []
  if (plans.value.length > 1) {
    const minDuration = Math.min(...plans.value.map((p) => p.duration))
    const minTransfer = Math.min(...plans.value.map((p) => p.transfers))
    const minWalk = Math.min(...plans.value.map((p) => p.walkDistance))
    if (plan.duration === minDuration) list.push('最省时')
    if (plan.transfers === minTransfer && minTransfer < 9) list.push('少换乘')
    if (plan.walkDistance === minWalk) list.push('少步行')
  } else {
    list.push('最佳')
  }
  return list.slice(0, 2)
}

function stopSummary(plan) {
  const first = plan.segments[0]
  const last = plan.segments[plan.segments.length - 1]
  if (!first || !last) return ''
  return `${first.fromName} → ${last.toName}`
}

function openDetail(plan) {
  router.push({
    path: '/route-detail',
    query: {
      from: from.value,
      to: to.value,
      mode: activeMode.value,
      plan: plan.planId
    }
  })
}

/** 切换排序：同步更新地址栏，刷新/分享后仍能保持同一口径 */
function switchMode(name) {
  if (name === activeMode.value) return
  activeMode.value = name
  router.replace({ path: '/result', query: { ...route.query, mode: name } })
  load()
}

function edit() {
  router.replace({
    path: '/plan',
    query: { from: from.value, to: to.value, mode: activeMode.value }
  })
}

onMounted(() => {
  const m = String(route.query.mode || '')
  if (modes.some((x) => x.key === m)) activeMode.value = m
  load()
})

watch(
  () => [route.query.from, route.query.to],
  () => load()
)
</script>

<style scoped>
.od-card {
  padding: 14px 16px;
}
.od-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.od-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.od-dot.from {
  background: #2f6bff;
}
.od-dot.to {
  background: #ff6b35;
}
.od-line {
  width: 1px;
  height: 14px;
  background: var(--border);
  margin-left: 3.5px;
}
.od-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.mode-bar {
  display: flex;
  background: var(--card);
  margin: 12px 12px 0;
  border-radius: 10px;
  padding: 3px;
}
.mode-tab {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: var(--text-2);
  padding: 8px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-tab.active {
  background: var(--primary-light);
  color: #2f6bff;
  font-weight: 600;
}
.plan-card {
  cursor: pointer;
}
.plan-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.plan-index {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.plan-tag {
  font-size: 11px;
  color: #2f6bff;
  background: var(--primary-light);
  border-radius: 4px;
  padding: 1px 6px;
}
.plan-more {
  margin-left: auto;
  font-size: 12px;
  color: var(--placeholder);
  display: flex;
  align-items: center;
}
.plan-main {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 10px 0 4px;
}
.duration-num {
  font-size: 30px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
}
.duration-unit {
  font-size: 13px;
  color: var(--text-2);
  margin-left: 2px;
}
.metrics {
  font-size: 13px;
  color: var(--text-2);
}
.metrics .sep {
  margin: 0 4px;
  color: var(--icon-muted);
}
.segments {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 12px 0 10px;
}
.segment {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.seg-chip {
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
  flex-shrink: 0;
}
.seg-bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  min-width: 12px;
}
.seg-transfer {
  font-size: 10px;
  color: #ed6a0c;
  border: 1px solid #ffd3a8;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin: 0 2px;
}
.plan-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-top: 1px dashed var(--border);
  padding-top: 9px;
}
.strategy {
  font-size: 12px;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.foot-stops {
  font-size: 12px;
  color: var(--placeholder);
  flex-shrink: 0;
}
.hint {
  text-align: center;
  font-size: 11px;
  color: var(--placeholder);
  padding: 16px 14px 24px;
}
.err-card {
  text-align: center;
  padding: 26px 16px;
}
.err-title {
  font-size: 16px;
  font-weight: 600;
  margin-top: 8px;
}
.err-msg {
  font-size: 13px;
  color: var(--text-2);
  margin: 8px 0 16px;
  word-break: break-all;
}
.err-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
