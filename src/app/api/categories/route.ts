import { NextRequest, NextResponse } from 'next/server'
import { db, sqlClient } from '@/db'
import { categories, products } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { isApiAuthenticated, authErrorResponse } from '@/lib/api-auth'

// Flag to track if tables have been initialized in this session
let _tablesInitialized = false

/**
 * Ensure categories table exists
 */
async function ensureTablesExist() {
  if (_tablesInitialized) return true
  
  try {
    // Try to query - if it works, tables exist
    await db.select().from(categories).limit(1)
    _tablesInitialized = true
    return true
  } catch (error: any) {
    // Table doesn't exist, create it
    if (error.message?.includes('relation') || error.message?.includes('does not exist')) {
      console.log('[CATEGORIES] Creating missing tables...')
      
      try {
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
        
        console.log('[CATEGORIES] Categories table created!')
        _tablesInitialized = true
        return true
      } catch (createError) {
        console.error('[CATEGORIES] Failed to create table:', createError)
        throw createError
      }
    }
    throw error
  }
}

// GET /api/categories - Get all categories with product counts
export async function GET() {
  try {
    await ensureTablesExist()
    
    // Get all categories
    const allCategories = await db.select().from(categories)
    
    // Get product counts per category
    const productCounts = await db
      .select({
        categoryId: products.categoryId,
        count: sql<number>`count(*)`.as('count')
      })
      .from(products)
      .groupBy(products.categoryId)
    
    // Create a map of category ID to product count
    const countMap = new Map<string, number>()
    productCounts.forEach((pc: any) => {
      if (pc.categoryId) {
        countMap.set(pc.categoryId, pc.count)
      }
    })
    
    // Merge categories with actual product counts
    const categoriesWithCounts = allCategories.map((cat: any) => ({
      ...cat,
      items: countMap.get(cat.id) || 0
    }))
    
    return NextResponse.json({
      success: true,
      data: categoriesWithCounts,
      count: categoriesWithCounts.length
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// POST /api/categories - Create new category
export async function POST(request: NextRequest) {
  try {
    // Authentication required
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    await ensureTablesExist()

    const body = await request.json()
    
    console.log('[CATEGORIES] Creating category:', body.name)
    
    const newCategory = await db.insert(categories).values({
      id: body.id || `CAT-${Date.now()}`,
      name: body.name,
      type: body.type || 'icon',
      icon: body.icon || null,
      image: body.image || null,
      items: 0,
      status: body.status || 'Active',
    }).returning()
    
    console.log('[CATEGORIES] Category created successfully:', newCategory[0])
    
    return NextResponse.json({
      success: true,
      data: { ...newCategory[0], items: 0 }
    }, { status: 201 })
  } catch (error) {
    console.error('[CATEGORIES] Error creating category:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create category: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// PUT /api/categories - Update category
export async function PUT(request: NextRequest) {
  try {
    // Authentication required
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    await ensureTablesExist()

    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Category ID is required' },
        { status: 400 }
      )
    }
    
    const updatedCategory = await db
      .update(categories)
      .set({
        name: updateData.name,
        type: updateData.type,
        icon: updateData.icon || null,
        image: updateData.image || null,
        status: updateData.status,
      })
      .where(eq(categories.id, id))
      .returning()
    
    if (updatedCategory.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      data: updatedCategory[0]
    })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update category: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

// DELETE /api/categories - Delete category
export async function DELETE(request: NextRequest) {
  try {
    // Authentication required
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    await ensureTablesExist()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Category ID is required' },
        { status: 400 }
      )
    }
    
    // First check if category exists
    const existingCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1)
    
    if (existingCategory.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      )
    }
    
    // Unassign all products from this category
    await db
      .update(products)
      .set({ categoryId: null })
      .where(eq(products.categoryId, id))
    
    // Delete the category
    const deletedCategory = await db
      .delete(categories)
      .where(eq(categories.id, id))
      .returning()
    
    return NextResponse.json({
      success: true,
      message: 'Category deleted successfully',
      data: deletedCategory[0]
    })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete category: ' + (error as Error).message },
      { status: 500 }
    )
  }
}
