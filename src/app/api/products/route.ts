import { NextRequest, NextResponse } from 'next/server'
import { db, sqlClient } from '@/db'
import { products, variants, productImages, productFaqs, relatedProducts, reviews, orderItems, categories } from '@/db/schema'
import { eq, like, or, and, sql, inArray } from 'drizzle-orm'
import { isApiAuthenticated, authErrorResponse } from '@/lib/api-auth'

// Flag to track if tables have been initialized
let _tablesInitialized = false

/**
 * Ensure products table exists
 */
async function ensureTablesExist() {
  if (_tablesInitialized) return true
  
  try {
    // Try to query - if it works, tables exist
    await db.select().from(products).limit(1)
    _tablesInitialized = true
    return true
  } catch (error: any) {
    // Table doesn't exist, create it
    if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
      console.log('[PRODUCTS] Creating missing tables...')
      
      try {
        // Create categories first (foreign key dependency)
        await sqlClient`CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT DEFAULT 'icon',
          icon TEXT,
          image TEXT,
          items INTEGER DEFAULT 0,
          status TEXT DEFAULT 'Active',
          created_at TIMESTAMP DEFAULT NOW()
        )`
        
        // Create products table
        await sqlClient`CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          category_id TEXT REFERENCES categories(id),
          image TEXT NOT NULL,
          price NUMERIC(10,2) NOT NULL,
          old_price NUMERIC(10,2),
          discount TEXT DEFAULT '0%',
          discount_type TEXT DEFAULT 'pct',
          discount_value NUMERIC(10,2) DEFAULT '0',
          offer BOOLEAN DEFAULT false,
          status TEXT DEFAULT 'active',
          short_desc TEXT,
          long_desc TEXT,
          weight TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
        
        // Create variants table
        await sqlClient`CREATE TABLE IF NOT EXISTS variants (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          stock INTEGER NOT NULL,
          initial_stock INTEGER NOT NULL,
          price NUMERIC(10,2) DEFAULT '0',
          discount TEXT DEFAULT '0%',
          discount_type TEXT DEFAULT 'pct',
          discount_value NUMERIC(10,2) DEFAULT '0',
          product_id INTEGER REFERENCES products(id) NOT NULL
        )`
        
        console.log('[PRODUCTS] All tables created!')
        _tablesInitialized = true
        return true
      } catch (createError) {
        console.error('[PRODUCTS] Failed to create tables:', createError)
        throw createError
      }
    }
    throw error
  }
}

// Helper function to parse discount string
function parseDiscount(discountStr: string | null): { discountType: 'pct' | 'fixed'; discountValue: number } {
  if (!discountStr || discountStr === '0%' || discountStr === '0') {
    return { discountType: 'pct', discountValue: 0 }
  }
  
  // Check if it's a percentage (e.g., "5%", "10%")
  if (discountStr.includes('%')) {
    const value = parseInt(discountStr.replace('%', ''))
    return { discountType: 'pct', discountValue: value }
  }
  
  // Otherwise it's a fixed amount (e.g., "50", "100")
  const value = parseInt(discountStr)
  return { discountType: 'fixed', discountValue: value }
}

// Helper function to add parsed discount to product
// Uses DB values if available, otherwise parses from discount string
function addParsedDiscount(product: any) {
  // Use DB values if discountValue is set and > 0
  if (product.discountValue !== null && product.discountValue !== undefined && product.discountValue > 0) {
    return {
      ...product,
      discountType: product.discountType || 'pct',
      discountValue: product.discountValue
    }
  }
  
  // Otherwise parse from discount string
  const { discountType, discountValue } = parseDiscount(product.discount)
  return {
    ...product,
    discountType,
    discountValue
  }
}

// GET /api/products - Get all products
export async function GET(request: NextRequest) {
  try {
    await ensureTablesExist()
    
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const offer = searchParams.get('offer')
    const id = searchParams.get('id')
    
    // Get single product by ID
    if (id) {
      const product = await db.select().from(products).where(eq(products.id, parseInt(id))).limit(1)
      if (product.length === 0) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true, data: addParsedDiscount(product[0]) })
    }
    
    // Use SQL WHERE for filtering (optimized)
    let query = db.select().from(products)
    
    // Build conditions
    const conditions: any[] = []
    if (category) {
      conditions.push(eq(products.category, category))
    }
    if (offer === 'true') {
      conditions.push(eq(products.offer, true))
    }
    
    // Execute query with conditions
    let result
    if (conditions.length > 0) {
      result = await query.where(and(...conditions))
    } else {
      result = await query
    }
    
    // Search filter (in memory for partial match)
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.category.toLowerCase().includes(searchLower)
      )
    }
    
    // Get stock count and price info for each product from variants
    const productIds = result.map(p => p.id)
    let stockMap: Record<number, number> = {}
    let variantCountMap: Record<number, number> = {}
    let priceRangeMap: Record<number, { min: number; max: number }> = {}
    
    if (productIds.length > 0) {
      // Use inArray for safe parameterized queries (prevents SQL injection)
      const variantsData = await db.select().from(variants)
        .where(inArray(variants.productId, productIds))
      
      variantsData.forEach(v => {
        if (!stockMap[v.productId]) stockMap[v.productId] = 0
        stockMap[v.productId] += v.stock || 0
        
        // Count variants
        if (!variantCountMap[v.productId]) variantCountMap[v.productId] = 0
        variantCountMap[v.productId]++
        
        // Track min/max prices
        const variantPrice = parseFloat(v.price?.toString() || '0')
        if (!priceRangeMap[v.productId]) {
          priceRangeMap[v.productId] = { min: variantPrice, max: variantPrice }
        } else {
          if (variantPrice < priceRangeMap[v.productId].min) priceRangeMap[v.productId].min = variantPrice
          if (variantPrice > priceRangeMap[v.productId].max) priceRangeMap[v.productId].max = variantPrice
        }
      })
    }
    
    // Add parsed discount, stock count, variant count, and price range to each product
    const productsWithParsedDiscount = result.map(p => ({
      ...addParsedDiscount(p),
      stockCount: stockMap[p.id] || 0,
      variantCount: variantCountMap[p.id] || 0,
      priceRange: priceRangeMap[p.id] || { min: 0, max: 0 }
    }))
    
    return NextResponse.json({
      success: true,
      data: productsWithParsedDiscount,
      count: productsWithParsedDiscount.length
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    await ensureTablesExist()

    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.category || !body.image) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, category, image' },
        { status: 400 }
      )
    }
    
    const newProduct = await db.insert(products).values({
      name: body.name,
      category: body.category,
      categoryId: body.categoryId || null,
      image: body.image,
      price: body.price?.toString() || '0',
      oldPrice: body.oldPrice?.toString() || null,
      discount: body.discount || '0%',
      discountType: body.discountType || 'pct',
      discountValue: body.discountValue?.toString() || '0',
      offer: body.offer || false,
      status: body.status || 'active',
      shortDesc: body.shortDesc || null,
      longDesc: body.longDesc || null,
      weight: body.weight || null,
    }).returning()
    
    return NextResponse.json({
      success: true,
      data: newProduct[0]
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create product: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

// PUT /api/products - Update product
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }
    
    // Build update object with only provided fields
    const updateFields: Record<string, unknown> = {
      updatedAt: sql`NOW()`,
    }
    
    if (updateData.name !== undefined) updateFields.name = updateData.name
    if (updateData.category !== undefined) updateFields.category = updateData.category
    if (updateData.categoryId !== undefined) updateFields.categoryId = updateData.categoryId
    if (updateData.image !== undefined) updateFields.image = updateData.image
    if (updateData.price !== undefined) updateFields.price = updateData.price.toString()
    if (updateData.oldPrice !== undefined) updateFields.oldPrice = updateData.oldPrice?.toString()
    if (updateData.discount !== undefined) updateFields.discount = updateData.discount
    if (updateData.discountType !== undefined) updateFields.discountType = updateData.discountType
    if (updateData.discountValue !== undefined) updateFields.discountValue = updateData.discountValue.toString()
    if (updateData.offer !== undefined) updateFields.offer = updateData.offer
    if (updateData.status !== undefined) updateFields.status = updateData.status
    if (updateData.shortDesc !== undefined) updateFields.shortDesc = updateData.shortDesc
    if (updateData.longDesc !== undefined) updateFields.longDesc = updateData.longDesc
    if (updateData.weight !== undefined) updateFields.weight = updateData.weight
    
    const updated = await db.update(products)
      .set(updateFields)
      .where(eq(products.id, id))
      .returning()
    
    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: updated[0]
    })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update product: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}

// DELETE /api/products - Delete product
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }
    
    const productId = parseInt(id)
    
    // Delete all related records first (to avoid foreign key constraint errors)
    await db.delete(variants).where(eq(variants.productId, productId))
    await db.delete(productImages).where(eq(productImages.productId, productId))
    await db.delete(productFaqs).where(eq(productFaqs.productId, productId))
    await db.delete(relatedProducts).where(eq(relatedProducts.productId, productId))
    await db.delete(reviews).where(eq(reviews.productId, productId))
    
    // FIX: Set productId to null in order_items to preserve order history
    // Order items should be kept for historical records and financial accuracy
    await db.update(orderItems)
      .set({ productId: null })
      .where(eq(orderItems.productId, productId))
    
    // Now delete the product
    const deleted = await db.delete(products)
      .where(eq(products.id, productId))
      .returning()
    
    if (deleted.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
      data: deleted[0]
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}

// PATCH /api/products - Partial update (for status toggle)
export async function PATCH(request: NextRequest) {
  try {
    // Authentication check
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    const body = await request.json()
    const { id, status } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      )
    }
    
    const updateData: Record<string, unknown> = {
      updatedAt: sql`NOW()`,
    }
    
    if (status !== undefined) {
      updateData.status = status
    }
    
    const updated = await db.update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning()
    
    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: updated[0]
    })
  } catch (error) {
    console.error('Error patching product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    )
  }
}
