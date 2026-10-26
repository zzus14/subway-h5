import { reactive } from 'vue'
import { storage } from '../utils/storage'

/**
 * 搜索历史 全局状态（localStorage 持久化）
 */
const state = reactive({
  searchHistory: storage.get('searchHistory', []) // 字符串[]
})

function persist() {
  storage.set('searchHistory', state.searchHistory)
}

export function useStore() {
  const addHistory = (kw) => {
    if (!kw) return
    const list = state.searchHistory.filter((h) => h !== kw)
    list.unshift(kw)
    state.searchHistory = list.slice(0, 10)
    persist()
  }

  const clearHistory = () => {
    state.searchHistory = []
    persist()
  }

  return {
    state,
    addHistory,
    clearHistory
  }
}
