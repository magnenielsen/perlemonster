import { useState, useEffect, useRef, useCallback } from 'react'

export function useWakeLock() {
  const [active, setActive] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const wantActive = useRef(false)

  const supported = 'wakeLock' in navigator

  const acquire = useCallback(async () => {
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      sentinel.addEventListener('release', () => {
        setActive(false)
        sentinelRef.current = null
      })
      setActive(true)
    } catch {
      setActive(false)
    }
  }, [])

  const release = useCallback(() => {
    sentinelRef.current?.release().catch(() => undefined)
    sentinelRef.current = null
    setActive(false)
  }, [])

  const toggle = useCallback(() => {
    if (wantActive.current) {
      wantActive.current = false
      release()
    } else {
      wantActive.current = true
      acquire()
    }
  }, [acquire, release])

  // Re-acquire after tab becomes visible again (browser releases on blur)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && wantActive.current && !sentinelRef.current) {
        acquire().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [acquire])

  // Release on unmount
  useEffect(() => () => { sentinelRef.current?.release().catch(() => undefined) }, [])

  return { supported, active, toggle }
}
