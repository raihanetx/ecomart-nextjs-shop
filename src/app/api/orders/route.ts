import { NextRequest, NextResponse } from 'next/server'
import { db, getCachedCourierCredentials, setCachedCourierCredentials } from '@/db'
import { orders, orderItems, customers, variants, settings } from '@/db/schema'
import { eq, sql, and, inArray } from 'drizzle-orm'
import { isApiAuthenticated, authErrorResponse } from '@/lib/api-auth'
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/validation'
import { checkHoneypot, detectBot } from '@/lib/bot-detection'

// Steadfast Courier configuration
const STEADFAST_BASE_URL = 'https://portal.packzy.com/api/v1'

// Cache TTL for courier credentials
const CREDENTIALS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Helper to get courier credentials (uses global cache)
async function getCourierCredentials() {
  const cached = getCachedCourierCredentials()
  const now = Date.now()
  
  // Return cached if valid
  if (cached && (now - cached.timestamp) < CREDENTIALS_CACHE_TTL) {
    return cached.data
  }
  
  try {
    const settingsResult = await db.select({
      courierEnabled: settings.courierEnabled,
      courierApiKey: settings.courierApiKey,
      courierSecretKey: settings.courierSecretKey,
    }).from(settings).where(eq(settings.id, 1)).limit(1)
    
    if (settingsResult.length > 0) {
      const data = {
        enabled: settingsResult[0].courierEnabled || false,
        apiKey: settingsResult[0].courierApiKey || '',
        secretKey: settingsResult[0].courierSecretKey || '',
      }
      setCachedCourierCredentials(data)
      return data
    }
    
    return null
  } catch {
    return null
  }
}

// Helper to send order to courier
async function sendToSteadfastCourier(order: any): Promise<{ success: boolean; consignmentId?: number; trackingCode?: string; error?: string }> {
  try {
    const credentials = await getCourierCredentials()
    
    if (!credentials || !credentials.enabled || !credentials.apiKey || !credentials.secretKey) {
      return { success: false, error: 'Courier not configured' }
    }
    
    // Validate phone number (must be 11 digits)
    let phone = order.phone.replace(/[^0-9]/g, '')
    if (phone.length > 11) {
      phone = phone.slice(-11)
    } else if (phone.length < 11) {
      phone = phone.padStart(11, '0')
    }
    
    // Prepare order data for Steadfast
    const steadfastOrder = {
      invoice: order.id,
      recipient_name: order.customerName,
      recipient_phone: phone,
      recipient_address: order.address,
      cod_amount: order.total,
      note: `Payment: ${order.paymentMethod}`,
    }
    
    // Send to Steadfast API
    const response = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
      method: 'POST',
      headers: {
        'Api-Key': credentials.apiKey,
        'Secret-Key': credentials.secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(steadfastOrder),
    })
    
    const result = await response.json()
    
    if (response.ok && result.consignment) {
      return {
        success: true,
        consignmentId: result.consignment.consignment_id,
        trackingCode: result.consignment.tracking_code,
      }
    }
    
    console.error('Steadfast API error:', result)
    return { success: false, error: result.message || 'Failed to create consignment' }
  } catch (error) {
    console.error('Error sending to Steadfast:', error)
    return { success: false, error: 'Failed to connect to courier service' }
  }
}

// GET /api/orders - SMART: Fetch ALL data in 2 parallel queries, not N+1! (Admin only)
export async function GET(request: NextRequest) {
  try {
    // Authentication required - order data is business sensitive
    const isAuthenticated = await isApiAuthenticated()
    if (!isAuthenticated) {
      return authErrorResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    
    // SMART: Fetch orders AND items in PARALLEL (2 queries, not N+1)
    const [allOrders, allItems] = await Promise.all([
      db.select().from(orders),
      db.select().from(orderItems)
    ])
    
    // SMART: Build items lookup map (O(1) access)
    const itemsByOrderId: Record<string, any[]> = {}
    for (const item of allItems) {
      if (!itemsByOrderId[item.orderId || '']) {
        itemsByOrderId[item.orderId || ''] = []
      }
      itemsByOrderId[item.orderId || ''].push({
        name: item.name,
        variant: item.variant,
        qty: item.qty,
        basePrice: item.basePrice,
        offerText: item.offerText,
        offerDiscount: item.offerDiscount || 0,
        couponCode: item.couponCode,
        couponDiscount: item.couponDiscount || 0,
        productId: item.productId,
      })
    }
    
    // Filter orders in memory (no DB call)
    let result = allOrders
    if (status) {
      result = result.filter(o => o.status === status)
    }
    if (customerId) {
      result = result.filter(o => o.customerId === parseInt(customerId))
    }
    
    // Sort by createdAt descending (newest first)
    result.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return timeB - timeA
    })
    
    // SMART: Attach items from map (O(1) per order)
    const ordersWithItems = result.map(order => ({
      ...order,
      items: itemsByOrderId[order.id] || []
    }))
    
    return NextResponse.json({
      success: true,
      data: ordersWithItems,
      count: ordersWithItems.length
    })
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

// POST /api/orders - Create new order (Public with rate limiting + bot detection)
export async function POST(request: NextRequest) {
  try {
    // === BOT DETECTION ===
    const body = await request.json()
    
    // Check honeypot fields (invisible to humans)
    const honeypotCheck = checkHoneypot(body)
    if (!honeypotCheck.valid) {
      // Silently reject - don't tell bots why
      console.log('[SECURITY] Bot detected via honeypot')
      return NextResponse.json(
        { success: true, data: { id: 'pending' } }, // Fake success to confuse bots
        { status: 201 }
      )
    }
    
    // Additional bot detection
    const botCheck = detectBot(request, body)
    if (botCheck.shouldBlock) {
      console.log('[SECURITY] Bot blocked:', botCheck.reasons)
      return NextResponse.json(
        { success: false, error: 'Request could not be processed' },
        { status: 400 }
      )
    }
    
    // === RATE LIMITING ===
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const rateLimitKey = `order-create:${ip}`
    const rateLimit = checkRateLimit(rateLimitKey, 10, 60000) // 10 orders per minute per IP

    if (!rateLimit.allowed) {
      return rateLimitErrorResponse(rateLimit.resetAt)
    }

    // Input validation for required fields
    const validationErrors: string[] = []

    // Validate customer name
    if (!body.customerName || typeof body.customerName !== 'string' || body.customerName.trim().length < 2) {
      validationErrors.push('Customer name is required (min 2 characters)')
    }

    // Validate phone (Bangladesh format)
    if (!body.phone || typeof body.phone !== 'string') {
      validationErrors.push('Phone number is required')
    } else {
      const phoneDigits = body.phone.replace(/\D/g, '')
      if (phoneDigits.length !== 11 || !phoneDigits.startsWith('01')) {
        validationErrors.push('Phone must be 11 digits starting with 01')
      }
    }

    // Validate address
    if (!body.address || typeof body.address !== 'string' || body.address.trim().length < 10) {
      validationErrors.push('Address is required (min 10 characters)')
    }

    // Validate items
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      validationErrors.push('At least one item is required')
    }

    // Validate totals
    if (typeof body.subtotal !== 'number' || body.subtotal < 0) {
      validationErrors.push('Valid subtotal is required')
    }
    if (typeof body.total !== 'number' || body.total < 0) {
      validationErrors.push('Valid total is required')
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validationErrors },
        { status: 400 }
      )
    }

    // SMART: Parallel operations for customer check and variant fetch
    let customerId: number | undefined = undefined
    let variantRecords: any[] = []
    
    const parallelTasks: Promise<any>[] = []
    
    // Customer check
    if (body.phone) {
      parallelTasks.push(db.select().from(customers).where(eq(customers.phone, body.phone)).limit(1))
    }
    
    // Fetch variants for stock decrement (if items provided)
    if (body.items && body.items.length > 0) {
      const productIds = [...new Set(body.items.map((item: any) => item.productId).filter(Boolean))] as number[]
      if (productIds.length > 0) {
        // SECURITY: Use inArray() instead of raw SQL to prevent injection
        parallelTasks.push(db.select().from(variants).where(inArray(variants.productId, productIds)))
      }
    }
    
    const parallelResults = await Promise.all(parallelTasks)
    
    // Process customer
    const customerResult = body.phone ? parallelResults[0] : null
    const variantsResult = body.items?.length > 0 ? parallelResults[body.phone ? 1 : 0] : []
    
    if (customerResult && customerResult.length > 0) {
      customerId = customerResult[0].id
      // Update existing customer
      await db.update(customers)
        .set({
          name: body.customerName || customerResult[0].name,
          address: body.address || customerResult[0].address,
          totalOrders: sql`${customers.totalOrders} + 1`,
          totalSpent: sql`${customers.totalSpent} + ${body.total || 0}`,
        })
        .where(eq(customers.id, customerResult[0].id))
    } else if (body.phone) {
      // Create new customer
      const newCustomer = await db.insert(customers).values({
        name: body.customerName,
        phone: body.phone,
        address: body.address,
        totalOrders: 1,
        totalSpent: body.total || 0,
      }).returning()
      customerId = newCustomer[0].id
    }
    
    // Build variant lookup for stock updates
    const variantLookup = new Map<string, any>()
    for (const v of (variantsResult || [])) {
      variantLookup.set(`${v.productId}-${v.name}`, v)
    }
    
    // Create order
    const newOrder = await db.insert(orders).values({
      id: body.id || `ORD-${Date.now().toString().slice(-6)}`,
      customerId: customerId,
      customerName: body.customerName,
      phone: body.phone,
      address: body.address,
      note: body.note || null,
      date: body.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: body.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      paymentMethod: body.paymentMethod || 'Cash on Delivery',
      status: body.status || 'pending',
      subtotal: body.subtotal,
      delivery: body.delivery,
      discount: body.discount || 0,
      couponAmount: body.couponAmount || 0,
      total: body.total,
      couponCodes: JSON.stringify(body.couponCodes || []),
    }).returning()
    
    // Create order items and prepare stock updates
    if (body.items && body.items.length > 0) {
      await db.insert(orderItems).values(
        body.items.map((item: any) => ({
          name: item.name,
          variant: item.variant,
          qty: item.qty,
          basePrice: item.basePrice,
          offerText: item.offerText,
          offerDiscount: item.offerDiscount || 0,
          couponCode: item.couponCode,
          couponDiscount: item.couponDiscount || 0,
          orderId: newOrder[0].id,
          productId: item.productId,
        }))
      )
      
      // SMART: Batch stock updates
      for (const item of body.items) {
        if (item.productId && item.variant) {
          const variantKey = `${item.productId}-${item.variant}`
          const variantRecord = variantLookup.get(variantKey)
          if (variantRecord) {
            await db.update(variants)
              .set({ stock: sql`${variants.stock} - ${item.qty}` })
              .where(eq(variants.id, variantRecord.id))
          }
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: newOrder[0]
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

// PUT /api/orders - Update order items (Engineer Mode) (Admin only)
export async function PUT(request: NextRequest) {
  try {
    // Authentication required for modifying orders
    const isAuthenticated = await isApiAuthenticated()
    if (!isAuthenticated) {
      return authErrorResponse()
    }

    const body = await request.json()
    const { id, items, subtotal, discount, couponAmount, total, delivery, customer, phone, address } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Input validation for numeric fields
    const validateNumericField = (value: any, fieldName: string): number | null => {
      if (value === undefined) return null
      const num = parseFloat(String(value))
      if (isNaN(num)) {
        throw new Error(`Invalid ${fieldName}: must be a number`)
      }
      if (num < 0) {
        throw new Error(`Invalid ${fieldName}: cannot be negative`)
      }
      return num
    }

    // Build update object with validated values
    const updateData: any = { updatedAt: new Date() }
    
    try {
      if (subtotal !== undefined) updateData.subtotal = validateNumericField(subtotal, 'subtotal')
      if (discount !== undefined) updateData.discount = validateNumericField(discount, 'discount')
      if (couponAmount !== undefined) updateData.couponAmount = validateNumericField(couponAmount, 'couponAmount')
      if (total !== undefined) updateData.total = validateNumericField(total, 'total')
      if (delivery !== undefined) updateData.delivery = validateNumericField(delivery, 'delivery')
    } catch (validationError: any) {
      return NextResponse.json(
        { success: false, error: validationError.message },
        { status: 400 }
      )
    }
    
    if (customer !== undefined) updateData.customerName = customer
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    
    await db.update(orders).set(updateData).where(eq(orders.id, id))
    
    // Handle items update
    if (items && Array.isArray(items)) {
      // Get old items to restore stock
      const oldItems = await db.select().from(orderItems).where(eq(orderItems.orderId, id))
      
      // Get all variants needed
      const productIds = [...new Set([
        ...oldItems.filter(i => i.productId).map(i => i.productId),
        ...items.filter((i: any) => i.productId).map((i: any) => i.productId)
      ])]
      
      let allVariants: any[] = []
      if (productIds.length > 0) {
        // SECURITY: Use inArray() instead of raw SQL to prevent injection
        allVariants = await db.select().from(variants).where(inArray(variants.productId, productIds))
      }
      
      const variantLookup = new Map<string, any>()
      for (const v of allVariants) {
        variantLookup.set(`${v.productId}-${v.name}`, v)
      }
      
      // Restore stock for old items
      for (const oldItem of oldItems) {
        if (oldItem.productId && oldItem.variant) {
          const variantRecord = variantLookup.get(`${oldItem.productId}-${oldItem.variant}`)
          if (variantRecord) {
            await db.update(variants)
              .set({ stock: sql`${variants.stock} + ${oldItem.qty}` })
              .where(eq(variants.id, variantRecord.id))
          }
        }
      }
      
      // Delete old items and insert new ones
      await db.delete(orderItems).where(eq(orderItems.orderId, id))
      
      if (items.length > 0) {
        await db.insert(orderItems).values(
          items.map((item: any) => ({
            name: item.name,
            variant: item.variant,
            qty: item.qty,
            basePrice: item.basePrice,
            offerText: item.offerText,
            offerDiscount: item.offerDiscount || 0,
            couponCode: item.couponCode,
            couponDiscount: item.couponDiscount || 0,
            orderId: id,
            productId: item.productId,
          }))
        )
        
        // Decrement stock for new items
        for (const item of items) {
          if (item.productId && item.variant) {
            const variantRecord = variantLookup.get(`${item.productId}-${item.variant}`)
            if (variantRecord) {
              await db.update(variants)
                .set({ stock: sql`${variants.stock} - ${item.qty}` })
                .where(eq(variants.id, variantRecord.id))
            }
          }
        }
      }
    }
    
    // Fetch updated order with items (parallel)
    const [updatedOrder, updatedItems] = await Promise.all([
      db.select().from(orders).where(eq(orders.id, id)).limit(1),
      db.select().from(orderItems).where(eq(orderItems.orderId, id))
    ])
    
    return NextResponse.json({
      success: true,
      data: {
        ...updatedOrder[0],
        items: updatedItems.map(item => ({
          name: item.name,
          variant: item.variant,
          qty: item.qty,
          basePrice: item.basePrice,
          offerText: item.offerText,
          offerDiscount: item.offerDiscount || 0,
          couponCode: item.couponCode,
          couponDiscount: item.couponDiscount || 0,
        }))
      }
    })
  } catch (error) {
    console.error('Error updating order items:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update order items' },
      { status: 500 }
    )
  }
}

// PATCH /api/orders - Update order status (Admin only)
export async function PATCH(request: NextRequest) {
  try {
    // Authentication required for modifying order status
    const isAuthenticated = await isApiAuthenticated()
    if (!isAuthenticated) {
      return authErrorResponse()
    }

    const body = await request.json()
    const { id, status, courierStatus, canceledBy } = body
    
    const updateData: any = { updatedAt: new Date() }
    if (status) updateData.status = status
    if (courierStatus) updateData.courierStatus = courierStatus
    if (canceledBy) updateData.canceledBy = canceledBy
    
    // If order is being approved, auto-send to Steadfast Courier
    if (status === 'approved') {
      const orderResult = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
      
      if (orderResult.length > 0) {
        const order = orderResult[0]
        
        if (!order.consignmentId) {
          const courierResult = await sendToSteadfastCourier(order)
          
          if (courierResult.success) {
            updateData.consignmentId = courierResult.consignmentId
            updateData.trackingCode = courierResult.trackingCode
            updateData.courierStatus = 'in_review'
            console.log(`Order ${id} sent to Steadfast Courier: Consignment ${courierResult.consignmentId}`)
          } else {
            console.log(`Failed to send order ${id} to courier: ${courierResult.error}`)
          }
        }
      }
    }
    
    const updated = await db.update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning()
    
    return NextResponse.json({
      success: true,
      data: updated[0]
    })
  } catch (error) {
    console.error('Error updating order:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update order' },
      { status: 500 }
    )
  }
}
