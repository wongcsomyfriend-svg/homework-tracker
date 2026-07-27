import { useEffect, useState } from 'react'
import {
  getData,
  getStorageModeLabel,
  readyStorage,
  subscribe,
} from '../lib/store'
import type { AppData } from '../lib/types'

export function useData(): AppData & {
  storageReady: boolean
  storageError: string
  storageMode: string
} {
  const [data, setData] = useState(getData)
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [storageMode, setStorageMode] = useState(getStorageModeLabel)

  useEffect(() => {
    let cancelled = false
    readyStorage()
      .then(() => {
        if (cancelled) return
        setData(getData())
        setStorageMode(getStorageModeLabel())
        setStorageReady(true)
        setStorageError('')
      })
      .catch((err) => {
        if (cancelled) return
        setStorageReady(true)
        setStorageError(err instanceof Error ? err.message : '儲存層載入失敗')
        setData(getData())
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => subscribe(() => setData(getData())), [])

  return { ...data, storageReady, storageError, storageMode }
}
