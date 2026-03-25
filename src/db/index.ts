import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ============================================
// DATABASE CONFIGURATION
// ============================================
// Get database URL from environment variable ONLY
// NEVER hardcode credentials in source code
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Create postgres connection - OPTIMIZED for production
// Connection pool settings for better performance
const isProduction = process.env.NODE_ENV === 'production'

const client = postgres(DATABASE_URL, { 
  ssl: 'require',
  // Connection pool - more connections for production = faster concurrent queries
  max: isProduction ? 10 : 3,
  // Idle timeout - close unused connections after 30 seconds
  idle_timeout: 30,
  // Connect timeout - fail fast if database is unreachable
  connect_timeout: 10,
  // Prepare statements for faster repeated queries
  prepare: true,
  // Transform undefined to null for safer queries
  transform: {
    undefined: null
  }
})
const dbInstance = drizzle(client, { schema })

export const db = dbInstance
export const sqlClient = client // Export for raw SQL execution

// ============================================
// AUTO-INITIALIZATION ON FIRST DB ACCESS
// ============================================
// This ensures tables are created even if instrument.ts didn't run

declare global {
  var __settingsCache: { data: any; timestamp: number } | undefined
  var __shopDataCache: { data: any; timestamp: number } | undefined
  var __dashboardCache: { data: any; timestamp: number; timeFrame: string } | undefined
  var __courierCredentials: { data: any; timestamp: number } | undefined
  var __dbAutoInitialized: boolean | undefined
}

// Auto-initialize on first import (fallback mechanism)
async function autoInitFallback() {
  if (globalThis.__dbAutoInitialized) return
  
  try {
    // Check if tables exist
    const result = await client`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'settings'
      LIMIT 1
    `
    
    if (result.length === 0) {
      console.log('[DB] Tables not found, running auto-init...')
      
      // Import and run initialization
      const { initializeDatabase } = await import('@/lib/auto-init')
      await initializeDatabase()
    }
    
    globalThis.__dbAutoInitialized = true
  } catch (error) {
    console.error('[DB] Auto-init fallback error:', error)
  }
}

// Run auto-init in background (non-blocking)
autoInitFallback().catch(console.error)

// ============================================
// Global caches that persist across requests
// ============================================

// Cache getters/setters
export function getCachedSettings() {
  return globalThis.__settingsCache || null
}

export function setCachedSettings(data: any) {
  globalThis.__settingsCache = { data, timestamp: Date.now() }
}

export function getCachedShopData() {
  return globalThis.__shopDataCache || null
}

export function setCachedShopData(data: any) {
  globalThis.__shopDataCache = { data, timestamp: Date.now() }
}

export function getCachedDashboard(timeFrame: string) {
  const cache = globalThis.__dashboardCache
  if (cache && cache.timeFrame === timeFrame) {
    return cache
  }
  return null
}

export function setCachedDashboard(data: any, timeFrame: string) {
  globalThis.__dashboardCache = { data, timestamp: Date.now(), timeFrame }
}

export function getCachedCourierCredentials() {
  return globalThis.__courierCredentials || null
}

export function setCachedCourierCredentials(data: any) {
  globalThis.__courierCredentials = { data, timestamp: Date.now() }
}

// Clear all caches (useful for testing or forced refresh)
export function clearAllCaches() {
  globalThis.__settingsCache = undefined
  globalThis.__shopDataCache = undefined
  globalThis.__dashboardCache = undefined
  globalThis.__courierCredentials = undefined
}

// Clear shop data cache only (used when admin updates products/categories)
export function clearShopDataCache() {
  globalThis.__shopDataCache = undefined
}

// Re-export schema
export * from './schema'
export type Database = typeof db
