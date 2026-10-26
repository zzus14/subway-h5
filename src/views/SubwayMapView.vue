<template>
  <div class="page">
    <van-nav-bar title="地铁图" fixed placeholder>
      <template #right>
        <van-icon name="search" color="#fff" size="20" @click="$router.push('/search')" />
      </template>
    </van-nav-bar>

    <!-- 线网图（卡片式，左右 12px 边距，与其他页面一致） -->
    <SubwaySchematic :schematic="schematicData" @select="onSelect" @line="onLine" />

    <div class="card">
      <div class="section-title"><span class="bar"></span>线网信息</div>
      <div style="font-size: 13px; color: #6b7280; line-height: 1.8; padding-top: 6px">
        长春轨道交通共 {{ lineCount }} 条线路 · {{ stopCount }} 个站点 ·
        {{ transferCount }} 个换乘站
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import SubwaySchematic from '../components/SubwaySchematic.vue'
import { buildSchematic } from '../data/metroData'

const router = useRouter()
const schematicData = ref(buildSchematic())

const lineCount = computed(() => schematicData.value.lines.length)
const stopCount = computed(() => {
  const set = new Set()
  schematicData.value.lines.forEach((l) => l.stops.forEach((s) => set.add(s.id)))
  return set.size
})
const transferCount = computed(() => {
  const set = new Set()
  schematicData.value.lines.forEach((l) =>
    l.stops.forEach((s) => {
      if (s.transfer) set.add(s.id)
    })
  )
  return set.size
})

function onSelect(st) {
  router.push(`/stop/${st.id}`)
}

/** 点图例进入线路详情：那里是纵向站点列表，站名最清楚 */
function onLine(ln) {
  if (ln && ln.id) router.push(`/line/${ln.id}`)
}
</script>
