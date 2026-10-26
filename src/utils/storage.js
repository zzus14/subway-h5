/**
 * 本地持久化工具 —— 仿原版 PersistenceV2/preferences 的浏览器实现（localStorage）
 */
const PREFIX = 'bsh5_'

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch (e) {
      return fallback
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch (e) {
      /* 忽略写入失败 */
    }
  }
}
