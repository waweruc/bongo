'use client'

import type { BaseMessage } from '@langchain/core/messages'
import {
  coerceMessageLikeToMessage,
  isHumanMessage,
} from '@langchain/core/messages'
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { LG_INITIAL_MESSAGE_PREFIX } from '../../../../constants/storageKeys'

/**
 * useStream-specific sessionStorage reading hook
 * Reads initial message once and deletes it
 */
export function useSessionStorageOnce(
  designSessionId: string,
): BaseMessage | null {
  const key = `${LG_INITIAL_MESSAGE_PREFIX}:${designSessionId}`

  const subscribe = useCallback((_callback: () => void) => {
    // sessionStorage does not fire events within the same tab
    return () => {}
  }, [])

  const cacheRef = useRef<{ raw: string; message: BaseMessage | null } | null>(
    null,
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return null
    const stored = sessionStorage.getItem(key)
    if (!stored) return null

    // useSyncExternalStore requires a referentially stable snapshot when the
    // underlying source hasn't changed, so cache by the raw string instead of
    // parsing (and allocating a new message object) on every call.
    if (cacheRef.current?.raw === stored) {
      return cacheRef.current.message
    }

    let message: BaseMessage | null
    try {
      const parsed = JSON.parse(stored)
      const coerced = coerceMessageLikeToMessage(parsed)
      message = isHumanMessage(coerced) ? coerced : null
    } catch {
      message = null
    }

    cacheRef.current = { raw: stored, message }
    return message
  }, [key])

  const getServerSnapshot = useCallback(() => null, [])

  const message = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  const wasDeleted = useRef(false)
  useEffect(() => {
    if (!wasDeleted.current && message !== null) {
      sessionStorage.removeItem(key)
      wasDeleted.current = true
    }
  }, [message, key])

  return message
}
