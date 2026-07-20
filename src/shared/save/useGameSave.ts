import { useCallback, useEffect, useRef, useState } from 'react'
import {
  callAigramAPI,
  postAigramAPI,
  isInAigram,
  telegramId,
  type AigramResponse,
} from '../runtime/bridge'
import { getGameUuid } from '../runtime/game-id'

interface SaveRow {
  user_id: string
  time: string
  resource_data: string
}

export interface UseGameSave<T> {
  savedData: T | null | undefined
  loaded: boolean
  hasSave: boolean
  persist: (data: T) => void
  clear: () => Promise<void>
}

export function useGameSave<T>(gameId: string): UseGameSave<T> {
  const [savedData, setSavedData] = useState<T | null | undefined>(undefined)
  const lsKey = `${gameId}-save`
  const sessionId = getGameUuid()
  const canSync = isInAigram && !!sessionId && !!telegramId
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDataRef = useRef<T | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (canSync && sessionId && telegramId) {
        try {
          const res = await callAigramAPI<AigramResponse<SaveRow[]>>(
            `/note/aigram/ai/game/get/data/list?session_id=${encodeURIComponent(sessionId)}`,
            'GET',
          )
          const rows = Array.isArray(res?.data) ? res.data : []
          const mine = rows.find((row) => row.user_id === telegramId)
          if (mine?.resource_data) {
            try {
              const save = JSON.parse(mine.resource_data) as T
              if (!cancelled) setSavedData(save)
              return
            } catch { /* corrupt cloud save falls back to local */ }
          }
        } catch { /* bridge/network failure falls back to local */ }
      }
      try {
        const raw = localStorage.getItem(lsKey)
        if (raw) {
          const save = JSON.parse(raw) as T
          if (!cancelled) setSavedData(save)
          return
        }
      } catch { /* corrupt local save falls through */ }
      if (!cancelled) setSavedData(null)
    })()
    return () => { cancelled = true }
  }, [canSync, sessionId, lsKey])

  const flushCloud = useCallback(() => {
    const payload = pendingDataRef.current
    pendingDataRef.current = null
    cloudTimerRef.current = null
    if (payload == null || !canSync || !sessionId) return
    postAigramAPI('/note/aigram/ai/game/save/data', {
      session_id: sessionId,
      resource_data: JSON.stringify(payload),
    })
  }, [canSync, sessionId])

  const persist = useCallback((data: T) => {
    const withTs = { ...(data as object), _lastActive: Date.now() } as T
    try { localStorage.setItem(lsKey, JSON.stringify(withTs)) } catch { /* storage is optional */ }
    if (canSync) {
      pendingDataRef.current = withTs
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current)
      cloudTimerRef.current = setTimeout(flushCloud, 1000)
    }
  }, [canSync, lsKey, flushCloud])

  useEffect(() => () => {
    if (!cloudTimerRef.current) return
    clearTimeout(cloudTimerRef.current)
    flushCloud()
  }, [flushCloud])

  const clear = useCallback(async () => {
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current)
    cloudTimerRef.current = null
    pendingDataRef.current = null
    try { localStorage.removeItem(lsKey) } catch { /* ignore */ }
    if (canSync && sessionId) {
      postAigramAPI('/note/aigram/ai/game/save/data', { session_id: sessionId, resource_data: '' })
    }
    setSavedData(null)
  }, [canSync, sessionId, lsKey])

  return { savedData, loaded: savedData !== undefined, hasSave: savedData != null, persist, clear }
}
