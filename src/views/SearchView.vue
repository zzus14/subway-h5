<template>
  <div class="page-no-tab">
    <van-nav-bar left-arrow @click-left="$router.back()">
      <template #title>
        <van-search
          v-model="keyword"
          placeholder="输入站点 / 线路名称"
          shape="round"
          autofocus
          @search="doSearch"
          @clear="clearAll"
        />
      </template>
    </van-nav-bar>

    <!-- 初始态：历史 + 热门 -->
    <template v-if="!searched">
      <div class="card" v-if="store.state.searchHistory.length">
        <div class="section-title">
          <span class="bar"></span>历史搜索
          <van-icon name="delete-o" class="section-more" size="18" @click="clearHistory" />
        </div>
        <div class="tags">
          <span
            v-for="h in store.state.searchHistory"
            :key="h"
            class="tag"
            @click="quickSearch(h)"
            >{{ h }}</span
          >
        </div>
      </div>

      <div class="card">
        <div class="section-title"><span class="bar"></span>热门搜索</div>
        <div class="tags">
          <span v-for="h in hotList" :key="h" class="tag tag-hot" @click="quickSearch(h)">{{
            h
          }}</span>
        </div>
      </div>
    </template>

    <!-- 结果态 -->
    <template v-else>
      <div class="card">
        <div class="section-title">
          <span class="bar"></span>搜索结果
          <span class="section-more">{{ keyword }}</span>
        </div>
        <van-loading v-if="loading" color="#2F6BFF" style="padding: 30px 0" />
        <template v-else>
          <div v-if="resultStops.length || resultLines.length">
            <div v-if="resultStops.length" class="group-title">
              站点（{{ resultStops.length }}）
            </div>
            <div v-for="s in resultStops" :key="s.id" class="result-item" @click="goStop(s)">
              <van-icon name="location-o" color="#2F6BFF" size="18" />
              <div class="result-main">
                <div class="result-name">{{ s.name }}</div>
                <div class="result-sub">
                  <van-tag
                    v-for="ln in s.lines"
                    :key="ln.id"
                    :color="ln.color"
                    text-color="#fff"
                    size="mini"
                    style="margin-right: 4px"
                    >{{ ln.name }}</van-tag
                  >
                </div>
              </div>
              <van-icon name="arrow" color="var(--icon-muted)" />
            </div>

            <div v-if="resultLines.length" class="group-title" style="margin-top: 14px">
              线路（{{ resultLines.length }}）
            </div>
            <div v-for="l in resultLines" :key="l.id" class="result-item" @click="goLine(l)">
              <span class="line-dot" :style="{ background: l.color }"></span>
              <div class="result-main">
                <div class="result-name">{{ l.name }}</div>
                <div class="result-sub">
                  {{ l.startStop }} → {{ l.endStop }} · {{ l.busstops.length }} 站 ·
                  {{ l.basicPrice }}-{{ l.totalPrice }}元
                </div>
              </div>
              <van-icon name="arrow" color="var(--icon-muted)" />
            </div>
          </div>
          <van-empty v-else description="没有找到相关站点或线路" image-size="80" />
        </template>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../services/api'
import { useStore } from '../composables/useStore'
import { showToast } from 'vant'

const router = useRouter()
const store = useStore()

const keyword = ref('')
const searched = ref(false)
const loading = ref(false)
const resultStops = ref([])
const resultLines = ref([])
const hotList = ref(api.getHotSearches())

function doSearch() {
  if (!keyword.value.trim()) return
  commitSearch(keyword.value.trim())
}

async function commitSearch(kw) {
  loading.value = true
  searched.value = true
  store.addHistory(kw)
  const res = await api.search(kw)
  resultStops.value = res.stops
  resultLines.value = res.lines
  loading.value = false
}

function quickSearch(kw) {
  keyword.value = kw
  commitSearch(kw)
}

function clearAll() {
  searched.value = false
  resultStops.value = []
  resultLines.value = []
}

function clearHistory() {
  store.clearHistory()
  showToast('已清空历史搜索')
}

function goStop(s) {
  store.addHistory(s.name)
  router.push(`/stop/${s.id}`)
}

function goLine(l) {
  store.addHistory(l.name)
  router.push(`/line/${l.id}`)
}
</script>

<style scoped>
:deep(.van-nav-bar__content) {
  padding: 0 8px;
  background: transparent;
}
:deep(.van-search) {
  background: transparent;
  padding: 4px 0;
}
:deep(.van-search__content) {
  background: var(--card);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 10px;
}
.tag {
  font-size: 13px;
  color: #3a3f45;
  background: #f2f3f5;
  border-radius: 999px;
  padding: 6px 14px;
  cursor: pointer;
}
.tag-hot {
  color: #2f6bff;
  background: var(--primary-light);
}
.group-title {
  font-size: 13px;
  color: var(--placeholder);
  margin: 8px 0 2px;
}
.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.result-item:last-child {
  border-bottom: none;
}
.result-main {
  flex: 1;
  min-width: 0;
}
.result-name {
  font-size: 15px;
  font-weight: 600;
}
.result-sub {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-2);
}
</style>
