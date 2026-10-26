<template>
  <div class="page">
    <!-- 顶部：固定长春，不再提供城市切换 + 搜索 -->
    <div class="home-header">
      <div class="city-search">
        <div class="brand">
          <span class="brand-name">长春地铁</span>
          <span class="brand-sub">Changchun Metro</span>
        </div>
        <div class="search-box" @click="$router.push('/search')">
          <van-icon name="search" size="16" color="var(--placeholder)" />
          <span style="margin-left: 6px">搜索站点 / 线路</span>
        </div>
      </div>
    </div>

    <!-- 路线规划（首页唯一入口，起终点在规划页里选） -->
    <div class="card link-card" @click="$router.push('/plan')">
      <div style="display: flex; align-items: center; gap: 10px">
        <div class="ico ico-blue"><van-icon name="exchange" size="20" color="#2F6BFF" /></div>
        <div>
          <div style="font-size: 15px; font-weight: 600">路线规划</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px">
            起终点算路 · 换乘最少 / 步行最少
          </div>
        </div>
      </div>
      <van-icon name="arrow" color="var(--icon-muted)" />
    </div>

    <!-- 长春地铁图 -->
    <div class="card link-card" @click="$router.push('/map')">
      <div style="display: flex; align-items: center; gap: 10px">
        <div class="ico ico-blue"><van-icon name="map-marked" size="20" color="#2F6BFF" /></div>
        <div>
          <div style="font-size: 15px; font-weight: 600">长春地铁图</div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px">8 条线路 · 148 座车站</div>
        </div>
      </div>
      <van-icon name="arrow" color="var(--icon-muted)" />
    </div>

    <!-- 线路速览：新开线路（5 / 7 号线）在这里直接可见 -->
    <div class="card">
      <div class="section-title">
        <span class="bar"></span>长春轨道交通线路
        <span class="section-more">{{ lineList.length }} 条线 · {{ stationCount }} 站</span>
      </div>
      <div class="line-grid">
        <div
          v-for="l in lineList"
          :key="l.id"
          class="line-item"
          :class="{ 'is-new': l.isNew }"
          @click="$router.push('/line/' + l.id)"
        >
          <span class="line-badge" :style="{ background: l.color }">{{ l.no }}</span>
          <div class="line-item-main">
            <div class="line-item-name">
              {{ l.name }}
              <em v-if="l.isNew" class="new-flag">新开通</em>
            </div>
            <div class="line-item-sub">{{ l.stationCount }} 站 · {{ l.type }}</div>
          </div>
        </div>
      </div>
      <div class="line-grid-note" v-if="hasNewLine">
        5 号线于 2026-09-28 开通，7 号线于 2026-08-26 开通，可直接点击查看站点与换乘。
      </div>
    </div>

    <!-- 官方通告 -->
    <div class="card" v-if="newsList.length">
      <div class="section-title">
        <span class="bar"></span>官方通告
        <span class="section-more">共 {{ newsList.length }} 条</span>
      </div>
      <div v-for="n in newsList" :key="n.id" class="news-item" @click="showNews(n)">
        <div class="news-main">
          <span class="news-tag">{{ n.tag }}</span>
          <span class="news-title">{{ n.title }}</span>
        </div>
        <div class="news-date">{{ n.date }}</div>
      </div>
    </div>

    <!-- 通告详情 -->
    <van-dialog
      v-model:show="newsVisible"
      :title="activeNews.title"
      show-cancel-button
      cancel-button-text="关闭"
      confirm-button-text="知道了"
    >
      <div class="news-body">
        <div class="news-body-date">{{ activeNews.date }} · {{ activeNews.tag }}</div>
        <p>{{ activeNews.summary }}</p>
      </div>
    </van-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../services/api'

const newsVisible = ref(false)
const activeNews = ref({ title: '', date: '', tag: '', summary: '' })
const newsList = api.getNews()

/** 线路速览（含新开的 5 / 7 号线） */
const lineList = ref([])
const stationCount = ref(0)
const hasNewLine = computed(() => lineList.value.some((l) => l.isNew))

function showNews(n) {
  activeNews.value = n
  newsVisible.value = true
}

/** 线路速览数据：站数按站点 id 去重统计（换乘站只算一次） */
async function loadLines() {
  try {
    const list = await api.getAllLines()
    const seen = new Set()
    list.forEach((l) => l.busstops.forEach((s) => seen.add(s.id)))
    stationCount.value = seen.size
    lineList.value = list.map((l) => ({
      ...l,
      no: (String(l.name).match(/\d+/) || [''])[0]
    }))
  } catch (e) {
    lineList.value = []
  }
}

onMounted(loadLines)
</script>

<style scoped>
.brand {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding-right: 6px;
}
.brand-name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.brand-sub {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.72);
  letter-spacing: 0.6px;
  white-space: nowrap;
}
/* 线路速览 */
.line-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}
.line-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  cursor: pointer;
  min-width: 0;
}
.line-item.is-new {
  border-color: rgba(226, 61, 46, 0.32);
}
.line-badge {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 7px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.line-item-main {
  min-width: 0;
  flex: 1;
}
.line-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.new-flag {
  font-style: normal;
  font-size: 9px;
  font-weight: 600;
  color: #fff;
  background: #e23d2e;
  border-radius: 3px;
  padding: 0 3px;
  line-height: 14px;
  flex-shrink: 0;
}
.line-item-sub {
  font-size: 10px;
  color: var(--placeholder);
  margin-top: 1px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.line-grid-note {
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--placeholder);
}
.link-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}
.ico {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ico-blue {
  background: rgba(47, 107, 255, 0.08);
}
.news-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 0;
  border-bottom: 1px solid var(--border);
}
.news-item:last-child {
  border-bottom: none;
}
.news-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}
.news-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: #2f6bff;
  background: var(--primary-light);
  border-radius: 4px;
  padding: 2px 6px;
}
.news-title {
  font-size: 14px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.news-date {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--placeholder);
  margin-left: 8px;
}
.news-body {
  padding: 4px 20px 8px;
  color: #3a3f45;
  font-size: 14px;
  line-height: 1.7;
}
.news-body-date {
  font-size: 12px;
  color: var(--placeholder);
  margin-bottom: 6px;
}
</style>
