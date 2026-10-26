/**
 * 数据服务层
 *
 * 全部数据来自 src/data/metroData.js
 * 路线规划由 src/utils/routePlan.js 
 *
 * 保留异步签名（返回 Promise）与原有的返回字段，页面调用方式不用改。
 */
import {
  lines,
  stationById,
  lineById,
  stationFull,
  lineFull,
  allStationsFull,
  allLinesFull,
  searchStations,
  arrivalsOfStation,
  resolveStationToken,
  hotSearches,
  apiError
} from '../data/metroData'
import { calcRoutes } from '../utils/routePlan'
import { news } from '../data/mockData'

// 模拟一次异步加载（保留页面骨架屏 / loading 的观感） 
const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

// 保证本地计算也在微任务之外执行，页面 onMounted 里的 await 行为与之前一致 
async function local(loader, ms = 120) {
  await delay(ms)
  return loader()
}

// 浏览类接口 

export const api = {
  // 综合搜索：站点 + 线路 
  async search(keywords) {
    const kw = String(keywords || '').trim()
    if (!kw) return { stops: [], lines: [] }
    return local(() => {
      const lower = kw.toLowerCase()
      return {
        stops: searchStations(kw).map(stationFull),
        lines: lines
          .filter((line) => {
            const startName = line.stations.length ? stationById(line.stations[0]).name : ''
            const endName = line.stations.length
              ? stationById(line.stations[line.stations.length - 1]).name
              : ''
            return (
              line.name.includes(kw) ||
              startName.includes(kw) ||
              endName.includes(kw) ||
              line.name.toLowerCase().includes(lower)
            )
          })
          .map(lineFull)
      }
    }, 100)
  },

  async getStopById(id) {
    return local(() => {
      const station = stationById(id)
      return station ? stationFull(station) : null
    }, 60)
  },

  async getLineById(id) {
    return local(() => {
      const line = lineById(id)
      return line ? lineFull(line) : null
    }, 60)
  },

  async getAllStops() {
    return local(allStationsFull, 60)
  },

  async getAllLines() {
    return local(allLinesFull, 60)
  },

  //某站点的到站信息（站点详情页用） 
  async getArrivals(stationId) {
    return local(() => arrivalsOfStation(stationId), 60)
  },

  getNews() {
    return news
  },

  getHotSearches() {
    return hotSearches
  }
}

// 算路接口 

/**
 * 路线规划（本地计算）
 * @param {{from: string, to: string, mode?: string}} params
 *        from/to 支持站点 ID、中文站名、全拼、首字母
 * @returns {Promise<{fromName:string,toName:string,fromId:string,toId:string,mode:string,plans:Array}>}
 */
export async function getPlans({ from, to, mode = 'recommended' }) {
  await delay(160)
  const fromId = resolveStationToken(from)
  const toId = resolveStationToken(to)
  try {
    return calcRoutes({ from: fromId, to: toId, mode })
  } catch (error) {
    if (error && error.code) throw error
    throw apiError('CALC_FAILED', '路线计算失败，请调整起终点后重试。')
  }
}

export const MODE_OPTIONS = [
  { key: 'recommended', label: '推荐', desc: '总耗时最短' },
  { key: 'lessTransfer', label: '少换乘', desc: '换乘次数优先' },
  { key: 'lessWalk', label: '少步行', desc: '步行距离优先' }
]
