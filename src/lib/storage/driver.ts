import { supabase, supabaseConfigured } from '../supabase'
import type { StorageAdapter, StorageDriver } from './adapter'
import { createLocalAdapter } from './localAdapter'
import { createSupabaseAdapter } from './supabaseAdapter'

function resolveDriver(): StorageDriver {
  const requested = (import.meta.env.VITE_STORAGE_DRIVER as string | undefined)
    ?.trim()
    .toLowerCase()
  if (requested === 'supabase') {
    if (!supabaseConfigured || !supabase) {
      console.warn(
        '[storage] VITE_STORAGE_DRIVER=supabase but Supabase env is missing; falling back to local',
      )
      return 'local'
    }
    return 'supabase'
  }
  return 'local'
}

let adapter: StorageAdapter | null = null

export function getStorageDriver(): StorageDriver {
  return resolveDriver()
}

export function getAdapter(): StorageAdapter {
  if (!adapter) {
    const driver = resolveDriver()
    adapter =
      driver === 'supabase' && supabase
        ? createSupabaseAdapter(supabase)
        : createLocalAdapter()
  }
  return adapter
}

export function getStorageModeLabel(): string {
  return getAdapter().driver === 'supabase' ? '雲端模式（Supabase）' : '本機模式'
}
