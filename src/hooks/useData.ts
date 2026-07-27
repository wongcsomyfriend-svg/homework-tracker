import { useEffect, useState } from 'react'
import {
  getData,
  getStorageModeLabel,
  getWorkspaceState,
  readyStorage,
  subscribe,
} from '../lib/store'
import type { AppData, WorkspaceState } from '../lib/types'

export function useData(): AppData & {
  storageReady: boolean
  storageError: string
  storageMode: string
  workspaceState: WorkspaceState
} {
  const [data, setData] = useState(getData)
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [storageMode, setStorageMode] = useState(getStorageModeLabel)
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(
    getWorkspaceState,
  )

  useEffect(() => {
    let cancelled = false
    readyStorage()
      .then(() => {
        if (cancelled) return
        setData(getData())
        setStorageMode(getStorageModeLabel())
        setWorkspaceState(getWorkspaceState())
        setStorageReady(true)
        setStorageError('')
      })
      .catch((err) => {
        if (cancelled) return
        setStorageReady(true)
        setStorageError(err instanceof Error ? err.message : '儲存層載入失敗')
        setData(getData())
        setWorkspaceState(getWorkspaceState())
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () =>
      subscribe(() => {
        setData(getData())
        setWorkspaceState(getWorkspaceState())
      }),
    [],
  )

  return {
    ...data,
    storageReady,
    storageError,
    storageMode,
    workspaceState,
  }
}
