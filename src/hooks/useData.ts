import { useEffect, useState } from 'react'
import { getData, subscribe } from '../lib/store'
import type { AppData } from '../lib/types'

export function useData(): AppData {
  const [data, setData] = useState(getData)
  useEffect(() => subscribe(() => setData(getData())), [])
  return data
}
