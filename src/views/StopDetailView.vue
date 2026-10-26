<template>
  <div class="page-no-tab">
    <van-nav-bar
      :title="stop ? stop.name : '站点详情'"
      left-arrow
      fixed
      placeholder
      @click-left="$router.back()"
    />

    <van-loading v-if="!stop && !err" color="#2F6BFF" style="padding: 60px 0; text-align: center" />
    <div
      v-if="err"
      style="padding: 40px 16px; color: #e23d2e; font-size: 13px; word-break: break-all"
    >
      加载出错：{{ err }}
    </div>

    <template v-else-if="stop">
      <!-- 站点信息 -->
      <div class="card" style="margin-top: 12px">
        <div class="stop-info">
          <span class="stop-title">{{ stop.name }}</span>
          <van-tag type="primary" size="medium">地铁</van-tag>
          <van-tag v-if="stop.lines.length > 1" type="danger" size="medium" style="margin-left: 4px"
            >换乘站</van-tag
          >
          <van-tag
            v-if="stop.status === 'pending'"
            type="warning"
            size="medium"
            style="margin-left: 4px"
            >暂缓开通</van-tag
          >
        </div>
        <div v-if="stop.status === 'pending'" class="pending-tip">
          该站已随 5 号线建成，截至 2026 年 9 月暂缓开通，列车通过不停车。
        </div>
      </div>

      <!-- 出入口 -->
      <div class="card" v-if="stop.exits && stop.exits.length">
        <div class="section-title">
          <span class="bar"></span>出入口
          <span class="section-more">共 {{ stop.exits.length }} 个</span>
        </div>
        <div class="exit-grid">
          <span
            v-for="e in stop.exits"
            :key="e"
            class="exit-chip"
            :class="{ 'is-new': (stop.newExits || []).includes(e) }"
          >
            {{ e }}
            <em v-if="(stop.newExits || []).includes(e)">新开</em>
          </span>
        </div>
        <div v-if="(stop.newExits || []).length" class="exit-note">
          {{ stop.newExits.join('、') }} 于 2026-09-28 与 5 号线同步开通
        </div>
        <div v-else-if="newestLine" class="exit-note">
          本站随 {{ newestLine.name }} 于 {{ newestLine.openedAt }} 开通
        </div>
        <div class="exit-note" style="opacity: 0.7">
          出入口编号为示例数据，实际以车站现场标识为准
        </div>
      </div>

      <!-- 实时到站 -->
      <div class="card">
        <div class="section-title">
          <span class="bar"></span>实时到站<span class="section-more">按站序模拟</span>
        </div>
        <div style="padding-top: 6px">
          <div v-for="(a, i) in arrivals" :key="i" class="bus-row">
            <span class="line-chip" :style="{ background: a.color }">{{ a.lineName }}</span>
            <div class="bus-info">开往 {{ a.dest }}</div>
            <span class="crowd" :class="'crowd-tag-' + (a.crowd || '0')">{{ a.state }}</span>
          </div>
        </div>
      </div>

      <!-- 途经线路 -->
      <div class="card">
        <div class="section-title"><span class="bar"></span>途经线路</div>
        <div v-for="ln in stop.lines" :key="ln.id" class="line-row" @click="goLine(ln.id)">
          <span class="line-dot" :style="{ background: ln.color }"></span>
          <div class="line-main">
            <div class="line-name">
              {{ ln.name }} <span class="line-route">{{ ln.startStop }} → {{ ln.endStop }}</span>
            </div>
            <div class="line-meta">
              首班 {{ ln.startTime }} · 末班 {{ ln.endTime }} · {{ ln.basicPrice }}-{{
                ln.totalPrice
              }}元 · 间隔 {{ ln.interval }}
            </div>
          </div>
          <van-icon name="arrow" color="var(--icon-muted)" />
        </div>
        <van-empty v-if="!stop.lines.length" description="暂无线路信息" image-size="60" />
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <van-button color="#2F6BFF" round block @click="goHere">到这里去</van-button>
        <van-button plain color="#2F6BFF" round block style="margin-top: 10px" @click="leaveHere"
          >从这里出发</van-button
        >
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

const stop = ref(null)
const err = ref('')
const arrivals = ref([])

/** 本站最新开通的线路（5 / 7 号线），用于标出「新开的地铁口」 */
const newestLine = computed(() => {
  const list = (stop.value && stop.value.lines ? stop.value.lines : []).filter(
    (l) => l.isNew && l.openedAt
  )
  if (!list.length) return null
  return list.sort((a, b) => String(b.openedAt).localeCompare(String(a.openedAt)))[0]
})

function goLine(id) {
  router.push(`/line/${id}`)
}

function goHere() {
  if (!stop.value) return
  router.push({ path: '/plan', query: { to: stop.value.id } })
}
function leaveHere() {
  if (!stop.value) return
  router.push({ path: '/plan', query: { from: stop.value.id } })
}

onMounted(async () => {
  try {
    stop.value = await api.getStopById(route.params.id)
    if (!stop.value) {
      err.value = '未找到站点 ' + route.params.id
      return
    }

    arrivals.value = await api.getArrivals(stop.value.id)
  } catch (e) {
    err.value = String(e && e.message ? e.message : e)
  }
})
</script>

<style scoped>
.stop-info {
  display: flex;
  align-items: center;
}
.stop-title {
  font-size: 20px;
  font-weight: 700;
  margin-right: 10px;
}
.pending-tip {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #c77700;
  background: #fff7e8;
  border-radius: 8px;
  padding: 8px 10px;
}
.exit-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0 2px;
}
.exit-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px 12px;
}
.exit-chip.is-new {
  border-color: #2f6bff;
  color: #2f6bff;
  background: rgba(47, 107, 255, 0.06);
}
.exit-chip em {
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  background: #2f6bff;
  border-radius: 3px;
  padding: 1px 4px;
}
.exit-note {
  font-size: 11px;
  color: var(--placeholder);
  padding-top: 6px;
}
.line-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.line-row:last-child {
  border-bottom: none;
}
.line-main {
  flex: 1;
  min-width: 0;
}
.line-name {
  font-size: 15px;
  font-weight: 600;
}
.line-route {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 400;
}
.line-meta {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 3px;
}
.bus-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px dashed var(--border);
}
.bus-row:last-child {
  border-bottom: none;
}
.bus-info {
  flex: 1;
  font-size: 13px;
  color: var(--text-2);
}
.crowd {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 500;
}
.line-chip {
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  padding: 2px 8px;
  flex-shrink: 0;
}
.actions {
  padding: 12px 14px 30px;
}
</style>
