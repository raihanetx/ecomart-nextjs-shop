'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import type { 
  Category, Product, InventoryItem, Alert, AdminReview, 
  Order, Coupon, CouponProduct, CouponCategory,
  AbandonedCheckout, CustomerProfile, Settings, ViewType
} from '@/types'

// Navigation items
const adminNavItems = [
  { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
  { id: 'orders', label: 'Orders', icon: 'ri-shopping-bag-line' },
  { id: 'products', label: 'Products', icon: 'ri-box-3-line' },
  { id: 'inventory', label: 'Inventory', icon: 'ri-archive-line' },
  { id: 'categories', label: 'Categories', icon: 'ri-folder-line' },
  { id: 'coupons', label: 'Coupons', icon: 'ri-ticket-2-line' },
  { id: 'reviews', label: 'Reviews', icon: 'ri-star-line' },
  { id: 'abandoned', label: 'Abandoned', icon: 'ri-alert-line' },
  { id: 'customers', label: 'Customers', icon: 'ri-user-line' },
]

// Configuration items - Credentials, Settings, and Backup
const adminConfigItems = [
  { id: 'credentials', label: 'Credentials', icon: 'ri-shield-keyhole-line' },
  { id: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
  { id: 'backup', label: 'Backup', icon: 'ri-database-2-line' },
]

// Helper functions
const getAdminPageTitle = (dashView: string): string => {
  const titles: Record<string, string> = {
    overview: 'Store Overview',
    orders: 'Order Management',
    products: 'Product Management',
    inventory: 'Inventory Management',
    categories: 'Category Management',
    coupons: 'Coupon Management',
    reviews: 'Review Management',
    abandoned: 'Abandoned Checkouts',
    customers: 'Customer History',
    content: 'Page Content',
    credentials: 'Credentials',
    settings: 'System Settings',
    backup: 'Backup & Restore',
  }
  return titles[dashView] || 'Dashboard'
}

const getAdminPageDesc = (dashView: string): string => {
  const descs: Record<string, string> = {
    overview: 'Performance metrics for today',
    orders: 'Detailed overview of all incoming requests',
    products: 'Manage your store items and inventory',
    inventory: 'Track and manage product stock levels',
    categories: 'Organize your product categories',
    coupons: 'Manage discount coupons for your store',
    reviews: 'Manage customer reviews and feedback',
    abandoned: 'Customers who visited but didn\'t complete checkout',
    customers: 'Overview of customer orders and spending',
    content: 'Manage your store pages and policies',
    credentials: 'Manage admin and API credentials',
    settings: 'Configure your store preferences and policies',
    backup: 'Download backup or restore from file',
  }
  return descs[dashView] || ''
}

// Types for the context
interface AdminContextType {
  // Navigation
  dashView: string
  setDashView: (view: string) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  navItems: typeof adminNavItems
  configItems: typeof adminConfigItems
  getPageTitle: (view: string) => string
  getPageDesc: (view: string) => string
  
  // Toast
  showToast: boolean
  setShowToast: (show: boolean) => void
  toastMsg: string
  setToastMsg: (msg: string) => void
  toastType: 'success' | 'error'
  showToastMsg: (msg: string, type?: 'success' | 'error') => void
  
  // Loading state
  isLoading: boolean
  
  // Inventory
  inventory: InventoryItem[]
  setInventory: (inventory: InventoryItem[]) => void
  expandedInventory: number | null
  setExpandedInventory: (id: number | null) => void
  editingInventoryItem: InventoryItem | null
  setEditingInventoryItem: (item: InventoryItem | null) => void
  refetchInventory: () => void
  
  // Alerts
  alerts: Alert[]
  
  // Reviews
  adminReviews: AdminReview[]
  setAdminReviews: (reviews: AdminReview[]) => void
  
  // Categories
  categories: Category[]
  setCategories: (categories: Category[]) => void
  editingCategory: Category | null
  setEditingCategory: (category: Category | null) => void
  refetchCategories: () => void
  
  // Products
  products: Product[]
  setProducts: (products: Product[]) => void
  editingProduct: Product | null
  setEditingProduct: (product: Product | null) => void
  prodVarieties: {id: number; name: string; price: string; stock: string; discount: string; discountType: 'pct' | 'fixed'; discountValue: string}[]
  setProdVarieties: (varieties: {id: number; name: string; price: string; stock: string; discount: string; discountType: 'pct' | 'fixed'; discountValue: string}[] | ((prev: {id: number; name: string; price: string; stock: string; discount: string; discountType: 'pct' | 'fixed'; discountValue: string}[]) => {id: number; name: string; price: string; stock: string; discount: string; discountType: 'pct' | 'fixed'; discountValue: string}[])) => void
  prodFaqs: {id: number; question: string; answer: string}[]
  setProdFaqs: (faqs: {id: number; question: string; answer: string}[] | ((prev: {id: number; question: string; answer: string}[]) => {id: number; question: string; answer: string}[])) => void
  prodImages: string[]
  setProdImages: (images: string[] | ((prev: string[]) => string[])) => void
  prodRelated: number[]
  setProdRelated: (ids: number[] | ((prev: number[]) => number[])) => void
  allRelatedOptions: {id: number; name: string; category: string; price: number; image: string}[]
  refetchProducts: () => void
  
  // Orders
  orders: Order[]
  setOrders: (orders: Order[] | ((prev: Order[]) => Order[])) => void
  currentOrderFilter: 'all' | 'pending' | 'approved' | 'canceled' | 'cancel_customer' | 'cancel_admin' | 'courier_review' | 'courier_shipping' | 'courier_delivered' | 'courier_cancel'
  setCurrentOrderFilter: (filter: 'all' | 'pending' | 'approved' | 'canceled' | 'cancel_customer' | 'cancel_admin' | 'courier_review' | 'courier_shipping' | 'courier_delivered' | 'courier_cancel') => void
  selectedOrder: Order | null
  setSelectedOrder: (order: Order | null) => void
  refetchOrders: () => void
  
  // Coupons
  coupons: Coupon[]
  setCoupons: (coupons: Coupon[]) => void
  editingCoupon: Coupon | null
  setEditingCoupon: (coupon: Coupon | null) => void
  couponForm: {
    code: string
    type: 'pct' | 'fixed'
    value: string
    expiry: string
    scope: 'all' | 'products' | 'categories'
  }
  setCouponForm: (form: {
    code: string
    type: 'pct' | 'fixed'
    value: string
    expiry: string
    scope: 'all' | 'products' | 'categories'
  }) => void
  pickedProducts: number[]
  setPickedProducts: (ids: number[]) => void
  pickedCategories: string[]
  setPickedCategories: (categories: string[]) => void
  couponProducts: CouponProduct[]
  couponCategories: CouponCategory[]
  refetchCoupons: () => void
  
  // Abandoned
  abandonedCheckouts: AbandonedCheckout[]
  expandedAbandoned: number | null
  setExpandedAbandoned: (id: number | null) => void
  
  // Customers
  customerProfiles: CustomerProfile[]
  expandedCustomer: number | null
  setExpandedCustomer: (id: number | null) => void
  
  // Settings
  settings: Settings
  setSettings: (settings: Settings | ((prev: Settings) => Settings)) => void
  refetchSettings: () => void
  
  // Modal
  isModalOpen: boolean
  setIsModalOpen: (open: boolean) => void
  newProduct: { name: string; stock: string }
  setNewProduct: (product: { name: string; stock: string }) => void
  handleAddProductInventory: (e: React.FormEvent) => void
  
  // Edit functions
  openCategoryEdit: (cat: Category | null) => void
  openProductEdit: (prod: Product | null) => void
  openCouponEdit: (coupon: Coupon | null) => void
  
  // Set view for navigation
  setView: (v: ViewType) => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

export function AdminProvider({ children, setView }: { children: ReactNode; setView: (v: ViewType) => void }) {
  // Navigation
  const [dashView, setDashView] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  
  // Toast
  const [showToast, setShowToast] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  
  const showToastMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg)
    setToastType(type)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2200)
  }
  
  // Inventory - start empty, can be populated from API
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [expandedInventory, setExpandedInventory] = useState<number | null>(null)
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null)
  
  // Alerts - computed from inventory
  const alerts: Alert[] = []
  
  // Reviews - start empty
  const [adminReviews, setAdminReviews] = useState<AdminReview[]>([])
  
  // Categories - fetched from API
  const [categories, setCategories] = useState<Category[]>([])
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  
  // Products - fetched from API
  const [products, setProducts] = useState<Product[]>([])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [prodVarieties, setProdVarieties] = useState<{id: number; name: string; price: string; stock: string; discount: string; discountType: 'pct' | 'fixed'; discountValue: string}[]>([])
  const [prodFaqs, setProdFaqs] = useState<{id: number; question: string; answer: string}[]>([])
  const [prodImages, setProdImages] = useState<string[]>([])
  const [prodRelated, setProdRelated] = useState<number[]>([])
  
  // All related options - populated from products
  const allRelatedOptions = products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: parseFloat(p.price.replace('TK', '')) || 0,
    image: p.image
  }))
  
  // Orders - fetched from API
  const [orders, setOrders] = useState<Order[]>([])
  const [currentOrderFilter, setCurrentOrderFilter] = useState<'all' | 'pending' | 'approved' | 'canceled' | 'cancel_customer' | 'cancel_admin' | 'courier_review' | 'courier_shipping' | 'courier_delivered' | 'courier_cancel'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  
  // Coupon products/categories - populated from products
  const couponProducts: CouponProduct[] = products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    img: p.image
  }))
  
  const couponCategories: CouponCategory[] = categories.map(c => ({
    name: c.name,
    color: '#16a34a'
  }))
  
  // Coupons - fetched from API
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'pct' as 'pct' | 'fixed',
    value: '',
    expiry: '',
    scope: 'all' as 'all' | 'products' | 'categories',
  })
  const [pickedProducts, setPickedProducts] = useState<number[]>([])
  const [pickedCategories, setPickedCategories] = useState<string[]>([])
  
  // Abandoned - start empty
  const [abandonedCheckouts, setAbandonedCheckouts] = useState<AbandonedCheckout[]>([])
  const [expandedAbandoned, setExpandedAbandoned] = useState<number | null>(null)
  
  // Customers - start empty
  const [customerProfiles, setCustomerProfiles] = useState<CustomerProfile[]>([])
  const [expandedCustomer, setExpandedCustomer] = useState<number | null>(null)
  
  // Settings - defaults with all fields
  const [settings, setSettings] = useState<Settings>({
    storeName: 'EcoMart',
    storeEmail: 'support@ecomart.com',
    storePhone: '+880 1234-567890',
    storeAddress: 'Dhaka, Bangladesh',
    currency: 'TK',
    deliveryCharge: 60,
    freeDeliveryMin: 500,
    universalDelivery: false,
    universalDeliveryCharge: 60,
    websiteName: 'EcoMart',
    slogan: '',
    logoUrl: '',
    faviconUrl: '',
    heroImages: [],
    insideDhakaDelivery: 60,
    outsideDhakaDelivery: 120,
    whatsappNumber: '',
    phoneNumber: '',
    facebookUrl: '',
    messengerUsername: '',
    aboutUs: '',
    termsConditions: '',
    refundPolicy: '',
    privacyPolicy: '',
    offerTitle: 'Offers',
    offerSlogan: 'Exclusive deals just for you',
    firstSectionName: 'Categories',
    firstSectionSlogan: '',
    secondSectionName: 'Offers',
    secondSectionSlogan: '',
    thirdSectionName: 'Featured',
    thirdSectionSlogan: '',
    heroAnimationSpeed: 3000,
    heroAnimationType: 'Fade',
    stockLowPercent: 25,
    stockMediumPercent: 50,
    courierEnabled: false,
    // Admin credentials
    adminUsername: 'admin',
    adminPassword: '',
    adminUsernameUpdatedAt: null,
    adminPasswordUpdatedAt: null,
    // Steadfast credentials
    steadfastApiKey: '',
    steadfastSecretKey: '',
    steadfastWebhookUrl: '',
    steadfastApiUpdatedAt: null,
    // Cloudinary credentials
    cloudinaryCloudName: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
    cloudinaryUpdatedAt: null,
    // Has-value flags for sensitive fields
    hasAdminPassword: false,
    hasSteadfastApiKey: false,
    hasSteadfastSecretKey: false,
    hasCloudinaryApiSecret: false,
  })
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({ name: '', stock: '' })
  
  // Handle add product to inventory
  const handleAddProductInventory = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProduct.name || !newProduct.stock) return
    const qty = parseInt(newProduct.stock)
    const newItem: InventoryItem = {
      id: Date.now(),
      name: newProduct.name,
      category: 'General',
      image: 'https://via.placeholder.com/80',
      variants: [{ name: 'Default', stock: qty, initialStock: qty }],
      lastEdited: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    setInventory(prev => [newItem, ...prev])
    setNewProduct({ name: '', stock: '' })
    setIsModalOpen(false)
    showToastMsg('Product added to inventory!')
  }
  
  // Category edit function
  const openCategoryEdit = (cat: Category | null = null) => {
    if (cat) {
      setEditingCategory({ ...cat })
    } else {
      setEditingCategory({
        id: 'CAT-' + Date.now().toString().slice(-6),
        name: '',
        type: 'icon',
        icon: '',
        image: '',
        items: 0,
        created: 'Just now',
        status: 'Active'
      })
    }
  }
  
  // Product edit function
  const openProductEdit = (prod: Product | null = null) => {
    if (prod) {
      setEditingProduct({ ...prod, shortDesc: '', longDesc: '', offerSwitch: prod.offer })
    } else {
      setEditingProduct({
        id: Date.now(),
        name: '',
        category: '',
        image: 'https://via.placeholder.com/80',
        variants: '0 variants',
        price: 'TK0',
        discount: '0%',
        offer: false,
        status: 'active',
        shortDesc: '',
        longDesc: '',
        offerSwitch: false
      })
    }
    setProdVarieties([])
    setProdFaqs([])
    setProdImages([])
    setProdRelated([])
  }
  
  // Coupon edit function
  const openCouponEdit = (coupon: Coupon | null = null) => {
    if (coupon && coupon.id) {
      setCouponForm({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value.toString(),
        expiry: coupon.expiry,
        scope: coupon.scope,
      })
      setPickedProducts(coupon.selectedProducts || [])
      setPickedCategories(coupon.selectedCategories || [])
      setEditingCoupon(coupon)
    } else {
      setCouponForm({ code: '', type: 'pct', value: '', expiry: '', scope: 'all' })
      setPickedProducts([])
      setPickedCategories([])
      setEditingCoupon({ id: '', code: '', type: 'pct', value: 0, scope: 'all', expiry: '' })
    }
  }
  
  // Fetch functions
  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      if (data.success) {
        setCategories(data.data.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          type: cat.type || 'icon',
          icon: cat.icon || '',
          image: cat.image || '',
          items: cat.items || 0,
          created: cat.created_at ? new Date(cat.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Just now',
          status: cat.status || 'Active'
        })))
      }
    } catch (error) {
    }
  }
  
  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      if (data.success) {
        setProducts(data.data.map((prod: any) => ({
          id: prod.id,
          name: prod.name,
          category: prod.category,
          image: prod.image,
          variants: '1 variant',
          price: `TK${Math.round(parseFloat(prod.price) || 0)}`,
          discount: prod.discount || '0%',
          offer: prod.offer === 1 || prod.offer === true,
          status: prod.status || 'active',
          shortDesc: prod.shortDesc || '',
          longDesc: prod.longDesc || '',
          stockCount: prod.stockCount || 0,
          variantCount: prod.variantCount || 0,
          priceRange: prod.priceRange || { min: 0, max: 0 }
        })))
      }
    } catch (error) {
    }
  }
  
  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders')
      const data = await response.json()
      if (data.success) {
        const mappedOrders = data.data.map((ord: any) => ({
          id: ord.id,
          customer: ord.customerName || ord.customer_name,
          phone: ord.phone,
          address: ord.address,
          note: ord.note || '',
          date: ord.date,
          time: ord.time,
          paymentMethod: ord.paymentMethod || ord.payment_method,
          status: ord.status,
          courierStatus: ord.courierStatus || ord.courier_status || '',
          consignmentId: ord.consignmentId || ord.consignment_id,
          trackingCode: ord.trackingCode || ord.tracking_code,
          courierDeliveredAt: ord.courierDeliveredAt || ord.courier_delivered_at,
          subtotal: Math.round(parseFloat(ord.subtotal) || 0),
          delivery: Math.round(parseFloat(ord.delivery) || 0),
          discount: Math.round(parseFloat(ord.discount) || 0),
          couponCodes: ord.couponCodes ? JSON.parse(ord.couponCodes) : (ord.coupon_codes ? JSON.parse(ord.coupon_codes) : []),
          couponAmount: Math.round(parseFloat(ord.couponAmount ?? ord.coupon_amount) || 0),
          total: Math.round(parseFloat(ord.total) || 0),
          canceledBy: ord.canceledBy || ord.canceled_by,
          items: ord.items || [],
          createdAt: ord.createdAt || ord.created_at
        }))
        setOrders(mappedOrders)
      }
    } catch (error) {
    }
  }
  
  const fetchCoupons = async () => {
    try {
      const response = await fetch('/api/coupons')
      const data = await response.json()
      if (data.success) {
        setCoupons(data.data.map((coup: any) => ({
          id: coup.id,
          code: coup.code,
          type: coup.type,
          value: coup.value,
          scope: coup.scope,
          expiry: coup.expiry || '',
          selectedProducts: coup.selected_products ? JSON.parse(coup.selected_products) : [],
          selectedCategories: coup.selected_categories ? JSON.parse(coup.selected_categories) : []
        })))
      }
    } catch (error) {
    }
  }
  
  const fetchCustomers = async () => {
    try {
      // SMART: Fetch customers and orders in PARALLEL (not N+1 queries!)
      const [customersRes, ordersRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/orders')
      ])
      
      const [customersData, ordersData] = await Promise.all([
        customersRes.json(),
        ordersRes.json()
      ])
      
      if (customersData.success) {
        // SMART: Build a map of orders by customer ID (single pass)
        const ordersByCustomer: Record<number, any[]> = {}
        
        if (ordersData.success && Array.isArray(ordersData.data)) {
          for (const ord of ordersData.data) {
            const custId = ord.customerId || ord.customer_id
            if (custId) {
              if (!ordersByCustomer[custId]) ordersByCustomer[custId] = []
              
              // Calculate relative time
              let relativeTime = ''
              if (ord.createdAt || ord.created_at) {
                const orderDate = new Date(ord.createdAt || ord.created_at)
                const now = new Date()
                const diffMs = now.getTime() - orderDate.getTime()
                const diffMins = Math.floor(diffMs / 60000)
                const diffHours = Math.floor(diffMs / 3600000)
                const diffDays = Math.floor(diffMs / 86400000)
                
                if (diffMins < 1) relativeTime = 'Just now'
                else if (diffMins < 60) relativeTime = `${diffMins} mins ago`
                else if (diffHours < 24) relativeTime = `${diffHours} hours ago`
                else if (diffDays < 7) relativeTime = `${diffDays} days ago`
                else relativeTime = `${Math.floor(diffDays / 7)} weeks ago`
              }
              
              ordersByCustomer[custId].push({
                date: ord.date || '',
                time: ord.time || '',
                createdAt: ord.createdAt || ord.created_at || null,
                visitCount: ordersByCustomer[custId].length + 1,
                total: parseFloat(String(ord.total || 0)),
                paymentMethod: ord.paymentMethod || ord.payment_method || 'Cash on Delivery',
                relativeTime,
                products: Array.isArray(ord.items) ? ord.items.map((item: any) => ({
                  name: item.name || '',
                  variants: [{ label: item.variant || null, qty: parseInt(String(item.qty || 1)) }]
                })) : []
              })
            }
          }
        }
        
        // SMART: Single pass to build customer profiles
        const customersWithOrders = customersData.data.map((cust: any) => {
          const orders = ordersByCustomer[cust.id] || []
          const lastOrder = orders[0]
          
          let lastOrderAgo = ''
          if (lastOrder?.createdAt) {
            const orderDate = new Date(lastOrder.createdAt)
            const now = new Date()
            const diffMs = now.getTime() - orderDate.getTime()
            const diffMins = Math.floor(diffMs / 60000)
            const diffHours = Math.floor(diffMs / 3600000)
            const diffDays = Math.floor(diffMs / 86400000)
            
            if (diffMins < 1) lastOrderAgo = 'Just now'
            else if (diffMins < 60) lastOrderAgo = `${diffMins} mins ago`
            else if (diffHours < 24) lastOrderAgo = `${diffHours} hours ago`
            else if (diffDays < 7) lastOrderAgo = `${diffDays} days ago`
            else if (diffDays < 30) lastOrderAgo = `${Math.floor(diffDays / 7)} weeks ago`
            else lastOrderAgo = `${Math.floor(diffDays / 30)} months ago`
          } else if (lastOrder) {
            lastOrderAgo = lastOrder.date
          }

          return {
            id: cust.id,
            name: cust.name || 'Unknown',
            phone: cust.phone || '',
            address: cust.address || '',
            totalOrders: parseInt(String(cust.totalOrders || orders.length)),
            totalSpent: parseFloat(String(cust.totalSpent || 0)),
            lastOrderAgo,
            orders
          }
        })
        
        setCustomerProfiles(customersWithOrders)
      }
    } catch (error) {
    }
  }
  
  const fetchSettings = async () => {
    try {
      // CRITICAL: Add cache-busting to ensure fresh data after credential saves
      const response = await fetch(`/api/settings?_t=${Date.now()}`)
      const data = await response.json()
      if (data.success) {
        const d = data.data
        setSettings({
          storeName: d.websiteName || 'EcoMart',
          storeEmail: 'support@ecomart.com',
          storePhone: d.phoneNumber || '+880 1234-567890',
          storeAddress: 'Dhaka, Bangladesh',
          currency: 'TK',
          deliveryCharge: d.insideDhakaDelivery || 60,
          freeDeliveryMin: d.freeDeliveryMin || 500,
          universalDelivery: d.universalDelivery || false,
          universalDeliveryCharge: d.universalDeliveryCharge || 60,
          websiteName: d.websiteName || 'EcoMart',
          slogan: d.slogan || '',
          logoUrl: d.logoUrl || '',
          faviconUrl: d.faviconUrl || '',
          heroImages: d.heroImages || '[]',
          insideDhakaDelivery: d.insideDhakaDelivery || 60,
          outsideDhakaDelivery: d.outsideDhakaDelivery || 120,
          whatsappNumber: d.whatsappNumber || '',
          phoneNumber: d.phoneNumber || '',
          facebookUrl: d.facebookUrl || '',
          messengerUsername: d.messengerUsername || '',
          aboutUs: d.aboutUs || '',
          termsConditions: d.termsConditions || '',
          refundPolicy: d.refundPolicy || '',
          privacyPolicy: d.privacyPolicy || '',
          offerTitle: d.offerTitle || 'Offers',
          offerSlogan: d.offerSlogan || 'Exclusive deals just for you',
          firstSectionName: d.firstSectionName ?? 'Categories',
          firstSectionSlogan: d.firstSectionSlogan ?? '',
          secondSectionName: d.secondSectionName ?? 'Offers',
          secondSectionSlogan: d.secondSectionSlogan ?? '',
          thirdSectionName: d.thirdSectionName ?? 'Featured',
          thirdSectionSlogan: d.thirdSectionSlogan ?? '',
          heroAnimationSpeed: d.heroAnimationSpeed || 3000,
          heroAnimationType: d.heroAnimationType || 'Fade',
          stockLowPercent: d.stockLowPercent || 25,
          stockMediumPercent: d.stockMediumPercent || 50,
          courierEnabled: d.courierEnabled || false,
          // Admin credentials with timestamps
          adminUsername: d.adminUsername || 'admin',
          adminPassword: d.adminPassword || '',
          adminUsernameUpdatedAt: d.adminUsernameUpdatedAt || null,
          adminPasswordUpdatedAt: d.adminPasswordUpdatedAt || null,
          // Steadfast credentials with shared timestamp
          steadfastApiKey: d.steadfastApiKey || '',
          steadfastSecretKey: d.steadfastSecretKey || '',
          steadfastWebhookUrl: d.steadfastWebhookUrl || '',
          steadfastApiUpdatedAt: d.steadfastApiUpdatedAt || null,
          // Cloudinary credentials with shared timestamp
          cloudinaryCloudName: d.cloudinaryCloudName || '',
          cloudinaryApiKey: d.cloudinaryApiKey || '',
          cloudinaryApiSecret: d.cloudinaryApiSecret || '',
          cloudinaryUpdatedAt: d.cloudinaryUpdatedAt || null,
          // Has-value flags for sensitive fields
          hasAdminPassword: d.hasAdminPassword ?? !!d.adminPassword,
          hasSteadfastApiKey: d.hasSteadfastApiKey ?? !!d.steadfastApiKey,
          hasSteadfastSecretKey: d.hasSteadfastSecretKey ?? !!d.steadfastSecretKey,
          hasCloudinaryApiSecret: d.hasCloudinaryApiSecret ?? !!d.cloudinaryApiSecret,
        })
      }
    } catch (error) {
    }
  }
  
  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory')
      const data = await response.json()
      if (data.success && data.data) {
        setInventory(data.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          image: item.image,
          variants: item.variants.map((v: any) => ({
            id: v.id,
            name: v.name,
            label: v.name,
            stock: v.stock,
            initialStock: v.initialStock,
          })),
          lastEdited: item.lastEdited,
        })))
      }
    } catch (error) {
    }
  }
  
  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/reviews')
      const data = await response.json()
      if (data.success && data.data) {
        setAdminReviews(data.data.map((review: any) => ({
          id: review.id,
          customerName: review.name,
          rating: review.rating,
          text: review.text,
          date: review.date,
          time: '',
          product: 'Product',
          productCategory: '',
        })))
      }
    } catch (error) {
    }
  }

  const fetchAbandoned = async () => {
    try {
      const response = await fetch('/api/abandoned')
      const data = await response.json()
      if (data.success && data.data) {
        setAbandonedCheckouts(data.data)
      }
    } catch (error) {
    }
  }
  
  // Sync dashView with URL parameter on mount and URL changes
  useEffect(() => {
    const syncViewFromUrl = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const viewParam = params.get('view')
        if (viewParam) {
          const validViews = ['overview', 'orders', 'products', 'inventory', 'categories', 'coupons', 'reviews', 'abandoned', 'customers', 'credentials', 'settings', 'backup']
          if (validViews.includes(viewParam)) {
            setDashView(viewParam)
          }
        }
      }
    }
    
    // Sync on mount
    syncViewFromUrl()
    
    // Listen for browser back/forward buttons
    window.addEventListener('popstate', syncViewFromUrl)
    
    return () => {
      window.removeEventListener('popstate', syncViewFromUrl)
    }
  }, [])
  
  // Fetch all data on mount
  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        fetchCategories(),
        fetchProducts(),
        fetchOrders(),
        fetchCoupons(),
        fetchCustomers(),
        fetchSettings(),
        fetchInventory(),
        fetchReviews(),
        fetchAbandoned(),
      ])
      setIsLoading(false)
    }
    fetchData()
  }, [])
  
  const value: AdminContextType = {
    // Navigation
    dashView,
    setDashView,
    sidebarCollapsed,
    setSidebarCollapsed,
    navItems: adminNavItems,
    configItems: adminConfigItems,
    getPageTitle: getAdminPageTitle,
    getPageDesc: getAdminPageDesc,
    
    // Loading
    isLoading,
    
    // Toast
    showToast,
    setShowToast,
    toastMsg,
    setToastMsg,
    toastType,
    showToastMsg,
    
    // Inventory
    inventory,
    setInventory,
    expandedInventory,
    setExpandedInventory,
    editingInventoryItem,
    setEditingInventoryItem,
    refetchInventory: fetchInventory,
    
    // Alerts
    alerts,
    
    // Reviews
    adminReviews,
    setAdminReviews,
    
    // Categories
    categories,
    setCategories,
    editingCategory,
    setEditingCategory,
    refetchCategories: fetchCategories,
    
    // Products
    products,
    setProducts,
    editingProduct,
    setEditingProduct,
    prodVarieties,
    setProdVarieties,
    prodFaqs,
    setProdFaqs,
    prodImages,
    setProdImages,
    prodRelated,
    setProdRelated,
    allRelatedOptions,
    refetchProducts: fetchProducts,
    
    // Orders
    orders,
    setOrders,
    currentOrderFilter,
    setCurrentOrderFilter,
    selectedOrder,
    setSelectedOrder,
    refetchOrders: fetchOrders,
    
    // Coupons
    coupons,
    setCoupons,
    editingCoupon,
    setEditingCoupon,
    couponForm,
    setCouponForm,
    pickedProducts,
    setPickedProducts,
    pickedCategories,
    setPickedCategories,
    couponProducts,
    couponCategories,
    refetchCoupons: fetchCoupons,
    
    // Abandoned
    abandonedCheckouts,
    expandedAbandoned,
    setExpandedAbandoned,
    
    // Customers
    customerProfiles,
    expandedCustomer,
    setExpandedCustomer,
    
    // Settings
    settings,
    setSettings,
    refetchSettings: fetchSettings,
    
    // Modal
    isModalOpen,
    setIsModalOpen,
    newProduct,
    setNewProduct,
    handleAddProductInventory,
    
    // Edit functions
    openCategoryEdit,
    openProductEdit,
    openCouponEdit,
    
    // Navigation
    setView,
  }
  
  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}
