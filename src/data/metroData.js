import rawStations from './stations.json'
import rawLines from './lines.json'
import { LINE_LAYOUT, LAYOUT_WIDTH, LAYOUT_HEIGHT, LABEL_HINTS } from './schematicLayout'

export const stations = rawStations
export const lines = rawLines

const stationIndexById = new Map(stations.map((s, i) => [s.id, i]))
const lineIndexById = new Map(lines.map((l, i) => [l.id, i]))

//基础查询

export const stationById = (id) =>
  stationIndexById.has(id) ? stations[stationIndexById.get(id)] : null
export const lineById = (id) => (lineIndexById.has(id) ? lines[lineIndexById.get(id)] : null)

export const stationName = (id) => {
  const station = stationById(id)
  return station ? station.name : ''
}
export const lineColor = (id) => {
  const line = lineById(id)
  return line ? line.color : '#999999'
}

// 站点所属线路（返回原始线路对象)
function linesOfStation(stationId) {
  const station = stationById(stationId)
  if (!station) return []
  return station.lineIds.map(lineById).filter(Boolean)
}

// 站点在某条线路上的站序（不在该线路上返回 -1）  
export function indexOfStationOnLine(lineId, stationId) {
  const line = lineById(lineId)
  if (!line) return -1
  return line.stations.indexOf(stationId)
}

//模拟票价：站数越多票价越高，封顶 8 元 
function totalPriceOf(line) {
  return Math.min(8, 2 + Math.floor(line.stations.length / 8))
}

//模拟发车间隔（分钟)
function intervalOf(line) {
  const intervals = [4, 5, 6, 5, 4, 6, 5, 4]
  return `${intervals[Math.abs(line.stations.length) % 8]}分钟`
}

//线路摘要（站点详情页「途经线路」用）
function lineBrief(line) {
  return {
    id: line.id,
    name: line.name,
    color: line.color,
    type: String(line.name).includes('轻轨') ? '轻轨' : '地铁',
    startStop: stationName(line.stations[0]),
    endStop: stationName(line.stations[line.stations.length - 1]),
    startTime: line.firstLastTime.first,
    endTime: line.firstLastTime.last,
    basicPrice: '2',
    totalPrice: String(totalPriceOf(line)),
    interval: intervalOf(line),
    // 线路元信息：开通日期 / 里程 / 是否新开通（5、7 号线）
    openedAt: line.openedAt || '',
    lengthKm: line.lengthKm || 0,
    isNew: !!line.isNew
  }
}

// 线路完整数据（线路详情页：含有序站序 busstops）
export function lineFull(line) {
  return {
    ...lineBrief(line),
    busstops: line.stations.map((id) => ({
      id,
      name: stationName(id),
      transfer: isTransferStation(id)
    })),
    stationCount: line.stations.length
  }
}

// 站点完整数据（搜索 / 站点详情 / 地图）
export function stationFull(station) {
  return {
    id: station.id,
    name: station.name,
    pinyin: station.pinyin,
    short: station.short,
    lines: linesOfStation(station.id).map(lineBrief),
    firstLast: { first: station.firstLast.first, last: station.firstLast.last },
    exits: station.exits.slice(),
    // 新开通的出入口（如 1 号线红嘴子站 A、D 口，2026-09-28 启用）
    newExits: (station.newExits || []).slice(),
    // open = 正常运营；pending = 车站已建成但暂缓开通（如 5 号线长影旧址博物馆站）
    status: station.status || 'open'
  }
}

const isTransferStation = (stationId) => {
  const station = stationById(stationId)
  return !!station && station.lineIds.length > 1
}

export const allStationsFull = () => stations.map(stationFull)
export const allLinesFull = () => lines.map(lineFull)

//搜索 

//匹配打分：数字越小越靠前，-1 表示不匹配
function matchScore(station, keyword) {
  const name = station.name
  const pinyin = station.pinyin
  const initials = station.short
  if (name === keyword) return 0
  if (name.startsWith(keyword)) return 1
  if (name.includes(keyword)) return 2
  if (pinyin === keyword) return 3
  if (pinyin.startsWith(keyword)) return 4
  if (initials === keyword) return 5
  if (initials.startsWith(keyword)) return 6
  if (pinyin.includes(keyword)) return 7
  if (initials.includes(keyword)) return 8
  return -1
}

//站点模糊搜索：站名 / 拼音 / 首字母 
export function searchStations(keyword) {
  const key = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!key) return []
  return stations
    .map((station, index) => ({ station, index, score: matchScore(station, key) }))
    .filter((hit) => hit.score >= 0)
    .sort((a, b) => a.score - b.score || a.station.name.localeCompare(b.station.name, 'zh'))
    .map((hit) => hit.station)
}

export function resolveStationToken(token) {
  const trimmed = String(token || '').trim()
  if (!trimmed) throw apiError('EMPTY_INPUT', '请输入起点和终点后再查询。')
  if (stationById(trimmed)) return trimmed

  const exact = stations.find((s) => s.name === trimmed)
  if (exact) return exact.id

  const hits = searchStations(trimmed)
  if (!hits.length) {
    throw apiError(
      'STATION_NOT_FOUND',
      `没有匹配到该站点，请换一个站名、拼音或首字母试试。（${trimmed}）`
    )
  }
  return hits[0].id
}

//错误 
export function apiError(code, message) {
  const error = new Error(message || '操作失败，请稍后重试。')
  error.code = code
  return error
}

//到站信息
export function arrivalsOfStation(stationId) {
  const station = stationById(stationId)
  if (!station) return []
  return linesOfStation(stationId).map((line, i) => {
    const index = indexOfStationOnLine(line.id, stationId)
    const forward = index * 2 < line.stations.length
    const dest = stationName(forward ? line.stations[line.stations.length - 1] : line.stations[0])
    const minutes = ((Math.abs(index) + i * 2) % 6) + 1
    return {
      lineId: line.id,
      lineName: line.name,
      color: line.color,
      dest,
      stations: minutes <= 1 ? 0 : Math.floor(minutes / 2),
      time: minutes,
      state: minutes <= 1 ? '即将进站' : `下一班·${minutes}分钟`,
      crowd: ['0', '1', '2'][i % 3],
      simulated: true
    }
  })
}

//线网示意图 
export function buildSchematic() {
  const warnings = []

  const linesOut = lines.map((line) => {
    const spec = LINE_LAYOUT[line.id]
    const ids = line.stations
    if (!spec) {
      warnings.push(`线路 ${line.id} 缺少布局定义`)
      return { id: line.id, name: line.name, color: line.color, points: [], stops: [] }
    }

    const points = []
    const idsOut = []
    let cursor = 0 // 已消费到第几个站

    for (const [stationId, x, y] of spec) {
      if (stationId) {
        if (ids[cursor] !== stationId) {
          warnings.push(
            `${line.id} 站序不符：布局给 ${stationId}，数据应为 ${ids[cursor] || '(无)'}`
          )
        }
        cursor++
        points.push([x, y])
        idsOut.push(stationId)
      }
    }

    if (cursor !== ids.length) {
      warnings.push(`${line.id} 布局覆盖 ${cursor} 站，数据有 ${ids.length} 站`)
    }

    return {
      id: line.id,
      name: line.name,
      color: line.color,
      points,
      stops: idsOut.map((id) => {
        const s = stationById(id)
        return {
          id,
          name: s ? s.name : id,
          transfer: s ? s.lineIds.length > 1 : false,
          // 官方图该站名的落点 [anchor, x, y]；有就按它排，没有则自动避让
          label: LABEL_HINTS[id] || null
        }
      })
    }
  })

  if (warnings.length && typeof console !== 'undefined') {
    console.warn('[schematic] 布局校验告警：\n' + warnings.join('\n'))
  }

  return {
    width: LAYOUT_WIDTH,
    height: LAYOUT_HEIGHT,
    lines: linesOut
  }
}

//元信息 

//热门搜索：换乘站优先，取前 8 个
function hotSearchList() {
  const hot = []
  for (const station of stations) {
    if (hot.length >= 8) break
    if (station.lineIds.length < 2) continue
    hot.push(station.name)
  }
  return hot
}

export const hotSearches = hotSearchList()
