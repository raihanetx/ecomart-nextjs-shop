import { NextRequest, NextResponse } from 'next/server'
import { db, getCachedSettings, setCachedSettings } from '@/db'
import { settings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword, isHashed } from '@/lib/auth'
import { encrypt, safeDecrypt, isEncrypted, auditLog } from '@/lib/security'
import { isApiAuthenticated, authErrorResponse } from '@/lib/api-auth'
import { sanitizeString, checkRateLimit, rateLimitErrorResponse } from '@/lib/validation'
import { isPasswordStrongEnough } from '@/lib/password-strength'

// Check if value is a masked placeholder (should never be saved)
const isMaskedPlaceholder = (value: string): boolean => {
  return value === '••••••••••••' || /^•+$/.test(value)
}

// Cache TTL: 10 seconds (reduced for faster updates)
const CACHE_TTL = 10 * 1000

// HTTP Cache settings
const HTTP_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
}

// Pre-built default settings
const DEFAULT_SETTINGS = {
  id: 1,
  websiteName: 'EcoMart',
  slogan: '',
  logoUrl: '',
  faviconUrl: '',
  heroImages: '[]',
  insideDhakaDelivery: '60',
  outsideDhakaDelivery: '120',
  freeDeliveryMin: '500',
  universalDelivery: false,
  universalDeliveryCharge: '60',
  whatsappNumber: '',
  phoneNumber: '',
  facebookUrl: '',
  messengerUsername: '',
  aboutUs: '',
  termsConditions: '',
  refundPolicy: '',
  privacyPolicy: '',
  adminUsername: 'admin',
  adminPassword: '',
  steadfastApiKey: '',
  steadfastSecretKey: '',
  steadfastWebhookUrl: '',
  cloudinaryCloudName: '',
  cloudinaryApiKey: '',
  cloudinaryApiSecret: '',
  firstSectionName: 'Categories',
  firstSectionSlogan: 'Browse by category',
  secondSectionName: 'Offers',
  secondSectionSlogan: 'Exclusive deals for you',
  thirdSectionName: 'Featured',
  thirdSectionSlogan: 'Handpicked products',
  heroAnimationSpeed: 3000,
  heroAnimationType: 'Fade',
  stockLowPercent: 25,
  stockMediumPercent: 50,
}

// Clean base64 from URL fields
function cleanBaseUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('data:image')) return ''
  return url
}

// Filter base64 from hero images
function filterHeroImages(imagesJson: string | null): string[] {
  if (!imagesJson) return []
  try {
    const parsed = JSON.parse(imagesJson)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((img: string) => !img.startsWith('data:image'))
  } catch {
    return []
  }
}

// Decrypt sensitive fields for response (never send to client, only for internal use)
function decryptSettings(rawSettings: any): any {
  return {
    ...rawSettings,
    // Decrypt for internal use, but we won't send these to client
    steadfastApiKey: rawSettings.steadfastApiKey ? (safeDecrypt(rawSettings.steadfastApiKey) || '') : '',
    steadfastSecretKey: rawSettings.steadfastSecretKey ? (safeDecrypt(rawSettings.steadfastSecretKey) || '') : '',
    cloudinaryApiSecret: rawSettings.cloudinaryApiSecret ? (safeDecrypt(rawSettings.cloudinaryApiSecret) || '') : '',
  }
}

// Mask sensitive fields for API response
function maskSensitiveFields(settingsData: any): any {
  return {
    ...settingsData,
    // Never send actual passwords/keys to client, but track if they exist
    adminPassword: settingsData.adminPassword ? '••••••••••••' : '',
    steadfastApiKey: settingsData.steadfastApiKey ? '••••••••••••' : '',
    steadfastSecretKey: settingsData.steadfastSecretKey ? '••••••••••••' : '',
    cloudinaryApiSecret: settingsData.cloudinaryApiSecret ? '••••••••••••' : '',
    // Add "has" flags so frontend knows if values are set
    hasAdminPassword: !!settingsData.adminPassword,
    hasSteadfastApiKey: !!settingsData.steadfastApiKey,
    hasSteadfastSecretKey: !!settingsData.steadfastSecretKey,
    hasCloudinaryApiSecret: !!settingsData.cloudinaryApiSecret,
  }
}

// GET /api/settings
export async function GET(request: NextRequest) {
  const now = Date.now()
  
  // Check if client wants fresh data (bypass cache)
  const url = new URL(request.url)
  const forceFresh = url.searchParams.has('_t') || url.searchParams.get('fresh') === 'true'
  
  const cached = getCachedSettings()
  if (!forceFresh && cached && (now - cached.timestamp) < CACHE_TTL) {
    return NextResponse.json({ 
      success: true, 
      data: maskSensitiveFields(cached.data), 
      cached: true 
    }, { headers: HTTP_CACHE_HEADERS })
  }
  
  try {
    const result = await db.select().from(settings).where(eq(settings.id, 1)).limit(1)
    
    if (result.length === 0) {
      const newSettings = await db.insert(settings).values(DEFAULT_SETTINGS).returning()
      setCachedSettings(newSettings[0])
      return NextResponse.json({ success: true, data: maskSensitiveFields(newSettings[0]) })
    }
    
    const rawSettings = result[0]
    const cleanedSettings = {
      ...rawSettings,
      logoUrl: cleanBaseUrl(rawSettings.logoUrl),
      faviconUrl: cleanBaseUrl(rawSettings.faviconUrl),
      heroImages: JSON.stringify(filterHeroImages(rawSettings.heroImages)),
    }
    
    setCachedSettings(cleanedSettings)
    
    return NextResponse.json({ success: true, data: maskSensitiveFields(cleanedSettings) }, { headers: HTTP_CACHE_HEADERS })
  } catch (error) {
    console.error('Error fetching settings:', error)
    
    if (cached) {
      return NextResponse.json({ 
        success: true, 
        data: maskSensitiveFields(cached.data), 
        cached: true, 
        stale: true 
      }, { headers: HTTP_CACHE_HEADERS })
    }
    
    return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 })
  }
}

// PUT /api/settings (Admin only - changes site configuration)
export async function PUT(request: NextRequest) {
  try {
    // Authentication required for settings changes
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    // Rate limiting: 10 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'
    const rateLimit = checkRateLimit(`settings-update:${ip}`, 10, 60000)
    if (!rateLimit.allowed) {
      return rateLimitErrorResponse(rateLimit.resetAt)
    }

    const body = await request.json()
    const updateData: Record<string, any> = {}
    
    const directFields = [
      'websiteName', 'slogan', 'logoUrl', 'faviconUrl', 'heroImages',
      'insideDhakaDelivery', 'outsideDhakaDelivery', 'freeDeliveryMin',
      'universalDelivery', 'universalDeliveryCharge',
      'whatsappNumber', 'phoneNumber', 'facebookUrl', 'messengerUsername',
      'aboutUs', 'termsConditions', 'refundPolicy', 'privacyPolicy',
      'firstSectionName', 'firstSectionSlogan',
      'secondSectionName', 'secondSectionSlogan',
      'thirdSectionName', 'thirdSectionSlogan',
      'heroAnimationSpeed', 'heroAnimationType',
      'stockLowPercent', 'stockMediumPercent'
    ]
    
    // Text fields that need sanitization (prevent XSS)
    const textFields = [
      'websiteName', 'slogan', 'whatsappNumber', 'phoneNumber', 
      'facebookUrl', 'messengerUsername', 'firstSectionName', 'firstSectionSlogan',
      'secondSectionName', 'secondSectionSlogan', 'thirdSectionName', 'thirdSectionSlogan'
    ]
    
    // Long text fields (allow more characters)
    const longTextFields = ['aboutUs', 'termsConditions', 'refundPolicy', 'privacyPolicy']
    
    for (const field of directFields) {
      if (body[field] !== undefined) {
        // Sanitize text fields to prevent XSS
        if (textFields.includes(field) && typeof body[field] === 'string') {
          updateData[field] = sanitizeString(body[field], 200)
        } else if (longTextFields.includes(field) && typeof body[field] === 'string') {
          updateData[field] = sanitizeString(body[field], 10000) // Allow longer content
        } else {
          updateData[field] = body[field]
        }
      }
    }
    
    // ===== ADMIN CREDENTIALS =====
    if (body.adminUsername !== undefined) {
      const existing = await db.select({ adminUsername: settings.adminUsername }).from(settings).where(eq(settings.id, 1)).limit(1)
      const oldUsername = existing[0]?.adminUsername
      
      // Sanitize username
      updateData.adminUsername = sanitizeString(body.adminUsername, 50)
      updateData.adminUsernameUpdatedAt = new Date().toISOString()
      
      await auditLog({
        action: 'credential_change',
        category: 'admin',
        field: 'adminUsername',
        oldValue: oldUsername || undefined,
        newValue: body.adminUsername,
        ipAddress: ip,
        details: 'Username changed'
      })
    }
    
    // Password: Hash before saving
    if (body.adminPassword !== undefined && body.adminPassword !== '') {
      // SECURITY: Validate password strength
      const passwordCheck = isPasswordStrongEnough(body.adminPassword)
      if (!passwordCheck.valid) {
        return NextResponse.json({ 
          success: false, 
          error: passwordCheck.error || 'Password is too weak. Use 8+ characters with uppercase, lowercase, number, and special character.' 
        }, { status: 400 })
      }
      
      if (!isHashed(body.adminPassword)) {
        updateData.adminPassword = await hashPassword(body.adminPassword)
      } else {
        updateData.adminPassword = body.adminPassword
      }
      updateData.adminPasswordUpdatedAt = new Date().toISOString()
      
      await auditLog({
        action: 'credential_change',
        category: 'admin',
        field: 'adminPassword',
        oldValue: '••••••••',
        newValue: '••••••••',
        ipAddress: ip,
        details: 'Password changed (hashed)'
      })
    }
    
    // ===== STEADFAST COURIER CREDENTIALS =====
    // ENCRYPT sensitive API keys!
    if (body.steadfastApiKey !== undefined && body.steadfastApiKey !== '') {
      // Reject masked values
      if (isMaskedPlaceholder(body.steadfastApiKey)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid API Key value. Please enter a new value.' 
        }, { status: 400 })
      }
      
      const existing = await db.select({ steadfastApiKey: settings.steadfastApiKey }).from(settings).where(eq(settings.id, 1)).limit(1)
      const oldKey = existing[0]?.steadfastApiKey ? (safeDecrypt(existing[0].steadfastApiKey) || '') : ''
      
      updateData.steadfastApiKey = encrypt(body.steadfastApiKey)
      updateData.steadfastApiUpdatedAt = new Date().toISOString()
      
      await auditLog({
        action: 'credential_change',
        category: 'courier',
        field: 'steadfastApiKey',
        oldValue: oldKey,
        newValue: body.steadfastApiKey,
        ipAddress: ip,
        details: 'API Key changed (encrypted)'
      })
    }
    
    if (body.steadfastSecretKey !== undefined && body.steadfastSecretKey !== '') {
      // Reject masked values
      if (isMaskedPlaceholder(body.steadfastSecretKey)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid Secret Key value. Please enter a new value.' 
        }, { status: 400 })
      }
      
      updateData.steadfastSecretKey = encrypt(body.steadfastSecretKey)
      updateData.steadfastApiUpdatedAt = new Date().toISOString()
      
      await auditLog({
        action: 'credential_change',
        category: 'courier',
        field: 'steadfastSecretKey',
        oldValue: '••••••••',
        newValue: '••••••••',
        ipAddress: ip,
        details: 'Secret Key changed (encrypted)'
      })
    }
    
    if (body.steadfastWebhookUrl !== undefined) {
      updateData.steadfastWebhookUrl = body.steadfastWebhookUrl
      updateData.steadfastApiUpdatedAt = new Date().toISOString()
      
      // Clear courier cache
      globalThis.__courierCredentials = undefined
    }
    
    // ===== CLOUDINARY CREDENTIALS =====
    // ENCRYPT the API Secret!
    if (body.cloudinaryCloudName !== undefined) {
      updateData.cloudinaryCloudName = body.cloudinaryCloudName
      updateData.cloudinaryUpdatedAt = new Date().toISOString()
    }
    
    if (body.cloudinaryApiKey !== undefined) {
      updateData.cloudinaryApiKey = body.cloudinaryApiKey
      updateData.cloudinaryUpdatedAt = new Date().toISOString()
    }
    
    if (body.cloudinaryApiSecret !== undefined && body.cloudinaryApiSecret !== '') {
      // Reject masked values
      if (isMaskedPlaceholder(body.cloudinaryApiSecret)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid API Secret value. Please enter a new value.' 
        }, { status: 400 })
      }
      
      updateData.cloudinaryApiSecret = encrypt(body.cloudinaryApiSecret)
      updateData.cloudinaryUpdatedAt = new Date().toISOString()
      
      await auditLog({
        action: 'credential_change',
        category: 'cloudinary',
        field: 'cloudinaryApiSecret',
        oldValue: '••••••••',
        newValue: '••••••••',
        ipAddress: ip,
        details: 'API Secret changed (encrypted)'
      })
    }
    
    // ===== EXECUTE UPDATE =====
    const existing = await db.select({ id: settings.id }).from(settings).where(eq(settings.id, 1)).limit(1)
    
    let result: any[]
    
    if (existing.length === 0) {
      result = await db.insert(settings).values({
        ...DEFAULT_SETTINGS,
        ...updateData
      }).returning()
    } else {
      result = await db.update(settings)
        .set(updateData)
        .where(eq(settings.id, 1))
        .returning()
    }
    
    // CRITICAL: Clear old cache first to prevent stale data
    globalThis.__settingsCache = undefined
    
    // Clean and cache
    const cleaned = {
      ...result[0],
      logoUrl: cleanBaseUrl(result[0].logoUrl),
      faviconUrl: cleanBaseUrl(result[0].faviconUrl),
      heroImages: JSON.stringify(filterHeroImages(result[0].heroImages)),
    }
    
    setCachedSettings(cleaned)
    
    console.log('[SETTINGS API] Returning success')
    return NextResponse.json({ success: true, data: maskSensitiveFields(cleaned) })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 })
  }
}

// Clear cache function
export function clearSettingsCache() {
  globalThis.__settingsCache = undefined
}
