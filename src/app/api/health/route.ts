import { NextResponse } from 'next/server'
import { sqlClient } from '@/db'
import { isDatabaseReady, initializeDatabase } from '@/lib/auto-init'

// Health check endpoint for load balancers and monitoring
// Returns minimal information for security
export async function GET() {
  try {
    // Check if database is ready
    const ready = await isDatabaseReady()
    
    if (!ready) {
      // Try to auto-initialize
      await initializeDatabase()
    }
    
    // Test database connection with a simple query
    await sqlClient`SELECT 1 as test`
    
    // Return minimal health info - no sensitive data exposed
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    }, { status: 200 })
  } catch (error) {
    // Return minimal error info
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    }, { status: 503 })
  }
}
