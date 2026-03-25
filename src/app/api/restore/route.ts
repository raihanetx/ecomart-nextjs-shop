import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { 
  categories, products, variants, productImages, productFaqs, relatedProducts,
  customers, reviews, orders, orderItems, coupons, abandonedCheckouts, settings
} from '@/db/schema'
import { isApiAuthenticated, authErrorResponse } from '@/lib/api-auth'
import { eq } from 'drizzle-orm'

// ============================================
// RESTORE API
// ============================================
// POST /api/restore - Restore database from JSON backup file

// Expected backup structure
interface BackupData {
  _meta?: {
    version?: string
    exportedAt?: string
    tables?: string[]
    errors?: { table: string; error: string }[]
  }
  settings?: any[]
  categories?: any[]
  products?: any[]
  variants?: any[]
  productImages?: any[]
  productFaqs?: any[]
  relatedProducts?: any[]
  customers?: any[]
  reviews?: any[]
  orders?: any[]
  orderItems?: any[]
  coupons?: any[]
  abandonedCheckouts?: any[]
}

// Order of deletion (reverse of dependencies - children first)
const DELETE_ORDER = [
  'orderItems',
  'reviews', 
  'relatedProducts',
  'productFaqs',
  'productImages',
  'variants',
  'orders',
  'products',
  'coupons',
  'customers',
  'categories',
  'abandonedCheckouts',
  // Don't delete settings - just update it
]

// Order of insertion (respecting dependencies - parents first)
const INSERT_ORDER = [
  'settings',
  'categories',
  'products',
  'variants',
  'productImages',
  'productFaqs',
  'relatedProducts',
  'customers',
  'reviews',
  'orders',
  'orderItems',
  'coupons',
  'abandonedCheckouts',
]

/**
 * POST /api/restore
 * Restore database from a backup JSON file
 * Admin authentication required
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    if (!await isApiAuthenticated()) {
      return authErrorResponse()
    }

    console.log('[RESTORE] Starting restore process...')

    // Parse the incoming form data
    const formData = await request.formData()
    const backupFile = formData.get('backup')

    if (!backupFile || !(backupFile instanceof File)) {
      return NextResponse.json({ 
        success: false, 
        error: 'No backup file provided' 
      }, { status: 400 })
    }

    // Read and parse the JSON file
    const fileContent = await backupFile.text()
    let backupData: BackupData

    try {
      backupData = JSON.parse(fileContent)
    } catch (parseError) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid JSON file format' 
      }, { status: 400 })
    }

    // Validate backup structure
    if (!backupData._meta || !backupData._meta.version) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid backup file: missing metadata' 
      }, { status: 400 })
    }

    console.log(`[RESTORE] Backup version: ${backupData._meta.version}`)
    console.log(`[RESTORE] Exported at: ${backupData._meta.exportedAt}`)

    // Start transaction-like operation
    const results: Record<string, { deleted: number; inserted: number }> = {}

    // Step 1: Delete existing data in reverse dependency order
    console.log('[RESTORE] Step 1: Clearing existing data...')
    
    try {
      // Delete order items
      if (backupData.orderItems && backupData.orderItems.length > 0) {
        await db.delete(orderItems)
        results.orderItems = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted order items`)
      }

      // Delete reviews
      if (backupData.reviews && backupData.reviews.length > 0) {
        await db.delete(reviews)
        results.reviews = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted reviews`)
      }

      // Delete related products
      if (backupData.relatedProducts && backupData.relatedProducts.length > 0) {
        await db.delete(relatedProducts)
        results.relatedProducts = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted related products`)
      }

      // Delete product FAQs
      if (backupData.productFaqs && backupData.productFaqs.length > 0) {
        await db.delete(productFaqs)
        results.productFaqs = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted product FAQs`)
      }

      // Delete product images
      if (backupData.productImages && backupData.productImages.length > 0) {
        await db.delete(productImages)
        results.productImages = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted product images`)
      }

      // Delete variants
      if (backupData.variants && backupData.variants.length > 0) {
        await db.delete(variants)
        results.variants = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted variants`)
      }

      // Delete orders
      if (backupData.orders && backupData.orders.length > 0) {
        await db.delete(orders)
        results.orders = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted orders`)
      }

      // Delete products
      if (backupData.products && backupData.products.length > 0) {
        await db.delete(products)
        results.products = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted products`)
      }

      // Delete coupons
      if (backupData.coupons && backupData.coupons.length > 0) {
        await db.delete(coupons)
        results.coupons = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted coupons`)
      }

      // Delete customers
      if (backupData.customers && backupData.customers.length > 0) {
        await db.delete(customers)
        results.customers = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted customers`)
      }

      // Delete categories
      if (backupData.categories && backupData.categories.length > 0) {
        await db.delete(categories)
        results.categories = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted categories`)
      }

      // Delete abandoned checkouts
      if (backupData.abandonedCheckouts && backupData.abandonedCheckouts.length > 0) {
        await db.delete(abandonedCheckouts)
        results.abandonedCheckouts = { deleted: 0, inserted: 0 }
        console.log(`[RESTORE] Deleted abandoned checkouts`)
      }

    } catch (deleteError) {
      console.error('[RESTORE] Error during deletion:', deleteError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to clear existing data. Restore aborted.' 
      }, { status: 500 })
    }

    // Step 2: Insert new data in dependency order
    console.log('[RESTORE] Step 2: Inserting new data...')

    try {
      // Insert categories first (products depend on them)
      if (backupData.categories && backupData.categories.length > 0) {
        const cleanCategories = backupData.categories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          type: cat.type || 'icon',
          icon: cat.icon || null,
          image: cat.image || null,
          items: cat.items || 0,
          status: cat.status || 'Active',
          createdAt: cat.createdAt || cat.created_at ? new Date(cat.createdAt || cat.created_at) : new Date(),
        }))
        await db.insert(categories).values(cleanCategories)
        results.categories = { ...results.categories, inserted: cleanCategories.length }
        console.log(`[RESTORE] Inserted ${cleanCategories.length} categories`)
      }

      // Insert products (variants depend on them)
      if (backupData.products && backupData.products.length > 0) {
        const cleanProducts = backupData.products.map((prod: any) => ({
          id: prod.id,
          name: prod.name,
          category: prod.category,
          categoryId: prod.categoryId || prod.category_id || null,
          image: prod.image,
          price: prod.price,
          oldPrice: prod.oldPrice || prod.old_price || null,
          discount: prod.discount || '0%',
          discountType: prod.discountType || prod.discount_type || 'pct',
          discountValue: prod.discountValue || prod.discount_value || '0',
          offer: prod.offer || false,
          status: prod.status || 'active',
          shortDesc: prod.shortDesc || prod.short_desc || null,
          longDesc: prod.longDesc || prod.long_desc || null,
          weight: prod.weight || null,
          createdAt: prod.createdAt || prod.created_at ? new Date(prod.createdAt || prod.created_at) : new Date(),
          updatedAt: prod.updatedAt || prod.updated_at ? new Date(prod.updatedAt || prod.updated_at) : new Date(),
        }))
        await db.insert(products).values(cleanProducts)
        results.products = { ...results.products, inserted: cleanProducts.length }
        console.log(`[RESTORE] Inserted ${cleanProducts.length} products`)
      }

      // Insert variants
      if (backupData.variants && backupData.variants.length > 0) {
        const cleanVariants = backupData.variants.map((v: any) => ({
          id: v.id,
          name: v.name,
          stock: v.stock,
          initialStock: v.initialStock || v.initial_stock || v.stock,
          price: v.price || '0',
          discount: v.discount || '0%',
          discountType: v.discountType || v.discount_type || 'pct',
          discountValue: v.discountValue || v.discount_value || '0',
          productId: v.productId || v.product_id,
        }))
        await db.insert(variants).values(cleanVariants)
        results.variants = { ...results.variants, inserted: cleanVariants.length }
        console.log(`[RESTORE] Inserted ${cleanVariants.length} variants`)
      }

      // Insert product images
      if (backupData.productImages && backupData.productImages.length > 0) {
        const cleanImages = backupData.productImages.map((img: any) => ({
          id: img.id,
          url: img.url,
          sortOrder: img.sortOrder || img.sort_order || 0,
          productId: img.productId || img.product_id,
        }))
        await db.insert(productImages).values(cleanImages)
        results.productImages = { ...results.productImages, inserted: cleanImages.length }
        console.log(`[RESTORE] Inserted ${cleanImages.length} product images`)
      }

      // Insert product FAQs
      if (backupData.productFaqs && backupData.productFaqs.length > 0) {
        const cleanFaqs = backupData.productFaqs.map((faq: any) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          sortOrder: faq.sortOrder || faq.sort_order || 0,
          productId: faq.productId || faq.product_id,
        }))
        await db.insert(productFaqs).values(cleanFaqs)
        results.productFaqs = { ...results.productFaqs, inserted: cleanFaqs.length }
        console.log(`[RESTORE] Inserted ${cleanFaqs.length} product FAQs`)
      }

      // Insert related products
      if (backupData.relatedProducts && backupData.relatedProducts.length > 0) {
        const cleanRelated = backupData.relatedProducts.map((rp: any) => ({
          id: rp.id,
          relatedProductId: rp.relatedProductId || rp.related_product_id,
          sortOrder: rp.sortOrder || rp.sort_order || 0,
          productId: rp.productId || rp.product_id,
        }))
        await db.insert(relatedProducts).values(cleanRelated)
        results.relatedProducts = { ...results.relatedProducts, inserted: cleanRelated.length }
        console.log(`[RESTORE] Inserted ${cleanRelated.length} related products`)
      }

      // Insert customers
      if (backupData.customers && backupData.customers.length > 0) {
        const cleanCustomers = backupData.customers.map((cust: any) => ({
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          address: cust.address || null,
          email: cust.email || null,
          totalSpent: cust.totalSpent || cust.total_spent || '0',
          totalOrders: cust.totalOrders || cust.total_orders || 0,
          createdAt: cust.createdAt || cust.created_at ? new Date(cust.createdAt || cust.created_at) : new Date(),
        }))
        await db.insert(customers).values(cleanCustomers)
        results.customers = { ...results.customers, inserted: cleanCustomers.length }
        console.log(`[RESTORE] Inserted ${cleanCustomers.length} customers`)
      }

      // Insert reviews
      if (backupData.reviews && backupData.reviews.length > 0) {
        const cleanReviews = backupData.reviews.map((rev: any) => ({
          id: rev.id,
          initials: rev.initials,
          name: rev.name,
          rating: rev.rating,
          text: rev.text,
          date: rev.date,
          productId: rev.productId || rev.product_id || null,
          customerId: rev.customerId || rev.customer_id || null,
        }))
        await db.insert(reviews).values(cleanReviews)
        results.reviews = { ...results.reviews, inserted: cleanReviews.length }
        console.log(`[RESTORE] Inserted ${cleanReviews.length} reviews`)
      }

      // Insert orders
      if (backupData.orders && backupData.orders.length > 0) {
        const cleanOrders = backupData.orders.map((ord: any) => ({
          id: ord.id,
          customerId: ord.customerId || ord.customer_id || null,
          customerName: ord.customerName || ord.customer_name,
          phone: ord.phone,
          address: ord.address,
          note: ord.note || null,
          date: ord.date,
          time: ord.time,
          paymentMethod: ord.paymentMethod || ord.payment_method,
          status: ord.status || 'pending',
          courierStatus: ord.courierStatus || ord.courier_status || null,
          consignmentId: ord.consignmentId || ord.consignment_id || null,
          trackingCode: ord.trackingCode || ord.tracking_code || null,
          courierDeliveredAt: ord.courierDeliveredAt || ord.courier_delivered_at || null,
          subtotal: ord.subtotal,
          delivery: ord.delivery,
          discount: ord.discount || '0',
          couponCodes: ord.couponCodes || ord.coupon_codes || '[]',
          couponAmount: ord.couponAmount || ord.coupon_amount || '0',
          total: ord.total,
          canceledBy: ord.canceledBy || ord.canceled_by || null,
          createdAt: ord.createdAt || ord.created_at ? new Date(ord.createdAt || ord.created_at) : new Date(),
          updatedAt: ord.updatedAt || ord.updated_at ? new Date(ord.updatedAt || ord.updated_at) : new Date(),
        }))
        await db.insert(orders).values(cleanOrders)
        results.orders = { ...results.orders, inserted: cleanOrders.length }
        console.log(`[RESTORE] Inserted ${cleanOrders.length} orders`)
      }

      // Insert order items
      if (backupData.orderItems && backupData.orderItems.length > 0) {
        const cleanOrderItems = backupData.orderItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          variant: item.variant || null,
          qty: item.qty,
          basePrice: item.basePrice || item.base_price,
          offerText: item.offerText || item.offer_text || null,
          offerDiscount: item.offerDiscount || item.offer_discount || '0',
          couponCode: item.couponCode || item.coupon_code || null,
          couponDiscount: item.couponDiscount || item.coupon_discount || '0',
          orderId: item.orderId || item.order_id,
          productId: item.productId || item.product_id || null,
        }))
        await db.insert(orderItems).values(cleanOrderItems)
        results.orderItems = { ...results.orderItems, inserted: cleanOrderItems.length }
        console.log(`[RESTORE] Inserted ${cleanOrderItems.length} order items`)
      }

      // Insert coupons
      if (backupData.coupons && backupData.coupons.length > 0) {
        const cleanCoupons = backupData.coupons.map((coup: any) => ({
          id: coup.id,
          code: coup.code,
          type: coup.type,
          value: coup.value,
          scope: coup.scope,
          expiry: coup.expiry || null,
          selectedProducts: coup.selectedProducts || coup.selected_products || null,
          selectedCategories: coup.selectedCategories || coup.selected_categories || null,
          createdAt: coup.createdAt || coup.created_at ? new Date(coup.createdAt || coup.created_at) : new Date(),
        }))
        await db.insert(coupons).values(cleanCoupons)
        results.coupons = { ...results.coupons, inserted: cleanCoupons.length }
        console.log(`[RESTORE] Inserted ${cleanCoupons.length} coupons`)
      }

      // Insert abandoned checkouts
      if (backupData.abandonedCheckouts && backupData.abandonedCheckouts.length > 0) {
        const cleanAbandoned = backupData.abandonedCheckouts.map((ab: any) => ({
          id: ab.id,
          sessionId: ab.sessionId || ab.session_id,
          visitNumber: ab.visitNumber || ab.visit_number || 1,
          name: ab.name || null,
          phone: ab.phone || null,
          address: ab.address || null,
          items: ab.items,
          subtotal: ab.subtotal || '0',
          delivery: ab.delivery || '0',
          total: ab.total || '0',
          status: ab.status || 'abandoned',
          completedOrderId: ab.completedOrderId || ab.completed_order_id || null,
          visitTime: ab.visitTime || ab.visit_time,
          visitDate: ab.visitDate || ab.visit_date,
          createdAt: ab.createdAt || ab.created_at ? new Date(ab.createdAt || ab.created_at) : new Date(),
        }))
        await db.insert(abandonedCheckouts).values(cleanAbandoned)
        results.abandonedCheckouts = { ...results.abandonedCheckouts, inserted: cleanAbandoned.length }
        console.log(`[RESTORE] Inserted ${cleanAbandoned.length} abandoned checkouts`)
      }

      // Update settings (don't insert new, just update existing)
      if (backupData.settings && backupData.settings.length > 0) {
        const settingsData = backupData.settings[0]
        const updateData: Record<string, any> = {}

        // SECURITY: Only update non-sensitive fields
        // Credentials are NEVER restored from backup for security
        const safeFields = [
          'websiteName', 'slogan', 'logoUrl', 'faviconUrl', 'heroImages',
          'insideDhakaDelivery', 'outsideDhakaDelivery', 'freeDeliveryMin',
          'universalDelivery', 'universalDeliveryCharge',
          'whatsappNumber', 'phoneNumber', 'facebookUrl', 'messengerUsername',
          'aboutUs', 'termsConditions', 'refundPolicy', 'privacyPolicy',
          'offerTitle', 'offerSlogan',
          'firstSectionName', 'firstSectionSlogan',
          'secondSectionName', 'secondSectionSlogan',
          'thirdSectionName', 'thirdSectionSlogan',
          'heroAnimationSpeed', 'heroAnimationType',
          'stockLowPercent', 'stockMediumPercent',
          'courierEnabled',
        ]
        // NOTE: Credentials are intentionally NOT included for security:
        // - adminUsername, adminPassword
        // - steadfastApiKey, steadfastSecretKey, steadfastWebhookUrl
        // - cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret
        // These must be manually configured after restore

        for (const field of safeFields) {
          if (settingsData[field] !== undefined) {
            updateData[field] = settingsData[field]
          }
        }

        await db.update(settings).set(updateData).where(eq(settings.id, 1))
        results.settings = { deleted: 0, inserted: 1 }
        console.log(`[RESTORE] Updated settings`)
      }

    } catch (insertError) {
      console.error('[RESTORE] Error during insertion:', insertError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to insert data. Database may be in inconsistent state. Please restore again with a fresh backup.' 
      }, { status: 500 })
    }

    console.log('[RESTORE] Restore completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Database restored successfully!',
      results,
    })

  } catch (error) {
    console.error('[RESTORE] Restore failed:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Restore failed. Please try again.' 
    }, { status: 500 })
  }
}
