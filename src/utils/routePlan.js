/**
 * 地铁路线规划引擎
 *
 *   1. 把线网建成「站点 × 线路」状态图 —— 同一个物理站点在不同线路上是不同节点，
 *      这样换乘次数、经由线路才能被算进最短路；
 *   2. 在状态图上跑 Dijkstra，三种排序策略对应三种边权（耗时 / 少换乘 / 少步行）；
 *   3. 再用 0-1 BFS 求一条「最少站数」保底方案；
 *   4. 对「禁用某个换乘站 / 禁用某条线路」后重算，凑出可比较的多个备选方案。
 *
 * 时间口径（写死，避免争论）：
 *   行车 2 分钟/站 + 停站 0.5 分钟/站 = 2.5 分钟/站；换乘 4 分钟/次。
 *   内部用「半分钟」整数运算，最后逐段向下取整，避免 12.5 分钟这种展示值。
 */
import {
  stations,
  lines,
  stationById,
  stationName,
  lineById,
  lineColor,
  indexOfStationOnLine,
  apiError
} from '../data/metroData'

// 常量 

const HALF_PER_STOP = 5 // 每站 2.5 分钟 = 5 个半分钟
const HALF_PER_TRANSFER = 8 // 换乘 4 分钟 = 8 个半分钟
const WALK_PER_TRANSFER = 180 // 站内换乘步行（米，模拟）
const WALK_OUT_OF_STATION = 420 // 出站换乘步行（米，模拟）
const WALK_PER_STOP = 12 // 乘降步行（米，模拟）
const MAX_PLANS = 6
const INFINITY = Number.MAX_SAFE_INTEGER / 4

const MODES = ['recommended', 'lessTransfer', 'lessWalk']

const PROFILE = {
  TIME: 'time',
  FEWER_TRANSFER: 'fewerTransfer',
  LESS_WALK: 'lessWalk'
}

// 换乘步行距离：出站换乘明显更远（4 号线 <-> 5 号线 东大桥） 
function transferWalkDistance(name) {
  return name === '东大桥' ? WALK_OUT_OF_STATION : WALK_PER_TRANSFER
}

const displayMinutes = (halfMinutes) => Math.floor(halfMinutes / 2)

//状态图

const STATION_COUNT = stations.length
const LINE_COUNT = lines.length
const stationIndex = new Map(stations.map((s, i) => [s.id, i]))
const lineIndex = new Map(lines.map((l, i) => [l.id, i]))

/**
 * 建图。(站点, 线路) 节点编号 = 站点下标 × 线路数 + 线路下标
 * @param {Set<number>} blockedTransferStations 禁止换乘的站点下标（仍可经过）
 * @param {Set<number>} blockedLines 整体不可用的线路下标
 */
function buildGraph(blockedTransferStations = new Set(), blockedLines = new Set()) {
  const nodes = Array.from({ length: STATION_COUNT * LINE_COUNT }, () => [])
  const node = (si, li) => si * LINE_COUNT + li

  // 乘车边：同线相邻站，双向
  for (let li = 0; li < LINE_COUNT; li += 1) {
    if (blockedLines.has(li)) continue
    const line = lines[li]
    for (let i = 0; i + 1 < line.stations.length; i += 1) {
      const a = stationIndex.get(line.stations[i])
      const b = stationIndex.get(line.stations[i + 1])
      if (a === undefined || b === undefined) continue
      nodes[node(b, li)].push({
        to: node(a, li),
        halfMin: HALF_PER_STOP,
        walk: WALK_PER_STOP,
        transferDelta: 0,
        transfer: false
      })
      nodes[node(a, li)].push({
        to: node(b, li),
        halfMin: HALF_PER_STOP,
        walk: WALK_PER_STOP,
        transferDelta: 0,
        transfer: false
      })
    }
  }

  // 换乘边：同站不同线路之间
  for (let si = 0; si < STATION_COUNT; si += 1) {
    if (blockedTransferStations.has(si)) continue
    const station = stations[si]
    const walk = transferWalkDistance(station.name)
    for (const fromLineId of station.lineIds) {
      for (const toLineId of station.lineIds) {
        if (fromLineId === toLineId) continue
        const fromLine = lineIndex.get(fromLineId)
        const toLine = lineIndex.get(toLineId)
        if (fromLine === undefined || toLine === undefined) continue
        if (blockedLines.has(fromLine) || blockedLines.has(toLine)) continue
        nodes[node(si, fromLine)].push({
          to: node(si, toLine),
          // 换乘惩罚 4 分钟 + 下一段首站停站 2.5 分钟（保持 stopCount 含上车站的口径）
          halfMin: HALF_PER_TRANSFER + HALF_PER_STOP,
          walk,
          transferDelta: 1,
          transfer: true
        })
      }
    }
  }

  return {
    nodes,
    node,
    stationOf: (n) => Math.floor(n / LINE_COUNT),
    lineOf: (n) => n % LINE_COUNT
  }
}

// 边权：决定 Dijkstra 的最小化目标 
function edgeScore(edge, profile) {
  if (profile === PROFILE.FEWER_TRANSFER) return edge.halfMin + 60 * edge.transferDelta
  if (profile === PROFILE.LESS_WALK) return 4 * edge.walk + edge.halfMin
  return edge.halfMin
}

//最小堆
class MinHeap {
  constructor() {
    this.items = []
  }

  get size() {
    return this.items.length
  }

  push(cost, node) {
    const items = this.items
    items.push([cost, node])
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (items[parent][0] <= items[i][0]) break
      ;[items[parent], items[i]] = [items[i], items[parent]]
      i = parent
    }
  }

  pop() {
    const items = this.items
    const top = items[0]
    const last = items.pop()
    if (items.length) {
      items[0] = last
      let i = 0
      for (;;) {
        const left = i * 2 + 1
        const right = left + 1
        let smallest = i
        if (left < items.length && items[left][0] < items[smallest][0]) smallest = left
        if (right < items.length && items[right][0] < items[smallest][0]) smallest = right
        if (smallest === i) break
        ;[items[smallest], items[i]] = [items[i], items[smallest]]
        i = smallest
      }
    }
    return top
  }
}

//两套最短路 

// Dijkstra：返回节点路径（空数组表示不可达）
function dijkstra(graph, fromStation, toStation, profile) {
  const total = graph.nodes.length
  const dist = new Array(total).fill(INFINITY)
  const prev = new Array(total).fill(-1)
  const heap = new MinHeap()

  // 起点：以起点站任一线路上车，初始计入「首站停站」时间
  for (const lineId of stations[fromStation].lineIds) {
    const li = lineIndex.get(lineId)
    if (li === undefined) continue
    const startNode = graph.node(fromStation, li)
    if (HALF_PER_STOP < dist[startNode]) {
      dist[startNode] = HALF_PER_STOP
      heap.push(HALF_PER_STOP, startNode)
    }
  }

  while (heap.size) {
    const [cost, current] = heap.pop()
    if (cost > dist[current]) continue
    for (const edge of graph.nodes[current]) {
      const next = cost + edgeScore(edge, profile)
      if (next < dist[edge.to]) {
        dist[edge.to] = next
        prev[edge.to] = current
        heap.push(next, edge.to)
      }
    }
  }

  // 终点：到达目标站任一条线即可
  let bestNode = -1
  let bestCost = INFINITY
  for (const lineId of stations[toStation].lineIds) {
    const li = lineIndex.get(lineId)
    if (li === undefined) continue
    const candidate = graph.node(toStation, li)
    if (dist[candidate] < bestCost) {
      bestCost = dist[candidate]
      bestNode = candidate
    }
  }
  if (bestNode < 0) return []

  const path = []
  for (let cursor = bestNode; cursor !== -1; cursor = prev[cursor]) {
    path.push(cursor)
    if (path.length > total + 1) break // 环路保护
  }
  return path.reverse()
}

//0-1 BFS：求「最少站数」路径（换乘边权重 0、乘车边权重 1）
function layeredBfs(graph, fromStation, toStation) {
  const total = graph.nodes.length
  const dist = new Array(total).fill(-1)
  const prev = new Array(total).fill(-1)
  const deque = []

  for (const lineId of stations[fromStation].lineIds) {
    const li = lineIndex.get(lineId)
    if (li === undefined) continue
    const startNode = graph.node(fromStation, li)
    if (dist[startNode] < 0) {
      dist[startNode] = 0
      deque.unshift(startNode)
    }
  }

  let guard = 0
  while (deque.length && guard < total * 8) {
    guard += 1
    const current = deque.shift()
    for (const edge of graph.nodes[current]) {
      const step = edge.transfer ? 0 : 1
      const next = dist[current] + step
      if (dist[edge.to] < 0 || next < dist[edge.to]) {
        dist[edge.to] = next
        prev[edge.to] = current
        if (step === 0) deque.unshift(edge.to)
        else deque.push(edge.to)
      }
    }
  }

  let bestNode = -1
  let bestCost = Number.MAX_SAFE_INTEGER
  for (const lineId of stations[toStation].lineIds) {
    const li = lineIndex.get(lineId)
    if (li === undefined) continue
    const candidate = graph.node(toStation, li)
    const cost = dist[candidate]
    if (cost >= 0 && cost < bestCost) {
      bestCost = cost
      bestNode = candidate
    }
  }
  if (bestNode < 0) return []

  const path = []
  for (let cursor = bestNode; cursor !== -1; cursor = prev[cursor]) {
    path.push(cursor)
    if (path.length > total + 1) break
  }
  return path.reverse()
}

//方案组装 
function makeSegment(lineId, fromId, toId) {
  const line = lineById(lineId)
  const fromIndex = indexOfStationOnLine(lineId, fromId)
  const toIndex = indexOfStationOnLine(lineId, toId)
  const segment = { lineId, fromId, toId, direction: '', stopCount: 0, duration: 0 }

  if (line) {
    // 行车方向 = 本段朝向的终点站
    const terminal =
      toIndex >= fromIndex ? line.stations[line.stations.length - 1] : line.stations[0]
    segment.direction = `开往 ${stationName(terminal)} 方向`
  }
  segment.stopCount = fromIndex >= 0 && toIndex >= 0 ? Math.abs(toIndex - fromIndex) + 1 : 0
  segment.duration = displayMinutes(segment.stopCount * HALF_PER_STOP)
  return segment
}

//由节点路径组装方案（分段 / 换乘明细 / 总时间 / 步行距离）
function buildPlan(graph, path) {
  const plan = {
    segments: [],
    transferInfos: [],
    transfers: 0,
    stops: 0,
    walkDistance: 0,
    halfMinutes: 0,
    duration: 0
  }
  if (path.length < 2) return plan

  let currentLineId = lines[graph.lineOf(path[0])].id
  let segmentStartId = stations[graph.stationOf(path[0])].id

  for (let k = 1; k < path.length; k += 1) {
    const stationId = stations[graph.stationOf(path[k])].id
    const lineId = lines[graph.lineOf(path[k])].id
    if (lineId === currentLineId) continue // 同线继续乘车

    // 线路发生变化 -> 在此站换乘
    if (stationId !== segmentStartId) {
      plan.segments.push(makeSegment(currentLineId, segmentStartId, stationId))
    }
    plan.transfers += 1
    plan.transferInfos.push({
      stationId,
      fromLineId: currentLineId,
      toLineId: lineId,
      walkDistance: transferWalkDistance(stationName(stationId))
    })
    currentLineId = lineId
    segmentStartId = stationId
  }

  const lastStationId = stations[graph.stationOf(path[path.length - 1])].id
  if (segmentStartId !== lastStationId) {
    plan.segments.push(makeSegment(currentLineId, segmentStartId, lastStationId))
  }

  // 汇总：站数 / 总时间 / 步行距离
  let sumStopCount = 0
  for (const seg of plan.segments) sumStopCount += seg.stopCount

  const halfMinutes = plan.segments.reduce((acc, s) => acc + s.stopCount * HALF_PER_STOP, 0)
  let duration = plan.segments.reduce((acc, s) => acc + s.duration, 0)

  plan.halfMinutes = halfMinutes + plan.transfers * HALF_PER_TRANSFER
  plan.duration = duration + plan.transfers * displayMinutes(HALF_PER_TRANSFER)

  const walk = plan.transferInfos.reduce((acc, info) => acc + info.walkDistance, 0)
  // 途经站数：各段站数之和减去被重复计入的换乘站
  plan.stops = plan.segments.length ? sumStopCount - (plan.segments.length - 1) : 0
  plan.walkDistance = walk + plan.stops * WALK_PER_STOP
  return plan
}

const signatureOf = (plan) =>
  plan.segments.map((s) => `${s.lineId}:${s.fromId}>${s.toId};`).join('')

//途经站序（换乘站只保留一次） 
function planStationIds(plan) {
  const ids = []
  for (const segment of plan.segments) {
    const line = lineById(segment.lineId)
    if (!line) continue
    const fromIndex = indexOfStationOnLine(segment.lineId, segment.fromId)
    const toIndex = indexOfStationOnLine(segment.lineId, segment.toId)
    if (fromIndex < 0 || toIndex < 0) continue
    const step = toIndex >= fromIndex ? 1 : -1
    for (let i = fromIndex; ; i += step) {
      const id = line.stations[i]
      if (ids[ids.length - 1] !== id) ids.push(id)
      if (i === toIndex) break
    }
  }
  return ids
}

//排序

function planScore(plan, mode) {
  if (mode === 'lessTransfer') return 60 * plan.transfers + plan.halfMinutes
  if (mode === 'lessWalk') return 4 * plan.walkDistance + plan.halfMinutes
  return plan.halfMinutes
}

function sortPlans(plans, mode) {
  plans.sort((a, b) => {
    const diff = planScore(a, mode) - planScore(b, mode)
    if (diff !== 0) return diff
    if (a.transfers !== b.transfers) return a.transfers - b.transfers
    if (a.halfMinutes !== b.halfMinutes) return a.halfMinutes - b.halfMinutes
    return String(a.planId || '').localeCompare(String(b.planId || ''))
  })
}

//对外接口
function validateStationPair(fromId, toId) {
  if (!fromId || !toId) throw apiError('EMPTY_INPUT', '请输入起点和终点后再查询。')
  if (!stationById(fromId)) throw apiError('STATION_NOT_FOUND', `没有找到起点站（${fromId}）`)
  if (!stationById(toId)) throw apiError('STATION_NOT_FOUND', `没有找到终点站（${toId}）`)
  if (fromId === toId)
    throw apiError('SAME_STATION', `起点和终点相同，请重新选择。（${stationName(fromId)}）`)
}

function validateMode(mode) {
  if (!MODES.includes(mode)) {
    throw apiError(
      'BAD_MODE',
      `排序方式仅支持 推荐 / 少换乘 / 少步行，请重新选择。（收到的 mode = ${mode}）`
    )
  }
}

// 补上页面渲染用的线路名、颜色、站点名 
function planToJson(plan) {
  return {
    planId: plan.planId,
    mode: plan.mode,
    duration: plan.duration,
    stops: plan.stops,
    transfers: plan.transfers,
    walkDistance: plan.walkDistance,
    strategy: plan.strategy,
    segments: plan.segments.map((s) => ({
      lineId: s.lineId,
      lineName: lineById(s.lineId)?.name || '',
      lineColor: lineColor(s.lineId),
      fromId: s.fromId,
      fromName: stationName(s.fromId),
      toId: s.toId,
      toName: stationName(s.toId),
      direction: s.direction,
      stopCount: s.stopCount,
      duration: s.duration
    })),
    transferDetails: plan.transferInfos.map((info) => ({
      stationId: info.stationId,
      stationName: stationName(info.stationId),
      fromLineId: info.fromLineId,
      fromLineName: lineById(info.fromLineId)?.name || '',
      fromLineColor: lineColor(info.fromLineId),
      toLineId: info.toLineId,
      toLineName: lineById(info.toLineId)?.name || '',
      toLineColor: lineColor(info.toLineId),
      walkDistance: info.walkDistance
    })),
    stations: planStationIds(plan).map((id) => ({ id, name: stationName(id) }))
  }
}

/**
 * 路线规划主入口（与后台 /api/plans 返回结构一致）
 * @param {{from: string, to: string, mode?: string}} params from/to 支持站点 ID、站名、拼音、首字母
 * @returns {{fromId:string,toId:string,fromName:string,toName:string,mode:string,plans:Array,count:number}}
 */
export function calcRoutes({ from, to, mode = 'recommended' }) {
  validateMode(mode)
  validateStationPair(from, to)

  const fromStation = stationIndex.get(from)
  const toStation = stationIndex.get(to)
  const candidates = []
  const seen = new Set()

  const collect = (plan) => {
    const signature = signatureOf(plan)
    if (!signature || seen.has(signature)) return
    seen.add(signature)
    candidates.push(plan)
  }

  const graph = buildGraph()
  const specs = [
    { profile: PROFILE.TIME, label: '推荐（总耗时最短）' },
    { profile: PROFILE.FEWER_TRANSFER, label: '少换乘' },
    { profile: PROFILE.LESS_WALK, label: '少步行' }
  ]

  for (const spec of specs) {
    const path = dijkstra(graph, fromStation, toStation, spec.profile)
    if (!path.length) continue
    collect({ ...buildPlan(graph, path), mode, strategy: spec.label })
  }

  // 保底：BFS 分层方案（与 Dijkstra 结果不同才保留）
  const bfsPath = layeredBfs(graph, fromStation, toStation)
  if (bfsPath.length) {
    collect({ ...buildPlan(graph, bfsPath), mode, strategy: '最少站数（BFS 分层）' })
  }

  // 备选方案池：禁用某个换乘站 / 某条线路后重算，让三种排序真正排出不同顺序
  if (candidates.length) {
    const bestTransfers = candidates[0].transferInfos.slice()
    const bestDuration = candidates[0].duration
    // 只保留「不比最优方案慢太多」的备选，避免把绕远路方案塞进列表
    const durationCeiling = Math.max(bestDuration + 15, Math.floor((bestDuration * 3) / 2))

    const tryAlternative = (blockedStations, blockedLines, strategy) => {
      if (candidates.length >= MAX_PLANS) return false
      const alternative = buildGraph(blockedStations, blockedLines)
      const path = dijkstra(alternative, fromStation, toStation, PROFILE.TIME)
      if (!path.length) return false
      const plan = buildPlan(alternative, path)
      if (plan.duration > durationCeiling) return false
      const before = candidates.length
      collect({ ...plan, mode, strategy })
      return candidates.length > before
    }

    // 第一优先：避开最优方案自己的换乘站
    for (const info of bestTransfers) {
      const si = stationIndex.get(info.stationId)
      if (si === undefined) continue
      tryAlternative(new Set([si]), new Set(), `备选（避开 ${stationName(info.stationId)} 换乘）`)
    }
    // 第二优先：避开其它换乘站
    for (let si = 0; si < STATION_COUNT && candidates.length < MAX_PLANS; si += 1) {
      if (stations[si].lineIds.length < 2) continue
      tryAlternative(new Set([si]), new Set(), `备选（避开 ${stations[si].name} 换乘）`)
    }
    // 第三优先：整条线路不可用时改走别的线路
    for (let li = 0; li < LINE_COUNT && candidates.length < MAX_PLANS; li += 1) {
      tryAlternative(new Set(), new Set([li]), `备选（避开 ${lines[li].name}，改走其它线路）`)
    }
  }

  if (!candidates.length) {
    throw apiError(
      'NO_ROUTE',
      `当前条件下没有可用路线，请更换起点或终点。（${stationName(from)} -> ${stationName(to)}）`
    )
  }

  sortPlans(candidates, mode)

  // 首条方案的策略文案与当前排序口径保持一致
  if (mode === 'lessTransfer') {
    candidates[0].strategy = `少换乘优先（${candidates[0].transfers} 次换乘）`
  } else if (mode === 'lessWalk') {
    candidates[0].strategy = `少步行优先（步行 ${candidates[0].walkDistance} 米）`
  }

  candidates.forEach((plan, i) => {
    plan.planId = `p${i + 1}`
  })

  return {
    fromId: from,
    toId: to,
    fromName: stationName(from),
    toName: stationName(to),
    mode,
    plans: candidates.map(planToJson),
    count: candidates.length
  }
}
