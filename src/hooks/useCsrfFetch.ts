/**
 * CSRF-protected fetch hook
 * 
 * Automatically includes CSRF token in all mutating requests (POST, PUT, DELETE, PATCH)
 * This ensures protection against Cross-Site Request Forgery attacks
 */

import { useCallback, useEffect, useState } from 'react'

// Cache the CSRF token to avoid repeated fetches
let cachedCsrfToken: string | null = null

export function useCsrfFetch() {
  const [csrfToken, setCsrfToken] = useState<string | null>(cachedCsrfToken)

  // Fetch CSRF token on mount if not cached
  useEffect(() => {
    if (!cachedCsrfToken) {
      fetch('/api/csrf')
        .then(res => res.json())
        .then(data => {
          if (data.success && data.token) {
            cachedCsrfToken = data.token
            setCsrfToken(data.token)
          }
        })
        .catch(err => {
          console.error('Failed to fetch CSRF token:', err)
        })
    }
  }, [])

  // CSRF-protected fetch wrapper
  const csrfFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    const method = (options.method || 'GET').toUpperCase()
    const isMutatingRequest = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)

    // For mutating requests, include CSRF token
    if (isMutatingRequest) {
      // If we don't have a token yet, fetch one
      let token = cachedCsrfToken || csrfToken
      
      if (!token) {
        try {
          const csrfRes = await fetch('/api/csrf')
          const csrfData = await csrfRes.json()
          if (csrfData.success && csrfData.token) {
            token = csrfData.token
            cachedCsrfToken = token
            setCsrfToken(token)
          }
        } catch (err) {
          console.error('Failed to fetch CSRF token before request:', err)
        }
      }

      // Merge headers with CSRF token
      options.headers = {
        ...options.headers,
        'X-CSRF-Token': token || '',
      }
    }

    return fetch(url, options)
  }, [csrfToken])

  return { csrfFetch, csrfToken }
}

// Simple utility function for one-off use (no hook needed)
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()
  const isMutatingRequest = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)

  if (isMutatingRequest) {
    // Get CSRF token if not cached
    if (!cachedCsrfToken) {
      try {
        const csrfRes = await fetch('/api/csrf')
        const csrfData = await csrfRes.json()
        if (csrfData.success && csrfData.token) {
          cachedCsrfToken = csrfData.token
        }
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err)
      }
    }

    options.headers = {
      ...options.headers,
      'X-CSRF-Token': cachedCsrfToken || '',
    }
  }

  return fetch(url, options)
}
