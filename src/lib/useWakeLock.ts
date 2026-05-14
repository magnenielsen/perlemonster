import { useState, useEffect, useRef, useCallback } from 'react'

export function useWakeLock() {
  const [active, setActive] = useState(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)
  const wantActive = useRef(false)

  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

  const acquire = useCallback(async () => {
    if (!supported) return
    try {
      sentinelRef.current = await navigator.wakeLock.request('screen')
      sentinelRef.current.addEventListener('release', () => {
        setActive(false)
        sentinelRef.current = null
      })
      setActive(true)
    } catch {
      setActive(false)
    }
  }, [supported])

  const release = useCallback(() => {
    sentinelRef.current?.release()
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
        acquire()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [acquire])

  // Release on unmount
  useEffect(() => () => { sentinelRef.current?.release() }, [])

  return { supported, active, toggle }
}
