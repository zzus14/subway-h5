<template>
  <div class="schematic-card">
    <div class="map-head">
      <span class="map-title">线网图</span>
      <span class="map-title-en">Route Map</span>
      <span class="map-tip">点站点看详情</span>
    </div>

    <svg
      class="schematic"
      :viewBox="`0 0 ${schematic.width} ${schematic.height}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="长春轨道交通线网示意图"
    >
      <!-- 线路 -->
      <g>
        <polyline
          v-for="ln in schematic.lines"
          :key="'pl-' + ln.id"
          :points="ln.points.map((p) => p.join(',')).join(' ')"
          fill="none"
          :stroke="ln.color"
          stroke-width="8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>

      <!-- 线路号牌（两端） -->
      <g v-for="bg in badges" :key="'bg-' + bg.key">
        <rect
          :x="bg.x"
          :y="bg.y"
          :width="bg.w"
          :height="BADGE_H"
          rx="5"
          :fill="bg.color"
          class="line-badge"
          @click="emitLine(bg.line)"
        />
        <text :x="bg.x + bg.w / 2" :y="bg.y + BADGE_H / 2 + 7" class="badge-text" text-anchor="middle">
          {{ bg.text }}
        </text>
      </g>

      <!-- 站点 -->
      <g v-for="st in stops" :key="st.id" class="snode" @click="emitSelect(st)">
        <circle
          v-if="st.transfer"
          :cx="st.x"
          :cy="st.y"
          r="7.5"
          fill="#fff"
          stroke="#333"
          stroke-width="2.6"
          class="pointer"
        />
        <circle
          v-else
          :cx="st.x"
          :cy="st.y"
          r="5.5"
          fill="#fff"
          :stroke="st.color"
          stroke-width="2.6"
          class="pointer"
        />
        <circle :cx="st.x" :cy="st.y" r="13" fill="transparent" class="hit" />
        <line
          v-if="st.labeled && st.leader"
          :x1="st.leader.x1"
          :y1="st.leader.y1"
          :x2="st.leader.x2"
          :y2="st.leader.y2"
          class="leader"
        />
        <text
          v-if="st.labeled"
          :x="st.labelX"
          :y="st.labelY"
          class="sname pointer"
          :text-anchor="st.anchor"
          :style="{ fontSize: FONT + 'px', strokeWidth: FONT * 0.16 + 'px' }"
        >
          {{ st.name }}
        </text>
      </g>

      <!-- 指北针（放在线网图东南侧空白处，与原图一致） -->
      <g class="north">
        <path d="M1341 728 L1356 788 L1341 776 L1326 788 Z" fill="#333" />
        <text x="1341" y="812" class="north-text" text-anchor="middle">北</text>
        <text x="1341" y="832" class="north-text-en" text-anchor="middle">NORTH</text>
      </g>
    </svg>

    <!-- 图例已去掉：线路号牌就在图上，点号牌即可进线路详情 -->
    <div class="hint">站距与走向非真实比例</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildSchematic } from '../data/metroData'

const props = defineProps({
  /** 线网示意图数据；不传时按本地布局即时生成 */
  schematic: { type: Object, default: null }
})

const emit = defineEmits(['select', 'line'])
const schematic = computed(() => props.schematic || buildSchematic())

/**
 * 画布单位下的字号：整图缩放到手机宽度（约 0.23 倍）后约 4.6px。
 * 线网图按官方图逐站取点，站距约 43 单位，字号取 20 时「字号/站距」≈0.47，
 * 与原图（26px 字 / 54px 站距）相当；再大就会有站名互相挤占。
 */
const FONT = 18
const BADGE_H = 32
const BADGE_FONT = 19

/* ---------------- 站名排布（避免重叠） ---------------- */

const textWidth = (name, font = FONT) =>
  [...name].reduce((w, ch) => w + (/[\x00-\xff]/.test(ch) ? font * 0.58 : font * 1.03), 0)

const RADIUS = (st) => (st.transfer ? 8 : 6.5)

/** 图面上的站名：括注太长，只保留主名（点站点进详情可看全名） */
const mapName = (name) => String(name).replace(/[（(][^）)]*[）)]/g, '')

/**
 * 候选位置：以站点为圆心，按「上/下/左/右 + 四个斜角」由近到远逐级外推。
 * 字号越小、外推级数越多，能塞下的站名就越多——这是「一屏全览」下的必然取舍。
 */
const candidatesFor = (st) => {
  const r = RADIUS(st)
  const gap = 2.5
  const out = []
  const levels = [0, 1, 2, 3, 4, 5]
  const vStep = FONT * 1.22
  for (const lv of levels) {
    // 正上 / 正下（可在水平方向轻微让位，挤在密集段时用得上）
    const ly1 = st.y - r - gap - lv * vStep - FONT * 0.16
    const ly2 = st.y + r + gap + lv * vStep + FONT * 0.88
    for (const sh of [0, -0.62, 0.62]) {
      out.push({ labelX: st.x + sh * FONT, labelY: ly1, anchor: 'middle', dir: 'up' })
      out.push({ labelX: st.x + sh * FONT, labelY: ly2, anchor: 'middle', dir: 'down' })
    }
    // 正右 / 正左（可在垂直方向轻微让位）
    const dx = r + gap + lv * FONT * 0.5
    for (const sh of [0, -0.55, 0.55]) {
      out.push({ labelX: st.x + dx, labelY: st.y + FONT * 0.34 + sh * FONT, anchor: 'start', dir: 'right' })
      out.push({ labelX: st.x - dx, labelY: st.y + FONT * 0.34 + sh * FONT, anchor: 'end', dir: 'left' })
    }
    // 四个斜角（比正方向稍远一点，避免压住圆点）
    const dg = r + gap + lv * FONT * 0.5 + FONT * 0.35
    out.push({ labelX: st.x + dg, labelY: st.y - FONT * 0.35, anchor: 'start' })
    out.push({ labelX: st.x - dg, labelY: st.y - FONT * 0.35, anchor: 'end' })
    out.push({ labelX: st.x + dg, labelY: st.y + FONT * 0.95, anchor: 'start' })
    out.push({ labelX: st.x - dg, labelY: st.y + FONT * 0.95, anchor: 'end' })
  }
  return out
}

/**
 * 站名排布：换乘站 / 线路端点优先，其余依次占位；
 * 每个站尝试 8 个方位，取第一个不压住其它圆点和已放站名的位置；
 * 都放不下就先隐藏（点击站点仍可进详情看站名）。
 */
const stops = computed(() => {
  const map = new Map()

  for (const ln of schematic.value.lines) {
    ln.stops.forEach((st, i) => {
      const [x, y] = ln.points[i]
      const prev = i > 0 ? ln.points[i - 1] : null
      const next = i < ln.points.length - 1 ? ln.points[i + 1] : null
      const endpoint = i === 0 || i === ln.stops.length - 1
      // 该站所在的那一段更接近水平还是垂直（决定站名排布方位）
      const ref = next || prev
      const horiz = ref ? Math.abs(y - ref[1]) <= Math.abs(x - ref[0]) : true
      const vert = ref ? !horiz && Math.abs(x - ref[0]) < Math.abs(y - ref[1]) : false
      const node = map.get(st.id)
      if (node) {
        node.transfer = node.transfer || st.transfer
        node.endpoint = node.endpoint || endpoint
        return
      }
      map.set(st.id, {
        id: st.id,
        name: mapName(st.name),
        x,
        y,
        color: ln.color,
        transfer: st.transfer,
        endpoint,
        seq: i,
        horiz,
        vert,
        // 官方线网图里该站名的落点
        hint: st.label || null
      })
    })
  }

  const list = [...map.values()]

  // 先排「周围站点最密」的站：密集区先占位，稀疏区自然有空间，整体显示率更高
  const density = (s) =>
    list.reduce((n, o) => {
      if (o === s) return n
      return Math.hypot(o.x - s.x, o.y - s.y) < FONT * 4 ? n + 1 : n
    }, 0)
  const prio = (s) => density(s) * 10 + (s.transfer ? 4 : 0) + (s.endpoint ? 2 : 0)
  list.sort((a, b) => prio(b) - prio(a))

  const boxes = list.map((s) => {
    const r = RADIUS(s)
    return { id: s.id, x1: s.x - r, y1: s.y - r, x2: s.x + r, y2: s.y + r }
  })
  const hit = (b, selfId) =>
    boxes.some(
      (o) => o.id !== selfId && !(b.x2 < o.x1 || b.x1 > o.x2 || b.y2 < o.y1 || b.y1 > o.y2)
    )

  // 线路折线段：站名尽量别压在线条上，否则缩小后一团糊
  const segs = []
  for (const ln of schematic.value.lines) {
    for (let i = 1; i < ln.points.length; i++) {
      segs.push([...ln.points[i - 1], ...ln.points[i]])
    }
  }
  const LINE_HALF = 4
  const hitsLine = (b) => {
    const x1 = b.x1 - LINE_HALF
    const y1 = b.y1 - LINE_HALF
    const x2 = b.x2 + LINE_HALF
    const y2 = b.y2 + LINE_HALF
    for (const s of segs) {
      // 包围盒快筛
      if (Math.max(s[0], s[2]) < x1 || Math.min(s[0], s[2]) > x2) continue
      if (Math.max(s[1], s[3]) < y1 || Math.min(s[1], s[3]) > y2) continue
      // 沿线采样，任一点落进文字框就算压线
      const steps = 12
      for (let k = 0; k <= steps; k++) {
        const t = k / steps
        const px = s[0] + (s[2] - s[0]) * t
        const py = s[1] + (s[3] - s[1]) * t
        if (px > x1 && px < x2 && py > y1 && py < y2) return true
      }
    }
    return false
  }

  const W = schematic.value.width
  const H = schematic.value.height

  /**
   * ① 官方图的站名落点优先
   * 布局按官方线网图逐站取点，站名落点也一并取回来了：
   * 直接采用最贴近原图，位置也最符合阅读习惯。
   * 挤不下时先在原落点附近做小幅挪位（仍保持同一朝向），
   * 实在放不下才交给下面的自动避让。
   */
  const NUDGE = [
    [0, 0],
    [0, -FONT * 0.62],
    [0, FONT * 0.62],
    [-FONT * 0.75, 0],
    [FONT * 0.75, 0],
    [0, -FONT * 1.24],
    [0, FONT * 1.24],
    [-FONT * 1.5, 0],
    [FONT * 1.5, 0],
    // 再往外一圈：原落点被邻站占住时，宁可同侧稍远，也别掉到很远的地方去
    [0, -FONT * 1.9],
    [0, FONT * 1.9],
    [-FONT * 2.3, 0],
    [FONT * 2.3, 0],
    [-FONT * 1.3, -FONT * 1.3],
    [FONT * 1.3, -FONT * 1.3],
    [-FONT * 1.3, FONT * 1.3],
    [FONT * 1.3, FONT * 1.3]
  ]

  for (const st of list) {
    if (!st.hint) continue
    const [anchor, lx, ly] = st.hint
    const w = textWidth(st.name)
    const left = anchor === 'middle' ? lx - w / 2 : anchor === 'end' ? lx - w : lx
    let picked = null
    // 原落点 → 镜像到站点另一侧 → 逐级小幅挪位；
    // 先找「不压站点、也不压线路」的落点，实在没有才允许轻压线路（站名有白描边，仍可读）
    const bases = [ly, 2 * st.y - ly]
    for (const strict of [true, false]) {
      for (const [dx, dy] of NUDGE) {
        for (const base of bases) {
          const box = {
            id: st.id,
            x1: left - 2.5 + dx,
            y1: base - FONT * 1.07 + dy,
            x2: left + w + 2.5 + dx,
            y2: base + FONT * 0.16 + dy
          }
          if (box.x1 < 1 || box.x2 > W - 1 || box.y1 < 1 || box.y2 > H - 1) continue
          if (hit(box, st.id)) continue
          if (strict && hitsLine(box)) continue
          picked = {
            box,
            labelX: anchor === 'middle' ? (box.x1 + box.x2) / 2 : anchor === 'end' ? box.x2 - 2.5 : box.x1 + 2.5,
            labelY: base + dy
          }
          break
        }
        if (picked) break
      }
      if (picked) break
    }
    if (!picked) continue
    boxes.push(picked.box)
    st.labelX = picked.labelX
    st.labelY = picked.labelY
    st.anchor = anchor
    st.labeled = true
    st.hinted = true
  }

  for (const st of list) {
    if (st.hinted) continue
    const w = textWidth(st.name)

    // 站点密集，按「竖线优先左右、横线优先上下（隔站交替）」重排候选位
    const cands = candidatesFor(st)
    const group = (d) => cands.filter((c) => c.dir === d)
    const up = group('up')
    const down = group('down')
    const side = [...group('right'), ...group('left')]
    const diag = cands.filter((c) => !c.dir)
    // 竖线上的站名优先左右；横线上的上下交替（相邻站名不会撞在一起）
    let order = cands
    if (st.vert) {
      order = [...side, ...up, ...down, ...diag]
    } else if (st.horiz) {
      order = st.seq % 2 === 1 ? [...down, ...up, ...side, ...diag] : [...up, ...down, ...side, ...diag]
    }

    // 先算好每个候选位的文字框，再分两轮挑：
    // ① 不压站点、也不压线路（最优）；② 退一步只要求不压站点
    const option = order.map((c) => {
      let left = c.anchor === 'middle' ? c.labelX - w / 2 : c.anchor === 'end' ? c.labelX - w : c.labelX
      // 边缘站名不要被画布裁掉：整体平移回画布内
      left = Math.max(2, Math.min(W - w - 2, left))
      const labelX = c.anchor === 'middle' ? left + w / 2 : c.anchor === 'end' ? left + w : left
      return {
        c,
        labelX,
        labelY: c.labelY,
        box: {
          id: st.id,
          x1: left - 2.5,
          y1: c.labelY - FONT * 1.07,
          x2: left + w + 2.5,
          y2: c.labelY + FONT * 0.16
        }
      }
    })

    const insideBox = (b) => b.y1 >= 1 && b.y2 <= H - 1

    const pick =
      option.find((o) => insideBox(o.box) && !hit(o.box, st.id) && !hitsLine(o.box)) ||
      option.find((o) => insideBox(o.box) && !hit(o.box, st.id))

    if (pick) {
      boxes.push(pick.box)
      st.labelX = pick.labelX
      st.labelY = pick.labelY
      st.anchor = pick.c.anchor
      st.labeled = true
    } else {
      st.labeled = false
    }
  }

  // 兜底：中心最密的地方实在挤不下时，用「引线标注」把站名挪到最近的空位，
  // 保证 148 个站名一个都不少。
  for (const st of list) {
    if (st.labeled) continue
    const w = textWidth(st.name)
    // 16 个方向，由近到远搜索空位
    const dirs = []
    for (let a = 0; a < 16; a++) {
      const ang = (a * Math.PI) / 8
      dirs.push([Math.cos(ang), Math.sin(ang)])
    }
    let found = null
    let loose = null // 压到线路的次优位置（站名有白描边，勉强可读）
    for (let d = 1; d <= 16 && !found; d++) {
      const R = FONT * (1.3 + d * 0.6)
      for (const [ux, uy] of dirs) {
        const anchor = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle'
        const labelX = st.x + ux * R
        const labelY = st.y + uy * R + FONT * 0.34
        let left = anchor === 'middle' ? labelX - w / 2 : anchor === 'end' ? labelX - w : labelX
        const clamped = Math.max(2, Math.min(W - w - 2, left))
        // 被画布边缘推回来了，说明这个方向贴边，跳过，换下一个方向
        if (clamped !== left) continue
        left = clamped
        const box = {
          id: st.id,
          x1: left - 2.5,
          y1: labelY - FONT * 1.07,
          x2: left + w + 2.5,
          y2: labelY + FONT * 0.16
        }
        if (box.y1 < 1 || box.y2 > H - 1) continue
        if (hit(box, st.id)) continue
        if (hitsLine(box)) {
          if (!loose) loose = { box, labelX, labelY, anchor, ux, uy }
          continue
        }
        found = { box, labelX, labelY, anchor, ux, uy }
        break
      }
    }
    if (!found) found = loose

    // 最后兜底：仍无空位时，挑「遮挡最少」的位置强行放下（极少数站才会走到这里）
    if (!found) {
      let bestScore = Infinity
      for (let d = 1; d <= 16; d++) {
        const R = FONT * (1.3 + d * 0.6)
        for (const [ux, uy] of dirs) {
          const anchor = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle'
          const labelX = st.x + ux * R
          const labelY = st.y + uy * R + FONT * 0.34
          const rawLeft = anchor === 'middle' ? labelX - w / 2 : anchor === 'end' ? labelX - w : labelX
          const left = Math.max(2, Math.min(W - w - 2, rawLeft))
          const box = {
            id: st.id,
            x1: left - 2.5,
            y1: labelY - FONT * 1.07,
            x2: left + w + 2.5,
            y2: labelY + FONT * 0.16
          }
          if (box.y1 < 1 || box.y2 > H - 1) continue
          let score = 0
          for (const o of boxes) {
            const ox = Math.min(box.x2, o.x2) - Math.max(box.x1, o.x1)
            const oy = Math.min(box.y2, o.y2) - Math.max(box.y1, o.y1)
            if (ox > 0 && oy > 0) score += ox * oy
          }
          if (score < bestScore) {
            bestScore = score
            found = { box, labelX, labelY, anchor, ux, uy }
          }
        }
      }
    }
    if (found) {
      boxes.push(found.box)
      const r = RADIUS(st)
      st.labelX = found.labelX
      st.labelY = found.labelY
      st.anchor = found.anchor
      st.labeled = true
      // 引线：从圆点边缘拉到站名起点
      const sx = st.x + found.ux * (r + 1)
      const sy = st.y + found.uy * (r + 1)
      st.leader = {
        x1: sx,
        y1: sy,
        x2: found.labelX,
        y2: found.labelY - FONT * 0.34
      }
    }
  }

  return list
})

/* ---------------- 线路号牌 ---------------- */

const badges = computed(() => {
  // 已占位区域：站点圆点 + 已放站名 + 指北针
  const dotBoxes = []
  const labelBoxes = []
  for (const st of stops.value) {
    const r = RADIUS(st)
    dotBoxes.push({ x1: st.x - r, y1: st.y - r, x2: st.x + r, y2: st.y + r })
    if (st.labeled) {
      const w = textWidth(st.name)
      const left =
        st.anchor === 'middle' ? st.labelX - w / 2 : st.anchor === 'end' ? st.labelX - w : st.labelX
      labelBoxes.push({
        x1: left - 2.5,
        y1: st.labelY - FONT * 1.07,
        x2: left + w + 2.5,
        y2: st.labelY + FONT * 0.16
      })
    }
  }
  const northBox = { x1: 1318, y1: 718, x2: 1364, y2: 840 } // 指北针
  const used = [...dotBoxes, ...labelBoxes, northBox]

  const overlap = (a, b) => {
    const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)
    const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)
    return ox > 0 && oy > 0 ? ox * oy : 0
  }
  const clash = (b) => used.some((o) => overlap(b, o) > 0)

  const out = []
  const placeBadge = (ln, allowLabelOverlap) => {
    const pts = ln.points
    if (!pts.length) return false
    const num = ln.name.replace(/[^0-9]/g, '') || ln.name
    const text = `${num}号线`
    const w = Math.round(textWidth(text, BADGE_FONT) + 18)
    const h = BADGE_H
    const W = schematic.value.width
    const H = schematic.value.height
    const ends = [
      { key: `${ln.id}-a`, p: pts[0], q: pts[1] },
      { key: `${ln.id}-b`, p: pts[pts.length - 1], q: pts[pts.length - 2] }
    ]
    for (const e of ends) {
      if (!e.q) continue
      const dx = e.p[0] - e.q[0]
      const dy = e.p[1] - e.q[1]
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      // 沿线路延长方向依次尝试更远的位置，再试左右偏移
      const tries = [
        [34, 0],
        [52, 0],
        [34, 24],
        [34, -24],
        [52, 24],
        [52, -24],
        [70, 0]
      ]
      let best = null
      let fallback = null
      for (const [d, side] of tries) {
        const cx = e.p[0] + ux * d - uy * side
        const cy = e.p[1] + uy * d + ux * side
        const x = Math.max(6, Math.min(W - w - 6, cx - w / 2))
        const y = Math.max(6, Math.min(H - h - 6, cy - h / 2))
        const box = { x1: x, y1: y, x2: x + w, y2: y + h }
        if (!clash(box)) {
          best = { x, y, box }
          break
        }
        if (allowLabelOverlap) {
          // 只避站名圆点，允许轻压字（补漏用）
          const dotHit = dotBoxes.some((o) => overlap(box, o) > 0)
          const pen = labelBoxes.reduce((n, o) => n + overlap(box, o), 0)
          if (!dotHit && (!fallback || pen < fallback.pen)) fallback = { x, y, box, pen }
        }
      }
      const pick = best || fallback
      if (!pick) continue
      used.push(pick.box)
      out.push({
        ...e,
        x: pick.x,
        y: pick.y,
        w,
        color: ln.color,
        text,
        line: ln
      })
      // 官方图每条线两端各有一个号牌，这里两端都放，放不下的自然跳过
    }
  }

  for (const ln of schematic.value.lines) placeBadge(ln, false)

  // 补漏：仍有线路两端被站名挤满时，退一步放一个「尽量不压字」的号牌，
  // 保证 8 条线路都有号可认
  const hasBadge = new Set(out.map((o) => o.line.id))
  for (const ln of schematic.value.lines) {
    if (!hasBadge.has(ln.id)) placeBadge(ln, true)
  }
  return out
})

function emitSelect(st) {  emit('select', st)
}
function emitLine(ln) {
  if (ln && ln.id) emit('line', ln)
}
</script>

<style scoped>
/* 与其他页面统一的卡片：左右 12px 边距 + 14px 圆角，不再满屏出血 */
.schematic-card {
  background: var(--card);
  border-radius: 14px;
  margin: 12px 12px 0;
  padding: 10px 8px 4px;
}
.map-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 2px 6px 6px;
}
.map-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: 0.5px;
}
.map-title-en {
  font-size: 11px;
  color: var(--placeholder);
}
.map-tip {
  margin-left: auto;
  font-size: 11px;
  color: var(--placeholder);
}
.schematic {
  display: block;
  width: 100%;
  height: auto;
  touch-action: manipulation;
  user-select: none;
}
.snode {
  cursor: pointer;
}
.hit {
  pointer-events: all;
}
.sname {
  fill: #333;
  paint-order: stroke;
  stroke: #fff;
  stroke-linejoin: round;
  font-weight: 500;
}
.leader {
  stroke: #a8b0be;
  stroke-width: 1.6;
}
.line-badge {
  cursor: pointer;
}
.badge-text {
  font-size: 19px;
  fill: #fff;
  font-weight: 700;
  pointer-events: none;
}
.north-text {
  font-size: 20px;
  fill: #333;
  font-weight: 600;
}
.north-text-en {
  font-size: 12px;
  fill: #9aa3af;
}

/* 图例样式已随图例一起删除 */

.hint {
  text-align: center;
  font-size: 11px;
  color: var(--placeholder);
  padding: 6px 12px 10px;
  line-height: 1.5;
}
</style>
