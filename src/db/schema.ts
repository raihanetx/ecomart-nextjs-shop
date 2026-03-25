import { pgTable, text, integer, timestamp, boolean, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core'

// ============================================
// CATEGORIES
// ============================================
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').default('icon'), // 'icon' or 'image'
  icon: text('icon'),
  image: text('image'),
  items: integer('items').default(0),
  status: text('status').default('Active'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_categories_status').on(table.status),
])

// ============================================
// PRODUCTS
// ============================================
export const products = pgTable('products', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  image: text('image').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  oldPrice: numeric('old_price', { precision: 10, scale: 2 }),
  discount: text('discount').default('0%'), // Legacy field - kept for backward compatibility
  discountType: text('discount_type').default('pct'), // 'pct' for percentage, 'fixed' for fixed amount
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).default('0'), // Numeric value: 10 for 10% or 50 for 50 TK
  offer: boolean('offer').default(false),
  status: text('status').default('active'),
  shortDesc: text('short_desc'),
  longDesc: text('long_desc'),
  weight: text('weight'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_products_category').on(table.categoryId),
  index('idx_products_status').on(table.status),
  index('idx_products_offer').on(table.offer),
])

export const variants = pgTable('variants', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  stock: integer('stock').notNull(),
  initialStock: integer('initial_stock').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).default('0'),
  discount: text('discount').default('0%'), // Legacy field - kept for backward compatibility
  discountType: text('discount_type').default('pct'), // 'pct' for percentage, 'fixed' for fixed amount
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).default('0'), // Numeric value: 10 for 10% or 50 for 50 TK
  productId: integer('product_id').references(() => products.id).notNull(),
}, (table) => [
  index('idx_variants_product_id').on(table.productId),
])

export const productImages = pgTable('product_images', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').default(0),
  productId: integer('product_id').references(() => products.id).notNull(),
}, (table) => [
  index('idx_product_images_product_id').on(table.productId),
])

export const productFaqs = pgTable('product_faqs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  sortOrder: integer('sort_order').default(0),
  productId: integer('product_id').references(() => products.id).notNull(),
})

export const relatedProducts = pgTable('related_products', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  relatedProductId: integer('related_product_id').references(() => products.id).notNull(),
  sortOrder: integer('sort_order').default(0),
  productId: integer('product_id').references(() => products.id).notNull(),
}, (table) => [
  index('idx_related_products_product_id').on(table.productId),
])

// ============================================
// CUSTOMERS
// ============================================
export const customers = pgTable('customers', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  phone: text('phone').notNull().unique(),
  address: text('address'),
  email: text('email'),
  totalSpent: numeric('total_spent', { precision: 10, scale: 2 }).default('0'),
  totalOrders: integer('total_orders').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

// ============================================
// REVIEWS
// ============================================
export const reviews = pgTable('reviews', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  initials: text('initials').notNull(),
  name: text('name').notNull(),
  rating: integer('rating').notNull(),
  text: text('text').notNull(),
  date: text('date').notNull(),
  productId: integer('product_id').references(() => products.id),
  customerId: integer('customer_id').references(() => customers.id),
})

// ============================================
// ORDERS
// ============================================
export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  customerId: integer('customer_id').references(() => customers.id),
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  note: text('note'), // Customer note for delivery instructions
  date: text('date').notNull(),
  time: text('time').notNull(),
  paymentMethod: text('payment_method').notNull(),
  status: text('status').default('pending'), // pending, approved, canceled
  courierStatus: text('courier_status'), // in_review, pending, delivered, partial_delivered, cancelled, hold, unknown
  // Steadfast Courier Integration Fields
  consignmentId: integer('consignment_id'), // Steadfast consignment ID
  trackingCode: text('tracking_code'), // Steadfast tracking code
  courierDeliveredAt: text('courier_delivered_at'), // When delivered
  // Order totals
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  delivery: numeric('delivery', { precision: 10, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 10, scale: 2 }).default('0'),
  couponCodes: text('coupon_codes').default('[]'),
  couponAmount: numeric('coupon_amount', { precision: 10, scale: 2 }).default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  canceledBy: text('canceled_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_orders_status').on(table.status),
  index('idx_orders_created_at').on(table.createdAt),
  index('idx_orders_phone').on(table.phone),
  index('idx_orders_status_created').on(table.status, table.createdAt), // Composite for dashboard queries
])

export const orderItems = pgTable('order_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  variant: text('variant'),
  qty: integer('qty').notNull(),
  basePrice: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  offerText: text('offer_text'),
  offerDiscount: numeric('offer_discount', { precision: 10, scale: 2 }).default('0'),
  couponCode: text('coupon_code'),
  couponDiscount: numeric('coupon_discount', { precision: 10, scale: 2 }).default('0'),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id),
}, (table) => [
  index('idx_order_items_order_id').on(table.orderId),
  index('idx_order_items_product_id').on(table.productId),
])

// ============================================
// COUPONS
// ============================================
export const coupons = pgTable('coupons', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  type: text('type').notNull(), // 'pct' or 'fixed'
  value: numeric('value', { precision: 10, scale: 2 }).notNull(),
  scope: text('scope').notNull(), // 'all', 'products', 'categories'
  expiry: text('expiry'),
  selectedProducts: text('selected_products'), // JSON array of product IDs
  selectedCategories: text('selected_categories'), // JSON array of category IDs
  createdAt: timestamp('created_at').defaultNow(),
})

// ============================================
// ABANDONED CHECKOUTS
// ============================================
export const abandonedCheckouts = pgTable('abandoned_checkouts', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull(),
  visitNumber: integer('visit_number').default(1),
  name: text('name'),
  phone: text('phone'),
  address: text('address'),
  items: text('items').notNull(), // JSON
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).default('0'),
  delivery: numeric('delivery', { precision: 10, scale: 2 }).default('0'),
  total: numeric('total', { precision: 10, scale: 2 }).default('0'),
  status: text('status').default('abandoned'), // 'abandoned' or 'completed'
  completedOrderId: text('completed_order_id'),
  visitTime: text('visit_time').notNull(),
  visitDate: text('visit_date').notNull(),
  // Checkout duration tracking (run migration API first)
  checkoutStartedAt: timestamp('checkout_started_at'),
  checkoutEndedAt: timestamp('checkout_ended_at'),
  checkoutSeconds: integer('checkout_seconds').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  // Performance indexes for common queries
  index('idx_abandoned_status').on(table.status),
  index('idx_abandoned_session_id').on(table.sessionId),
  index('idx_abandoned_phone').on(table.phone),
  index('idx_abandoned_visit_date').on(table.visitDate),
])

// ============================================
// SETTINGS
// ============================================
export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  websiteName: text('website_name').default('EcoMart'),
  slogan: text('slogan'),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  heroImages: text('hero_images'), // JSON array of image URLs
  insideDhakaDelivery: numeric('inside_dhaka_delivery', { precision: 10, scale: 2 }).default('60'),
  outsideDhakaDelivery: numeric('outside_dhaka_delivery', { precision: 10, scale: 2 }).default('120'),
  freeDeliveryMin: numeric('free_delivery_min', { precision: 10, scale: 2 }).default('500'),
  universalDelivery: boolean('universal_delivery').default(false),
  universalDeliveryCharge: numeric('universal_delivery_charge', { precision: 10, scale: 2 }).default('60'),
  whatsappNumber: text('whatsapp_number'),
  phoneNumber: text('phone_number'),
  facebookUrl: text('facebook_url'),
  messengerUsername: text('messenger_username'),
  aboutUs: text('about_us'),
  termsConditions: text('terms_conditions'),
  refundPolicy: text('refund_policy'),
  privacyPolicy: text('privacy_policy'),
  // Offer section settings
  offerTitle: text('offer_title').default('Offers'),
  offerSlogan: text('offer_slogan').default('Exclusive deals just for you'),
  // Section naming settings
  firstSectionName: text('first_section_name').default('Categories'),
  firstSectionSlogan: text('first_section_slogan').default('Browse by category'),
  secondSectionName: text('second_section_name').default('Offers'),
  secondSectionSlogan: text('second_section_slogan').default('Exclusive deals for you'),
  thirdSectionName: text('third_section_name').default('Featured'),
  thirdSectionSlogan: text('third_section_slogan').default('Handpicked products'),
  // Hero settings
  heroAnimationSpeed: integer('hero_animation_speed').default(3000),
  heroAnimationType: text('hero_animation_type').default('Fade'),
  // Inventory settings
  stockLowPercent: integer('stock_low_percent').default(25),
  stockMediumPercent: integer('stock_medium_percent').default(50),
  // Courier settings (for UI display only - actual credentials in .env)
  courierEnabled: boolean('courier_enabled').default(false),
  courierApiKey: text('courier_api_key'),
  courierSecretKey: text('courier_secret_key'),
  // Admin credentials (stored in database for easy management)
  adminUsername: text('admin_username').default('admin'),
  adminPassword: text('admin_password'),
  // Steadfast Courier API credentials
  steadfastApiKey: text('steadfast_api_key'),
  steadfastSecretKey: text('steadfast_secret_key'),
  steadfastWebhookUrl: text('steadfast_webhook_url'),
  // Cloudinary credentials (for image uploads)
  cloudinaryCloudName: text('cloudinary_cloud_name'),
  cloudinaryApiKey: text('cloudinary_api_key'),
  cloudinaryApiSecret: text('cloudinary_api_secret'),
  // Legacy timestamp columns (existing in database)
  adminUsernameUpdatedAt: text('admin_username_updated_at'),
  adminPasswordUpdatedAt: text('admin_password_updated_at'),
  steadfastApiUpdatedAt: text('steadfast_api_updated_at'),
  cloudinaryUpdatedAt: text('cloudinary_updated_at'),
})

// ============================================
// ANALYTICS
// ============================================
export const productViews = pgTable('product_views', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  productId: integer('product_id').references(() => products.id).notNull(),
  viewCount: integer('view_count').default(1),
  date: text('date').notNull(), // YYYY-MM-DD format for daily tracking
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_product_views_date').on(table.date),
  index('idx_product_views_product_id').on(table.productId),
  index('idx_product_views_product_date').on(table.productId, table.date), // Composite for aggregation queries
])

export const cartEvents = pgTable('cart_events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  productId: integer('product_id').references(() => products.id).notNull(),
  action: text('action').notNull(), // 'add' or 'remove'
  date: text('date').notNull(), // YYYY-MM-DD format
  createdAt: timestamp('created_at').defaultNow(),
})

// ============================================
// VISITOR SESSIONS
// ============================================
export const visitorSessions = pgTable('visitor_sessions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull(),
  deviceType: text('device_type').notNull(), // 'mobile', 'tablet', 'desktop'
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD format
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_visitor_sessions_date').on(table.date),
  index('idx_visitor_sessions_session_id').on(table.sessionId),
])

// ============================================
// SESSION ANALYTICS (for real duration & bounce tracking)
// ============================================
export const sessionAnalytics = pgTable('session_analytics', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull().unique(),
  // Timing
  startedAt: timestamp('started_at').notNull(), // When session started
  lastActivityAt: timestamp('last_activity_at').notNull(), // Last heartbeat/activity
  endedAt: timestamp('ended_at'), // When session ended (null if active)
  durationSeconds: integer('duration_seconds').default(0), // Calculated duration in seconds
  // Page tracking
  pageViews: integer('page_views').default(1), // Number of pages viewed
  productViews: integer('product_views').default(0), // Product pages viewed
  // Bounce tracking
  isBounced: boolean('is_bounced').default(false), // True if only 1 page viewed
  // Device info
  deviceType: text('device_type').notNull(), // 'mobile', 'tablet', 'desktop'
  browser: text('browser').notNull(),
  os: text('os').notNull(),
  // Cart tracking
  cartAdds: integer('cart_adds').default(0), // Items added to cart
  cartRemoves: integer('cart_removes').default(0), // Items removed from cart
  // Conversion
  didOrder: boolean('did_order').default(false), // Whether session resulted in order
  orderId: text('order_id'), // If converted, which order
  // Date for filtering
  date: text('date').notNull(), // YYYY-MM-DD format
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('idx_session_analytics_date').on(table.date),
  index('idx_session_analytics_session_id').on(table.sessionId),
])

// ============================================
// PAGE VIEWS (detailed tracking)
// ============================================
export const pageViews = pgTable('page_views', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  sessionId: text('session_id').notNull(),
  page: text('page').notNull(), // 'home', 'product', 'cart', 'checkout', etc.
  productId: integer('product_id'), // If product page
  referrer: text('referrer'), // Where they came from
  date: text('date').notNull(), // YYYY-MM-DD format
  createdAt: timestamp('created_at').defaultNow(),
})
