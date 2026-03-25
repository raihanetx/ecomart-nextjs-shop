import { NextRequest, NextResponse } from 'next/server'
import { db, sqlClient } from '@/db'
import { categories, products } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { isApiAuthenticated, authErrorResponse } from '@/lib/api-auth'
import { initializeDatabase, isDatabaseReady } from '@/lib/auto-init'
import { internalError, validationError, notFoundError, logApiError } from '@/lib/api-errors'

/**
 * GET /api/categories - Get all categories with product counts
 */
export async function GET() {
  try {
    // Ensure database is initialized
    if (!await isDatabaseReady()) {
      await initializeDatabase()
    }
    
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
    return internalError('CATEGORIES_GET', error)
  }
}

/**
 * POST /api/categories - Create new category
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication required
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    // Ensure database is initialized
    if (!await isDatabaseReady()) {
      await initializeDatabase()
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.name) {
      return validationError('Category name is required')
    }
    
    const newCategory = await db.insert(categories).values({
      id: body.id || `CAT-${Date.now()}`,
      name: body.name,
      type: body.type || 'icon',
      icon: body.icon || null,
      image: body.image || null,
      items: 0,
      status: body.status || 'Active',
    }).returning()
    
    return NextResponse.json({
      success: true,
      data: { ...newCategory[0], items: 0 }
    }, { status: 201 })
  } catch (error) {
    return internalError('CATEGORIES_POST', error)
  }
}

/**
 * PUT /api/categories - Update category
 */
export async function PUT(request: NextRequest) {
  try {
    // Authentication required
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    // Ensure database is initialized
    if (!await isDatabaseReady()) {
      await initializeDatabase()
    }

    const body = await request.json()
    const { id, ...updateData } = body
    
    if (!id) {
      return validationError('Category ID is required')
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
      return notFoundError('Category not found')
    }
    
    return NextResponse.json({
      success: true,
      data: updatedCategory[0]
    })
  } catch (error) {
    return internalError('CATEGORIES_PUT', error)
  }
}

/**
 * DELETE /api/categories - Delete category
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authentication required
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    // Ensure database is initialized
    if (!await isDatabaseReady()) {
      await initializeDatabase()
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return validationError('Category ID is required')
    }
    
    // First check if category exists
    const existingCategory = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1)
    
    if (existingCategory.length === 0) {
      return notFoundError('Category not found')
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
    return internalError('CATEGORIES_DELETE', error)
  }
}
