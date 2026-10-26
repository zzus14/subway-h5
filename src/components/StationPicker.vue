<template>
  <van-popup
    :show="show"
    position="bottom"
    round
    :style="{ height: '78%' }"
    safe-area-inset-bottom
    @update:show="$emit('update:show', $event)"
  >
    <div class="picker">
      <div class="picker-head">
        <span class="picker-title">{{ title }}</span>
        <van-icon
          name="cross"
          size="18"
          color="var(--icon-muted)"
          @click="$emit('update:show', false)"
        />
      </div>
      <van-search v-model="keyword" placeholder="站名 / 拼音 / 首字母，如 rmgc" shape="round" autofocus />
      <div class="picker-body">
        <div v-if="loading" style="padding: 40px 0; text-align: center">
          <van-loading color="#2F6BFF" size="22" />
        </div>
        <template v-else>
          <div v-for="s in filtered" :key="s.id" class="stop-row" @click="choose(s)">
            <van-icon name="location-o" color="#2F6BFF" size="18" />
            <div class="stop-main">
              <div class="stop-name">{{ s.name }}</div>
              <div class="stop-sub">
                <span
                  v-for="ln in s.lines"
                  :key="ln.id"
                  class="line-chip"
                  :style="{ background: ln.color }"
                  >{{ ln.name }}</span
                >
                <span v-if="s.lines.length > 1" class="transfer-tip">换乘站</span>
              </div>
            </div>
            <van-icon name="arrow" color="var(--icon-muted)" />
          </div>
          <van-empty v-if="!filtered.length" description="没有匹配的站点" image-size="70" />
        </template>
      </div>
    </div>
  </van-popup>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../services/api'

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: '选择站点' }
})
const emit = defineEmits(['update:show', 'select'])

const keyword = ref('')
const allStops = ref([])
const loading = ref(false)
let loaded = false

async function load() {
  if (loaded || loading.value) return
  loading.value = true
  try {
    allStops.value = await api.getAllStops()
    loaded = true
  } catch (e) {
    allStops.value = []
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const list = allStops.value
  if (!kw) {
    // 默认展示换乘站（更像"常用站点"）
    const transfer = list.filter((s) => s.lines.length > 1)
    return (transfer.length ? transfer : list).slice(0, 40)
  }
  return list
    .filter(
      (s) =>
        s.name.includes(kw) ||
        (s.pinyin || '').includes(kw) ||
        (s.short || '').includes(kw) ||
        s.id.toLowerCase().includes(kw)
    )
    .slice(0, 60)
})

function choose(station) {
  emit('select', station)
  emit('update:show', false)
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      keyword.value = ''
      load()
    }
  }
)
</script>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 6px;
}
.picker-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}
.picker-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px 20px;
}
.stop-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}
.stop-row:last-child {
  border-bottom: none;
}
.stop-main {
  flex: 1;
  min-width: 0;
}
.stop-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.stop-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.line-chip {
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  padding: 1px 6px;
}
.transfer-tip {
  font-size: 11px;
  color: #ed6a0c;
}
</style>
