<template>
  <div class="page-no-tab">
    <van-nav-bar title="路线详情" left-arrow fixed placeholder @click-left="$router.back()" />

    <div v-if="loading" style="padding: 60px 0; text-align: center">
      <van-loading color="#2F6BFF" size="24">加载方案详情…</van-loading>
    </div>

    <div v-else-if="error" class="card" style="padding: 30px 16px; text-align: center">
      <van-icon name="warning-o" size="26" color="#E23D2E" />
      <div style="margin: 10px 0 4px; font-weight: 600">无法加载方案</div>
      <div style="font-size: 13px; color: var(--text-2); word-break: break-all">{{ error }}</div>
      <van-button
        size="small"
        round
        plain
        color="#2F6BFF"
        style="margin-top: 14px"
        @click="$router.back()"
      >
        返回方案列表
      </van-button>
    </div>

    <template v-else-if="plan">
      <!-- 汇总 -->
      <div class="card summary">
        <div class="summary-top">
          <span class="summary-duration">{{ plan.duration }}<i>分钟</i></span>
          <span class="summary-metrics">
            {{ plan.stops }} 站 · {{ plan.transfers ? `${plan.transfers} 次换乘` : '无需换乘' }} ·
            步行 {{ plan.walkDistance }} 米
          </span>
        </div>
        <div class="route-line">
          <span
            class="line-chip"
            v-for="(seg, i) in plan.segments"
            :key="i"
            :style="{ background: seg.lineColor }"
          >
            {{ seg.lineName }}
          </span>
        </div>
        <div class="summary-strategy">策略：{{ plan.strategy }}</div>
      </div>

      <!-- 分段详情 -->
      <div class="card">
        <div class="section-title"><span class="bar"></span>乘车指引</div>

        <div class="timeline">
          <template v-for="(seg, i) in plan.segments" :key="i">
            <!-- 上车站（换乘站的"上车"与上一段"下车"是同一站，避免重复展示） -->
            <div v-if="i === 0 || seg.fromName !== plan.segments[i - 1].toName" class="node">
              <span class="node-dot" :style="{ background: seg.lineColor }"></span>
              <div class="node-main">
                <div class="node-name">{{ seg.fromName }}</div>
                <div class="node-sub">上车</div>
              </div>
            </div>

            <!-- 乘车段 -->
            <div class="ride">
              <span class="ride-bar" :style="{ background: seg.lineColor }"></span>
              <div class="ride-main">
                <span class="line-chip" :style="{ background: seg.lineColor }">{{
                  seg.lineName
                }}</span>
                <span class="ride-text">{{ seg.direction }}</span>
                <span class="ride-meta"
                  >乘 {{ seg.stopCount }} 站 · 约 {{ seg.duration }} 分钟</span
                >
              </div>
            </div>

            <!-- 下车站（若与上一段终点同名，说明是换乘站，只在上一段末尾展示一次） -->
            <div class="node">
              <span class="node-dot" :style="{ background: seg.lineColor }"></span>
              <div class="node-main">
                <div class="node-name">{{ seg.toName }}</div>
                <div class="node-sub">
                  {{ i < plan.segments.length - 1 ? '下车换乘' : '到达终点' }}
                </div>
              </div>
            </div>

            <!-- 换乘指引 -->
            <div v-if="transferAfter(i)" class="transfer">
              <van-icon name="exchange" size="14" color="#ED6A0C" />
              <span class="transfer-text">
                站内换乘 · 步行约 {{ transferAfter(i).walkDistance }} 米
              </span>
              <span class="transfer-lines">
                <span class="line-chip" :style="{ background: transferAfter(i).fromLineColor }">{{
                  transferAfter(i).fromLineName
                }}</span>
                <van-icon name="arrow" size="11" color="var(--icon-muted)" />
                <span class="line-chip" :style="{ background: transferAfter(i).toLineColor }">{{
                  transferAfter(i).toLineName
                }}</span>
              </span>
            </div>
          </template>
        </div>
      </div>

      <!-- 途经站点 -->
      <div class="card">
        <div class="section-title">
          <span class="bar"></span>途经站点
          <span class="section-more">{{ plan.stations.length }} 站</span>
        </div>
        <div class="stations">
          <div v-for="(st, i) in visibleStations" :key="st.id" class="station-row">
            <span class="station-index" :class="{ transfer: st.transfer }">{{ i + 1 }}</span>
            <span class="station-name">{{ st.name }}</span>
            <span v-if="st.transfer" class="station-tag">换乘</span>
          </div>
        </div>
        <div class="expand" @click="expanded = !expanded">
          {{ expanded ? '收起' : `展开全部 ${plan.stations.length} 站` }}
          <van-icon :name="expanded ? 'arrow-up' : 'arrow-down'" size="12" />
        </div>
      </div>

      <div class="hint">首末班车与到站时间为模拟数据，出行请以车站公告为准</div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getPlans } from '../services/api'

const route = useRoute()

const plan = ref(null)
const loading = ref(true)
const error = ref('')
const expanded = ref(false)

/** 换乘站信息按"换乘站 id"索引，便于在时间轴里插到正确的分段后面 */
const transferMap = computed(() => {
  const map = {}
  for (const t of (plan.value && plan.value.transferDetails) || []) {
    map[t.stationId] = t
  }
  return map
})

/** 换乘标记：分段下车的车站若正好是换乘站，就展示换乘卡片 */
function transferAfter(index) {
  const seg = plan.value.segments[index]
  if (!seg) return null
  const t = transferMap.value[seg.toId]
  return t || null
}

/** 途经站点：合并方案站序与换乘标记 */
const visibleStations = computed(() => {
  if (!plan.value) return []
  const transferIds = new Set((plan.value.transferDetails || []).map((t) => t.stationId))
  const list = plan.value.stations.map((st) => ({ ...st, transfer: transferIds.has(st.id) }))
  return expanded.value ? list : list.slice(0, 6)
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await getPlans({
      from: String(route.query.from || ''),
      to: String(route.query.to || ''),
      mode: String(route.query.mode || 'recommended')
    })
    const planId = String(route.query.plan || '')
    plan.value =
      (data.plans || []).find((p) => p.planId === planId) || (data.plans || [])[0] || null
    if (!plan.value) error.value = '未找到该方案，可能线路数据已更新'
  } catch (e) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.summary-top {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.summary-duration {
  font-size: 28px;
  font-weight: 700;
  color: var(--text);
}
.summary-duration i {
  font-size: 13px;
  font-style: normal;
  color: var(--text-2);
  margin-left: 3px;
}
.summary-metrics {
  font-size: 13px;
  color: var(--text-2);
}
.route-line {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 10px;
}
.line-chip {
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  padding: 1px 7px;
  white-space: nowrap;
}
.summary-strategy {
  margin-top: 8px;
  font-size: 12px;
  color: var(--placeholder);
}
.timeline {
  padding-top: 6px;
}
.node {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.node-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--card);
  box-shadow: 0 0 0 2px currentColor;
  margin-top: 5px;
  margin-left: 3px;
  flex-shrink: 0;
  color: var(--border);
}
.node-main {
  flex: 1;
  padding-bottom: 2px;
}
.node-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.node-sub {
  font-size: 11px;
  color: var(--placeholder);
  margin-top: 2px;
}
.ride {
  display: flex;
  gap: 10px;
  padding: 6px 0 6px 7px;
}
.ride-bar {
  width: 4px;
  border-radius: 2px;
  min-height: 46px;
  margin-left: 3px;
}
.ride-main {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  background: var(--bg);
  border-radius: 8px;
  padding: 8px 10px;
}
.ride-text {
  font-size: 12px;
  color: var(--text-2);
}
.ride-meta {
  font-size: 12px;
  color: var(--placeholder);
  margin-left: auto;
}
.transfer {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 0 10px 20px;
  padding: 8px 10px;
  background: #fff7ed;
  border: 1px dashed #ffd3a8;
  border-radius: 8px;
  flex-wrap: wrap;
}
.transfer-text {
  font-size: 12px;
  color: #b45309;
}
.transfer-lines {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}
.stations {
  padding-top: 6px;
  overflow: hidden;
}
.station-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px dashed var(--border);
}
.station-row:last-child {
  border-bottom: none;
}
.station-index {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--bg);
  color: var(--text-2);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.station-index.transfer {
  background: #fff1e6;
  color: #ed6a0c;
}
.station-name {
  font-size: 14px;
  color: var(--text);
  flex: 1;
}
.station-tag {
  font-size: 11px;
  color: #ed6a0c;
}
.expand {
  text-align: center;
  font-size: 12px;
  color: #2f6bff;
  padding-top: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.hint {
  text-align: center;
  font-size: 11px;
  color: var(--placeholder);
  padding: 16px 14px 24px;
}
</style>
