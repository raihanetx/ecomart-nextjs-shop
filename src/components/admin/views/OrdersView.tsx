'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { useCsrfFetch } from '@/hooks/useCsrfFetch'
import type { Order, OrderItem } from '@/types'
import { roundPrice } from '@/lib/utils'

// Extended OrderItem for edit mode
interface EditItem extends OrderItem {
  productId?: number
  tempId: string
}

// Product type
interface Product {
  id: number
  name: string
  image: string
  price: number
  category?: string
  categoryId?: number
  discountType?: 'pct' | 'fixed'
  discountValue?: number
}

// Variant type
interface ProductVariant {
  id: number
  name: string
  stock: number
  price: number
  discountType?: 'pct' | 'fixed'
  discountValue?: number
}

// Category type
interface Category {
  id: number
  name: string
}

export function OrdersView() {
  const { csrfFetch } = useCsrfFetch()
  
  const {
    orders,
    currentOrderFilter,
    setCurrentOrderFilter,
    selectedOrder,
    setSelectedOrder,
    setOrders,
    showToastMsg,
    refetchOrders,
    settings,
  } = useAdmin()

  // Edit Mode States
  const [editMode, setEditMode] = useState(false)
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [productVariants, setProductVariants] = useState<Record<number, ProductVariant[]>>({})
  const [selectedProducts, setSelectedProducts] = useState<number[]>([])
  const [selectedVariants, setSelectedVariants] = useState<Record<number, string>>({})
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [itemVariants, setItemVariants] = useState<Record<string, ProductVariant[]>>({})
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [variantPopupProductId, setVariantPopupProductId] = useState<number | null>(null)
  const [itemVariantPopupId, setItemVariantPopupId] = useState<string | null>(null)
  const PRODUCTS_PER_PAGE = 4
  const [showInvoice, setShowInvoice] = useState(false)

  // Courier verification state
  const [verifyingCourier, setVerifyingCourier] = useState(false)
  const [courierStatus, setCourierStatus] = useState<'unverified' | 'valid' | 'invalid'>('unverified')

  // Customer Info Edit States
  const [editCustomer, setEditCustomer] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')

  // Create Order Modal State
  const [createOrderOpen, setCreateOrderOpen] = useState(false)
  const [newCustomer, setNewCustomer] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newItems, setNewItems] = useState<EditItem[]>([])
  const [creating, setCreating] = useState(false)
  // Create Order - Product Search States
  const [newProdSearch, setNewProdSearch] = useState('')
  const [newProdPage, setNewProdPage] = useState(1)
  const [newSelectedVariants, setNewSelectedVariants] = useState<Record<number, string>>({})
  const [newQuantities, setNewQuantities] = useState<Record<number, number>>({})
  const [newShowAddProd, setNewShowAddProd] = useState(true)
  // Create Order - Coupon States
  const [newCouponCode, setNewCouponCode] = useState('')
  const [newCouponDiscount, setNewCouponDiscount] = useState(0)
  const [couponValidating, setCouponValidating] = useState(false)
  const [couponError, setCouponError] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{code: string; discount: number; type: string; value: number} | null>(null)

  // Report Download States
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportType, setReportType] = useState<'weekly' | 'monthly' | 'current_filter' | 'custom'>('weekly')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [downloading, setDownloading] = useState(false)

  const filteredOrders = currentOrderFilter === 'all'
    ? orders
    : currentOrderFilter === 'cancel_customer'
    ? orders.filter(order => order.status === 'canceled' && order.canceledBy === 'Customer')
    : currentOrderFilter === 'cancel_admin'
    ? orders.filter(order => order.status === 'canceled' && order.canceledBy === 'Admin')
    : currentOrderFilter === 'courier_review'
    ? orders.filter(order => order.courierStatus === 'in_review' || order.courierStatus === 'pending')
    : currentOrderFilter === 'courier_shipping'
    ? orders.filter(order => order.courierStatus === 'delivered_approval_pending' || order.courierStatus === 'partial_delivered_approval_pending')
    : currentOrderFilter === 'courier_delivered'
    ? orders.filter(order => order.courierStatus === 'delivered' || order.courierStatus === 'partial_delivered')
    : currentOrderFilter === 'courier_cancel'
    ? orders.filter(order => order.courierStatus === 'cancelled' || order.courierStatus === 'cancelled_approval_pending')
    : orders.filter(order => order.status === currentOrderFilter)

  // Fetch all products and categories on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories')
        ])
        const prodData = await prodRes.json()
        const catData = await catRes.json()
        if (prodData.success) setAllProducts(prodData.data || [])
        if (catData.success) setAllCategories(catData.data || [])

        // Fetch variants for all products
        if (prodData.data && prodData.data.length > 0) {
          const variantsMap: Record<number, ProductVariant[]> = {}
          for (const p of prodData.data) {
            try {
              const vRes = await csrfFetch(`/api/variants?productId=${p.id}`)
              const vData = await vRes.json()
              if (vData.success) variantsMap[p.id] = vData.data || []
            } catch {}
          }
          setProductVariants(variantsMap)
        }
      } catch {}
    }
    fetchData()
  }, [])

  // Enter Edit Mode
  const enterEditMode = async () => {
    if (!selectedOrder) return
    
    // Create edit items with tempIds first
    const itemsWithTempIds = selectedOrder.items.map((item, i) => ({
      ...item,
      productId: item.productId,
      tempId: `item-${i}-${Date.now()}`
    }))
    setEditItems(itemsWithTempIds)
    setEditCustomer(selectedOrder.customer)
    setEditPhone(selectedOrder.phone)
    setEditAddress(selectedOrder.address)
    setEditMode(true)
    
    // Load variants for existing items using the same tempIds
    const newItemVariants: Record<string, ProductVariant[]> = {}
    for (let i = 0; i < selectedOrder.items.length; i++) {
      const item = selectedOrder.items[i]
      if (item.productId) {
        try {
          const res = await csrfFetch(`/api/variants?productId=${item.productId}`)
          const data = await res.json()
          if (data.success) {
            newItemVariants[itemsWithTempIds[i].tempId] = data.data || []
          }
        } catch {}
      }
    }
    setItemVariants(newItemVariants)
  }

  // Exit Edit Mode
  const exitEditMode = () => {
    setEditMode(false)
    setEditItems([])
    setSelectedProducts([])
    setSelectedVariants({})
    setQuantities({})
    setItemVariants({})
    setShowAddProduct(false)
    setProductSearch('')
    setProductPage(1)
    setEditCustomer('')
    setEditPhone('')
    setEditAddress('')
    setVariantPopupProductId(null)
    setItemVariantPopupId(null)
    setShowInvoice(false)
  }

  // Filter products by search (name, category, variety)
  const filteredProducts = allProducts.filter(p => {
    if (!productSearch) return true
    const q = productSearch.toLowerCase()
    const variants = productVariants[p.id] || []
    return p.name.toLowerCase().includes(q) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      variants.some(v => v.name.toLowerCase().includes(q))
  })

  // Pagination
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
  const paginatedProducts = filteredProducts.slice(
    (productPage - 1) * PRODUCTS_PER_PAGE,
    productPage * PRODUCTS_PER_PAGE
  )

  // Get category name
  const getCategoryName = (categoryId?: number) => {
    if (!categoryId) return '—'
    const cat = allCategories.find(c => c.id === categoryId)
    return cat?.name || '—'
  }

  // Get price range for product
  const getPriceRange = (productId: number) => {
    const variants = productVariants[productId]
    if (!variants || variants.length === 0) {
      const product = allProducts.find(p => p.id === productId)
      return product ? `TK ${roundPrice(product.price)}` : '—'
    }
    const prices = variants.map(v => v.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    return min === max ? `TK ${roundPrice(min)}` : `TK ${roundPrice(min)} - ${roundPrice(max)}`
  }

  // Get total stock for product
  const getTotalStock = (productId: number) => {
    const variants = productVariants[productId]
    if (!variants || variants.length === 0) return { total: 0, available: 0 }
    const total = variants.reduce((sum, v) => sum + v.stock, 0)
    // For now available = total (can be modified later based on reserved stock)
    return { total, available: total }
  }

  // Get variant names
  const getVariantNames = (productId: number) => {
    const variants = productVariants[productId]
    if (!variants || variants.length === 0) return '—'
    return variants.map(v => v.name).join(', ')
  }

  // Close modal completely
  const closeModal = () => {
    exitEditMode()
    setShowInvoice(false)
    setSelectedOrder(null)
  }

  // Toggle product selection
  const toggleProductSelection = (productId: number) => {
    if (selectedProducts.includes(productId)) {
      // Remove from selection
      setSelectedProducts(selectedProducts.filter(id => id !== productId))
      const newVariants = { ...selectedVariants }
      delete newVariants[productId]
      setSelectedVariants(newVariants)
      const newQuantities = { ...quantities }
      delete newQuantities[productId]
      setQuantities(newQuantities)
    } else {
      // Add to selection
      setSelectedProducts([...selectedProducts, productId])
      setSelectedVariants({ ...selectedVariants, [productId]: '' })
      setQuantities({ ...quantities, [productId]: 1 })
    }
  }

  // Update variant for a product
  const updateProductVariant = (productId: number, variantName: string) => {
    setSelectedVariants({ ...selectedVariants, [productId]: variantName })
  }

  // Update quantity for a product
  const updateProductQty = (productId: number, delta: number) => {
    const currentQty = quantities[productId] || 1
    setQuantities({ ...quantities, [productId]: Math.max(1, currentQty + delta) })
  }

  // Set exact quantity
  const setProductQty = (productId: number, qty: number) => {
    setQuantities({ ...quantities, [productId]: Math.max(1, qty) })
  }

  // Add all selected products to order
  const addSelectedProducts = () => {
    const newItems: EditItem[] = []

    for (const productId of selectedProducts) {
      const variantName = selectedVariants[productId]
      if (!variantName) continue

      const product = allProducts.find(p => p.id === productId)
      const variants = productVariants[productId] || []
      const variant = variants.find(v => v.name === variantName)
      if (!product) continue

      const price = variant ? variant.price : product.price
      const qty = quantities[productId] || 1
      let offerText: string | null = null
      let offerDiscount = 0
      const dVal = variant ? (variant.discountValue || product.discountValue || 0) : (product.discountValue || 0)
      const dType = variant ? (variant.discountType || product.discountType || 'pct') : (product.discountType || 'pct')

      if (dVal > 0) {
        if (dType === 'pct') {
          offerText = `${dVal}% OFF`
          offerDiscount = Math.round(price * qty * (dVal / 100))
        } else {
          offerText = `TK ${dVal} OFF`
          offerDiscount = Math.min(dVal * qty, price * qty)
        }
      }

      newItems.push({
        tempId: `new-${productId}-${Date.now()}`,
        name: product.name,
        variant: variant?.name || null,
        qty,
        basePrice: price,
        offerText,
        offerDiscount,
        couponCode: null,
        couponDiscount: 0,
        productId: product.id
      })
    }

    if (newItems.length === 0) {
      showToastMsg('Select variants first')
      return
    }

    setEditItems([...editItems, ...newItems])
    setSelectedProducts([])
    setSelectedVariants({})
    setQuantities({})
    setShowAddProduct(false)
    showToastMsg(`${newItems.length} product(s) added!`)
  }

  // Update quantity
  const updateQty = (tempId: string, delta: number) => {
    setEditItems(editItems.map(item => {
      if (item.tempId !== tempId) return item
      const newQty = Math.max(1, item.qty + delta)
      let newDiscount = item.offerDiscount
      if (item.offerText && item.basePrice) {
        const match = item.offerText.match(/(\d+)% OFF/)
        if (match) newDiscount = Math.round(item.basePrice * newQty * (parseInt(match[1]) / 100))
        else {
          const fixed = item.offerText.match(/TK (\d+) OFF/)
          if (fixed) newDiscount = Math.min(parseInt(fixed[1]) * newQty, item.basePrice * newQty)
        }
      }
      return { ...item, qty: newQty, offerDiscount: newDiscount }
    }))
  }

  // Load variants for item
  const loadItemVariants = async (tempId: string, productId: number) => {
    if (itemVariants[tempId]) return
    try {
      const res = await csrfFetch(`/api/variants?productId=${productId}`)
      const data = await res.json()
      if (data.success) setItemVariants(prev => ({ ...prev, [tempId]: data.data || [] }))
    } catch {}
  }

  // Update variant
  const updateVariant = (tempId: string, variantName: string) => {
    const vList = itemVariants[tempId]
    if (!vList) return
    const v = vList.find(x => x.name === variantName)
    if (!v) return

    setEditItems(editItems.map(item => {
      if (item.tempId !== tempId) return item
      let offerText: string | null = null
      let offerDiscount = 0
      if (v.discountValue && v.discountValue > 0) {
        if (v.discountType === 'pct') {
          offerText = `${v.discountValue}% OFF`
          offerDiscount = Math.round(v.price * item.qty * (v.discountValue / 100))
        } else {
          offerText = `TK ${v.discountValue} OFF`
          offerDiscount = Math.min(v.discountValue * item.qty, v.price * item.qty)
        }
      }
      return { ...item, variant: v.name, basePrice: v.price, offerText, offerDiscount }
    }))
  }

  // Delete item
  const deleteItem = (tempId: string) => {
    setEditItems(editItems.filter(item => item.tempId !== tempId))
  }

  // Calculate totals
  const calcTotals = () => {
    const subtotal = editItems.reduce((s, i) => s + i.basePrice * i.qty, 0)
    const discount = editItems.reduce((s, i) => s + (i.offerDiscount || 0), 0)
    const coupon = editItems.reduce((s, i) => s + (i.couponDiscount || 0), 0)
    const delivery = selectedOrder?.delivery || 0
    return { subtotal, discount, coupon, delivery, total: subtotal - discount - coupon + delivery }
  }

  // Save changes
  const saveChanges = async () => {
    if (!selectedOrder || saving) return
    setSaving(true)
    const { subtotal, discount, coupon, delivery, total } = calcTotals()

    try {
      const res = await csrfFetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrder.id,
          items: editItems.map(i => ({
            name: i.name, variant: i.variant, qty: i.qty, basePrice: i.basePrice,
            offerText: i.offerText, offerDiscount: i.offerDiscount || 0,
            couponCode: i.couponCode, couponDiscount: i.couponDiscount || 0, productId: i.productId
          })),
          subtotal, discount, couponAmount: coupon, delivery, total,
          customer: editCustomer,
          phone: editPhone,
          address: editAddress
        })
      })
      const result = await res.json()
      if (result.success) {
        setOrders(orders.map(o => o.id === selectedOrder.id ? { 
          ...o, 
          items: editItems, 
          subtotal, 
          discount, 
          couponAmount: coupon, 
          total,
          customer: editCustomer,
          phone: editPhone,
          address: editAddress
        } : o))
        setSelectedOrder({ 
          ...selectedOrder, 
          items: editItems, 
          subtotal, 
          discount, 
          couponAmount: coupon, 
          total,
          customer: editCustomer,
          phone: editPhone,
          address: editAddress
        })
        showToastMsg('Order updated!')
        exitEditMode()
      } else showToastMsg('Failed to update')
    } catch { showToastMsg('Error updating') }
    finally { setSaving(false) }
  }

  // Update order status and auto-send to courier on approve
  const updateStatus = async (id: string, status: 'approved' | 'canceled') => {
    try {
      // Update order status
      const res = await csrfFetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, canceledBy: status === 'canceled' ? 'Admin' : null })
      })
      const result = await res.json()
      
      if (result.success) {
        setOrders(orders.map(o => o.id === id ? { ...o, status, canceledBy: status === 'canceled' ? 'Admin' : null } : o))
        
        // If approved, automatically send to Steadfast courier
        if (status === 'approved') {
          showToastMsg('Approving & sending to courier...')
          
          try {
            const courierRes = await csrfFetch('/api/courier', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: id })
            })
            const courierResult = await courierRes.json()
            
            if (courierResult.success) {
              // Update order with courier info
              setOrders(prev => prev.map(o => o.id === id ? {
                ...o,
                status: 'approved',
                courierStatus: courierResult.consignment?.status || 'in_review',
                consignmentId: courierResult.consignment?.consignmentId,
                trackingCode: courierResult.consignment?.trackingCode
              } : o))
              showToastMsg('Approved & sent to courier!')
            } else {
              // Show error but order is still approved
              showToastMsg(`Approved. Courier: ${courierResult.error || 'Failed'}`)
            }
          } catch (courierError) {
            showToastMsg('Approved. Courier service unavailable.')
          }
        } else {
          showToastMsg('Rejected!')
        }
      }
    } catch {
      showToastMsg('Error updating order')
    }
  }

  const copyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone)
    showToastMsg('Copied!')
  }

  // Steadfast courier status colors (read-only, comes from webhook)
  const getCourierStatusColor = (status: string | null | undefined) => {
    if (!status) return '#9ca3af' // gray for not sent
    switch (status.toLowerCase()) {
      case 'in_review': return '#f59e0b' // amber
      case 'pending': return '#3b82f6' // blue
      case 'delivered_approval_pending': return '#8b5cf6' // purple
      case 'partial_delivered_approval_pending': return '#8b5cf6'
      case 'cancelled_approval_pending': return '#ef4444'
      case 'delivered': return '#16a34a' // green
      case 'partial_delivered': return '#16a34a'
      case 'cancelled': return '#ef4444' // red
      case 'hold': return '#f97316' // orange
      case 'unknown': return '#6b7280'
      default: return '#6b7280'
    }
  }

  // Format courier status for display
  const formatCourierStatus = (status: string | null | undefined) => {
    if (!status) return 'Not Sent'
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  // Retry sending to courier
  const retryCourier = async (orderId: string) => {
    try {
      showToastMsg('Sending to courier...')
      
      const courierRes = await csrfFetch('/api/courier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })
      const courierResult = await courierRes.json()
      
      if (courierResult.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? {
          ...o,
          courierStatus: courierResult.consignment?.status || 'in_review',
          consignmentId: courierResult.consignment?.consignmentId,
          trackingCode: courierResult.consignment?.trackingCode
        } : o))
        showToastMsg('Sent to courier successfully!')
      } else {
        showToastMsg(courierResult.error || 'Failed to send to courier')
      }
    } catch {
      showToastMsg('Error sending to courier')
    }
  }

  // Verify Steadfast courier API credentials
  const verifyCourierAPI = async () => {
    try {
      setVerifyingCourier(true)
      const res = await csrfFetch('/api/courier?action=verify')
      const result = await res.json()
      
      if (result.success) {
        setCourierStatus('valid')
        showToastMsg(`Courier API connected! Balance: TK ${result.balance || 0}`)
      } else {
        setCourierStatus('invalid')
        // Show detailed error message
        const errorMsg = result.message || 'Courier API verification failed'
        showToastMsg(errorMsg)
      }
    } catch {
      setCourierStatus('invalid')
      showToastMsg('Failed to verify courier API')
    } finally {
      setVerifyingCourier(false)
    }
  }

  // Validate and apply coupon code for Create Order
  const validateAndApplyCoupon = async () => {
    if (!newCouponCode.trim()) {
      setCouponError('Enter a coupon code')
      return
    }
    
    setCouponValidating(true)
    setCouponError('')
    
    try {
      // Fetch all coupons and validate
      const res = await csrfFetch('/api/coupons')
      const data = await res.json()
      
      if (data.success && data.data) {
        const coupon = data.data.find((c: any) => c.code.toUpperCase() === newCouponCode.trim().toUpperCase())
        
        if (!coupon) {
          setCouponError('Invalid coupon code')
          setAppliedCoupon(null)
          setNewCouponDiscount(0)
        } else {
          // Check expiry
          if (coupon.expiry) {
            const expiryDate = new Date(coupon.expiry)
            if (expiryDate < new Date()) {
              setCouponError('Coupon has expired')
              setAppliedCoupon(null)
              setNewCouponDiscount(0)
              setCouponValidating(false)
              return
            }
          }
          
          // Calculate discount based on subtotal
          const subtotal = newItems.reduce((sum, item) => sum + item.basePrice * item.qty, 0)
          let discount = 0
          
          if (coupon.type === 'pct') {
            discount = Math.round(subtotal * (coupon.value / 100))
          } else {
            discount = Math.min(coupon.value, subtotal)
          }
          
          setAppliedCoupon({
            code: coupon.code,
            discount,
            type: coupon.type,
            value: coupon.value
          })
          setNewCouponDiscount(discount)
          setCouponError('')
          showToastMsg(`Coupon applied: ${coupon.type === 'pct' ? coupon.value + '%' : 'TK ' + coupon.value} off!`)
        }
      }
    } catch {
      setCouponError('Failed to validate coupon')
      setAppliedCoupon(null)
      setNewCouponDiscount(0)
    } finally {
      setCouponValidating(false)
    }
  }

  // Remove applied coupon
  const removeCoupon = () => {
    setNewCouponCode('')
    setAppliedCoupon(null)
    setNewCouponDiscount(0)
    setCouponError('')
  }

  // Get current totals (edit or view)
  const currentTotals = editMode ? calcTotals() : {
    subtotal: selectedOrder?.subtotal || 0,
    discount: selectedOrder?.discount || 0,
    coupon: selectedOrder?.couponAmount || 0,
    delivery: selectedOrder?.delivery || 0,
    total: selectedOrder?.total || 0
  }

  return (
    <div className="p-4 md:p-8 bg-white min-h-[calc(100vh-80px)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Action Buttons */}
      <div className="mb-6 flex items-center justify-end flex-wrap gap-4">
          <button
            onClick={verifyCourierAPI}
            disabled={verifyingCourier}
            className={`px-4 py-1.5 text-[13px] font-semibold rounded-[5px] transition-colors flex items-center gap-2 ${
              courierStatus === 'valid' 
                ? 'bg-green-100 text-green-700 border border-green-200'
                : courierStatus === 'invalid'
                ? 'bg-red-100 text-red-700 border border-red-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            {verifyingCourier ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : courierStatus === 'valid' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : courierStatus === 'invalid' ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
            {verifyingCourier ? 'Verifying...' : courierStatus === 'valid' ? 'API Connected' : courierStatus === 'invalid' ? 'API Failed' : 'Verify Courier'}
          </button>
          <span className="px-4 py-1.5 bg-[#f59e0b]/10 text-[#f59e0b] text-[13px] font-bold rounded-[5px]">
            {orders.filter(o => o.status === 'pending').length} Pending
          </span>
          {/* Create Order Button */}
          <button
            onClick={() => {
              setCreateOrderOpen(true)
              setNewProdSearch('')
              setNewProdPage(1)
              setNewSelectedVariants({})
              setNewQuantities({})
              setNewShowAddProd(true)
              setNewCouponCode('')
              setNewCouponDiscount(0)
              setAppliedCoupon(null)
              setCouponError('')
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#16a34a] text-white rounded-[5px] text-[13px] font-semibold hover:bg-[#15803d] transition-colors"
          >
            <i className="ri-add-line text-base"></i>
            Create Order
          </button>
          {/* Download Report Button */}
          <button
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#16a34a] text-[#16a34a] rounded-[5px] text-[13px] font-semibold hover:bg-[#16a34a]/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Report
          </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {/* Order Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'all', label: 'All', color: '#1c2333' },
            { id: 'pending', label: 'Pending', color: '#f59e0b' },
            { id: 'approved', label: 'Approved', color: '#18a87a' },
            { id: 'cancel_customer', label: 'Cancel (Customer)', color: '#ef4444' },
            { id: 'cancel_admin', label: 'Cancel (Admin)', color: '#dc2626' },
          ].map(f => (
            <button key={f.id} onClick={() => setCurrentOrderFilter(f.id as any)}
              className={`px-4 py-2 text-[13px] font-semibold rounded-[5px] border transition-colors ${
                currentOrderFilter === f.id
                  ? `text-white border-[${f.color}]`
                  : 'bg-white text-[#8a96a8] border-[#e4e7ee] hover:bg-[#f5f6f9]'
              }`}
              style={currentOrderFilter === f.id ? { backgroundColor: f.color } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        {/* Divider */}
        <div className="w-px h-8 bg-[#e4e7ee] mx-2 self-center"></div>
        
        {/* Courier Status Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { id: 'courier_review', label: 'Review', color: '#f59e0b' },
            { id: 'courier_shipping', label: 'Shipping', color: '#3b82f6' },
            { id: 'courier_delivered', label: 'Delivered', color: '#16a34a' },
            { id: 'courier_cancel', label: 'Courier Cancel', color: '#ef4444' },
          ].map(f => (
            <button key={f.id} onClick={() => setCurrentOrderFilter(f.id as any)}
              className={`px-4 py-2 text-[13px] font-semibold rounded-[5px] border transition-colors ${
                currentOrderFilter === f.id
                  ? `text-white`
                  : 'bg-white text-[#8a96a8] border-[#e4e7ee] hover:bg-[#f5f6f9]'
              }`}
              style={currentOrderFilter === f.id ? { backgroundColor: f.color, borderColor: f.color } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex flex-col gap-2">
        {/* Header Row */}
        <div className="grid grid-cols-7 bg-[#f1f5f9] border border-[#e2e8f0] rounded-[5px]">
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Order</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Time</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Items</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Total</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Action</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Courier</div>
          <div className="px-4 py-3 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">View</div>
        </div>

        {/* Data Rows */}
        {filteredOrders.map(order => {
          // Calculate time ago using createdAt timestamp
          const getTimeAgo = () => {
            try {
              // Use createdAt timestamp for accurate time calculation
              if (order.createdAt) {
                const orderDateTime = new Date(order.createdAt)
                const now = new Date()
                const diffMs = now.getTime() - orderDateTime.getTime()
                const diffMins = Math.floor(diffMs / 60000)
                const diffHours = Math.floor(diffMins / 60)
                const diffDays = Math.floor(diffHours / 24)

                if (diffMins < 1) return 'Just now'
                if (diffMins < 60) return `${diffMins}m ago`
                if (diffHours < 24) return `${diffHours}h ago`
                if (diffDays < 7) return `${diffDays}d ago`
                return order.date || ''
              }

              // Fallback to date/time strings if createdAt is not available
              const orderDate = order.date || ''
              const orderTime = order.time || ''
              const dateTimeStr = `${orderDate} ${orderTime}`
              const orderDateTime = new Date(dateTimeStr)
              const now = new Date()
              const diffMs = now.getTime() - orderDateTime.getTime()
              const diffMins = Math.floor(diffMs / 60000)
              const diffHours = Math.floor(diffMins / 60)
              const diffDays = Math.floor(diffHours / 24)

              if (diffMins < 1) return 'Just now'
              if (diffMins < 60) return `${diffMins}m ago`
              if (diffHours < 24) return `${diffHours}h ago`
              if (diffDays < 7) return `${diffDays}d ago`
              return orderDate
            } catch {
              return order.date || ''
            }
          }
          
          const itemCount = order.items?.length || 0
          
          return (
            <div key={order.id} className="grid grid-cols-7 bg-white rounded-[5px] border border-[#d1d5db] overflow-hidden hover:border-[#9ca3af] transition-colors">
              {/* Order ID */}
              <div className="px-4 py-3.5 border-r border-[#d1d5db] flex items-center justify-center">
                <span className="text-[13px] font-semibold text-[#1e293b]">{order.id}</span>
              </div>
              
              {/* Time */}
              <div className="px-4 py-3.5 border-r border-[#d1d5db] flex items-center justify-center">
                <span className="text-[12px] text-[#6b7280]">{getTimeAgo()}</span>
              </div>
              
              {/* Items */}
              <div className="px-4 py-3.5 border-r border-[#d1d5db] flex items-center justify-center">
                <span className="text-[13px] font-medium text-[#1c2333]">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              </div>
              
              {/* Total */}
              <div className="px-4 py-3.5 border-r border-[#d1d5db] flex items-center justify-center">
                <span className="text-[13px] font-bold text-[#16a34a]">TK {roundPrice(order.total)}</span>
              </div>
              
              {/* Action */}
              <div className="px-4 py-3.5 border-r border-[#d1d5db] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                {order.status === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateStatus(order.id, 'approved')} className="text-[#18a87a] font-semibold text-[11px] cursor-pointer hover:underline">Approve</button>
                    <span className="text-[#d1d5db]">|</span>
                    <button onClick={() => updateStatus(order.id, 'canceled')} className="text-[#ef4444] font-semibold text-[11px] cursor-pointer hover:underline">Reject</button>
                  </div>
                ) : (
                  <span className={`text-[11px] font-bold ${order.status === 'approved' ? 'text-[#18a87a]' : 'text-[#ef4444]'}`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </span>
                )}
              </div>
              
              {/* Courier */}
              <div className="px-4 py-3.5 border-r border-[#d1d5db] flex items-center justify-center" onClick={e => e.stopPropagation()}>
                {order.courierStatus ? (
                  <div className="flex flex-col items-center gap-0.5">
                    <span 
                      className="font-bold text-[11px]"
                      style={{ color: getCourierStatusColor(order.courierStatus) }}
                    >
                      {formatCourierStatus(order.courierStatus)}
                    </span>
                    {order.trackingCode && (
                      <span className="text-[9px] text-[#6b7280] font-mono">{order.trackingCode}</span>
                    )}
                  </div>
                ) : order.status === 'approved' ? (
                  <button
                    onClick={() => retryCourier(order.id)}
                    className="text-[10px] px-2 py-1 bg-[#16a34a] text-white rounded font-medium hover:bg-[#15803d]"
                  >
                    Send
                  </button>
                ) : (
                  <span className="text-[10px] text-[#9ca3af]">—</span>
                )}
              </div>
              
              {/* View */}
              <div className="px-4 py-3.5 flex items-center justify-center">
                <button onClick={() => setSelectedOrder(order)} className="text-[#16a34a] font-semibold text-[12px] cursor-pointer hover:underline">View Details</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* View/Edit Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#1c2333]/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="w-full max-w-[720px] max-h-[90vh] overflow-y-auto bg-white border border-[#e4e7ee] rounded-xl shadow-lg p-5 flex flex-col gap-4" onClick={e => e.stopPropagation()}>

            {/* ACTION BAR */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-mono font-semibold">{selectedOrder.id}</span>
                <span className="text-[#8a96a8]">|</span>
                <span className="text-[#8a96a8]">{selectedOrder.date}</span>
                <span className="text-[#8a96a8]">|</span>
                <span className="text-xs uppercase font-medium">{selectedOrder.paymentMethod}</span>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center gap-1.5">
                <button onClick={() => window.open('tel:' + selectedOrder.phone)} 
                  className="h-[28px] w-[28px] rounded flex items-center justify-center text-[#8a96a8] hover:text-[#3f72f5] hover:bg-[#f5f6f9]">
                  <i className="ri-phone-fill text-[15px]"></i>
                </button>
                <button onClick={() => window.open('https://wa.me/' + selectedOrder.phone.replace(/[^0-9]/g, ''))} 
                  className="h-[28px] w-[28px] rounded flex items-center justify-center text-[#8a96a8] hover:text-[#18a87a] hover:bg-[#f5f6f9]">
                  <i className="ri-whatsapp-line text-[15px]"></i>
                </button>
                <button onClick={() => copyPhone(selectedOrder.phone)} 
                  className="h-[28px] w-[28px] rounded flex items-center justify-center text-[#8a96a8] hover:text-[#1c2333] hover:bg-[#f5f6f9]">
                  <i className="ri-file-copy-line text-[15px]"></i>
                </button>
                <button onClick={() => setShowInvoice(true)} 
                  className="h-[28px] w-[28px] rounded flex items-center justify-center text-[#8a96a8] hover:text-[#18a87a] hover:bg-[#f5f6f9]">
                  <i className="ri-bill-line text-[15px]"></i>
                </button>

                <div className="w-[1px] h-[18px] bg-[#e4e7ee] mx-1"></div>

                {/* Edit/Done Button */}
                {editMode ? (
                  <button onClick={saveChanges} disabled={saving}
                    className="h-[28px] px-3 rounded flex items-center justify-center bg-[#18a87a] text-white text-[11px] font-semibold gap-1 hover:bg-[#16a34a] disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                ) : (
                  <button onClick={enterEditMode} 
                    className="h-[28px] px-3 rounded flex items-center justify-center bg-[#f59e0b] text-white text-[11px] font-semibold gap-1 hover:bg-[#d97706]">
                    <i className="ri-edit-line text-[13px]"></i> Edit
                  </button>
                )}

                <button onClick={closeModal} 
                  className="h-[30px] w-[30px] rounded-[4px] flex items-center justify-center border border-[#e4e7ee] bg-white text-[#8a96a8] hover:bg-[#f5f6f9]">
                  <i className="ri-close-line text-[18px]"></i>
                </button>
              </div>
            </div>

            {/* CUSTOMER INFO (SINGLE LINE) */}
            <div className="border border-[#e4e7ee] rounded p-3 bg-white text-sm flex items-center gap-2">
              {editMode ? (
                <>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setEditCustomer(e.currentTarget.textContent || '')}
                    className="font-medium outline-none cursor-text"
                  >{editCustomer}</span>
                  <span className="text-[#8a96a8]">|</span>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setEditPhone(e.currentTarget.textContent || '')}
                    className="font-medium outline-none cursor-text"
                  >{editPhone}</span>
                  <span className="text-[#8a96a8]">|</span>
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => setEditAddress(e.currentTarget.textContent || '')}
                    className="font-medium outline-none cursor-text flex-1"
                  >{editAddress}</span>
                </>
              ) : (
                <>
                  <span className="font-medium">{selectedOrder.customer}</span>
                  <span className="text-[#8a96a8]">|</span>
                  <span className="font-medium">{selectedOrder.phone}</span>
                  <span className="text-[#8a96a8]">|</span>
                  <span className="font-medium">{selectedOrder.address}</span>
                </>
              )}
            </div>

            {/* CUSTOMER NOTE */}
            {selectedOrder.note && (
              <div className="border border-[#f59e0b] bg-[#f59e0b]/5 rounded p-3 text-sm flex flex-wrap items-start gap-1.5">
                <span className="text-[#f59e0b] font-semibold shrink-0">Customer Note:</span>
                <span className="text-gray-700">{selectedOrder.note}</span>
              </div>
            )}

            {/* ITEMS TABLE */}
            <div className="border border-[#e4e7ee] rounded-[4px] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#f3f4f6] border-b border-[#e4e7ee]">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Item</th>
                    <th className="text-left px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Variant</th>
                    <th className="text-center px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Qty</th>
                    <th className="text-right px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {(editMode ? editItems : selectedOrder?.items || []).map((item, i) => {
                    const itemTotal = item.basePrice * item.qty - (item.offerDiscount || 0) - (item.couponDiscount || 0)
                    const tempId = (item as EditItem).tempId
                    
                    return (
                      <tr key={editMode ? tempId : i} className="border-b border-[#e4e7ee] last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>{item.name}</span>
                            {item.offerText && <span className="text-[10px] font-bold text-[#ef4444]">[{item.offerText}]</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {editMode ? (
                            <select
                              value={item.variant || ''}
                              onClick={() => {
                                // Load variants when clicking the dropdown if not loaded
                                if (item.productId && !itemVariants[tempId]?.length) {
                                  loadItemVariants(tempId, item.productId)
                                }
                              }}
                              onFocus={() => {
                                // Also load on focus for better UX
                                if (item.productId && !itemVariants[tempId]?.length) {
                                  loadItemVariants(tempId, item.productId)
                                }
                              }}
                              onChange={(e) => updateVariant(tempId, e.target.value)}
                              className="px-2 py-1 border border-[#e5e7eb] rounded-[3px] text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#18a87a] focus:border-[#18a87a] min-w-[80px]"
                            >
                              {/* Show current variant as selected even if variants not loaded yet */}
                              {item.variant && !itemVariants[tempId]?.length && (
                                <option value={item.variant}>{item.variant}</option>
                              )}
                              {itemVariants[tempId]?.map(v => (
                                <option key={v.id} value={v.name}>{v.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[#8a96a8]">{item.variant || '—'}</span>
                          )}
                        </td>
                        <td className="text-center px-4 py-3">
                          {editMode ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => updateQty(tempId, -1)}
                                className="w-6 h-6 rounded-[3px] border border-[#e4e7ee] bg-white flex items-center justify-center hover:bg-[#f5f6f9] text-[12px]">−</button>
                              <span className="w-5 text-center font-medium">{item.qty}</span>
                              <button onClick={() => updateQty(tempId, 1)}
                                className="w-6 h-6 rounded-[3px] border border-[#e4e7ee] bg-white flex items-center justify-center hover:bg-[#f5f6f9] text-[12px]">+</button>
                            </div>
                          ) : (
                            <span>{item.qty}</span>
                          )}
                        </td>
                        <td className="text-right font-semibold px-4 py-3">
                          <div className="flex items-center justify-end gap-3">
                            <div>
                              {item.offerDiscount > 0 || item.couponDiscount > 0 ? (
                                <div>
                                  <div className="line-through text-[#8a96a8] font-normal text-[12px]">TK {roundPrice(item.basePrice * item.qty)}</div>
                                  <div>TK {roundPrice(itemTotal)}</div>
                                </div>
                              ) : `TK ${roundPrice(itemTotal)}`}
                            </div>
                            {editMode && (
                              <button onClick={() => deleteItem(tempId)}
                                className="w-6 h-6 rounded-[3px] bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center hover:bg-[#ef4444] hover:text-white flex-shrink-0">
                                <i className="ri-delete-bin-line text-[12px]"></i>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Add Product Section */}
            {editMode && (
              <div className="border border-[#e4e7ee] rounded-[4px] p-4 bg-white">
                {/* Plain Text Toggle */}
                <span
                  onClick={() => {
                    setShowAddProduct(!showAddProduct)
                    if (!showAddProduct) {
                      setProductPage(1)
                      setProductSearch('')
                    }
                  }}
                  className="text-[#18a87a] text-sm cursor-pointer hover:underline"
                >
                  + Add Product
                </span>

                {/* Search & Products */}
                {showAddProduct && (
                  <div className="mt-3">
                    {/* Search Bar */}
                    <div className="relative mb-3">
                      <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"></i>
                      <input
                        type="text"
                        value={productSearch}
                        onChange={e => {
                          setProductSearch(e.target.value)
                          setProductPage(1)
                        }}
                        placeholder="Search products by name, category, or variety..."
                        className="w-full pl-9 pr-4 py-2 border border-[#e5e7eb] rounded-[4px] text-sm focus:outline-none focus:ring-1 focus:ring-[#18a87a] focus:border-[#18a87a]"
                        autoFocus
                      />
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border border-[#e5e7eb] rounded-[4px]">
                      <table className="w-full text-sm">
                        <thead className="bg-white border-b border-[#e5e7eb]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Product</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Variety</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Quantity</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e5e7eb]">
                          {productSearch.trim() && paginatedProducts.map(p => {
                              const variants = productVariants[p.id] || []
                              const totalStock = variants.reduce((acc, v) => acc + v.stock, 0)
                              const selectedVariantName = selectedVariants[p.id] || (variants[0]?.name || '')
                              const currentVariant = variants.find(v => v.name === selectedVariantName)
                              const variantStock = currentVariant?.stock || 0
                              
                              return (
                                <tr key={p.id} className="hover:bg-[#f9fafb]">
                                  {/* Product: image + name + category */}
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-[#f3f4f6] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {p.image ? (
                                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <i className="ri-image-line text-lg text-[#9ca3af]"></i>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1 max-w-[140px]">
                                        <div className="font-medium text-[#1f2937] whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                                        <div className="text-xs text-[#6b7280] whitespace-nowrap overflow-hidden text-ellipsis">{p.category || '—'}</div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Variety: native select dropdown */}
                                  <td className="px-4 py-3">
                                    <select
                                      value={selectedVariantName}
                                      onChange={(e) => {
                                        const newVariant = e.target.value
                                        setSelectedVariants({ ...selectedVariants, [p.id]: newVariant })
                                        const v = variants.find(v => v.name === newVariant)
                                        if (v && (quantities[p.id] || 1) > v.stock) {
                                          setQuantities({ ...quantities, [p.id]: v.stock })
                                        }
                                      }}
                                      className="px-2 py-1 border border-[#e5e7eb] rounded-[4px] text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#18a87a] focus:border-[#18a87a]"
                                    >
                                      {variants.map(v => (
                                        <option key={v.id} value={v.name}>
                                          {v.name} (TK {roundPrice(v.price)})
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Quantity with plus/minus */}
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          const current = quantities[p.id] || 1
                                          if (current > 1) {
                                            setQuantities({ ...quantities, [p.id]: current - 1 })
                                          }
                                        }}
                                        className="w-6 h-6 flex items-center justify-center border border-[#e5e7eb] rounded-[3px] hover:bg-[#f3f4f6]"
                                      >
                                        −
                                      </button>
                                      <span className="w-8 text-center">{quantities[p.id] || 1}</span>
                                      <button
                                        onClick={() => {
                                          const current = quantities[p.id] || 1
                                          if (current < variantStock) {
                                            setQuantities({ ...quantities, [p.id]: current + 1 })
                                          }
                                        }}
                                        className="w-6 h-6 flex items-center justify-center border border-[#e5e7eb] rounded-[3px] hover:bg-[#f3f4f6]"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>

                                  {/* Stock: "variantStock out of totalStock" */}
                                  <td className="px-4 py-3">
                                    <span className="text-[#1f2937]">{variantStock} out of {totalStock}</span>
                                  </td>

                                  {/* Add button */}
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => {
                                        const variantName = selectedVariants[p.id] || (variants[0]?.name || '')
                                        if (!variantName) {
                                          showToastMsg('Select variant first')
                                          return
                                        }
                                        const variant = variants.find(v => v.name === variantName)
                                        if (!variant) return
                                        
                                        const price = variant.price
                                        const qtyToAdd = quantities[p.id] || 1
                                        let offerText: string | null = null
                                        let offerDiscount = 0
                                        const dVal = variant.discountValue || p.discountValue || 0
                                        const dType = variant.discountType || p.discountType || 'pct'

                                        if (dVal > 0) {
                                          if (dType === 'pct') {
                                            offerText = `${dVal}% OFF`
                                            offerDiscount = Math.round(price * qtyToAdd * (dVal / 100))
                                          } else {
                                            offerText = `TK ${dVal} OFF`
                                            offerDiscount = Math.min(dVal * qtyToAdd, price * qtyToAdd)
                                          }
                                        }

                                        setEditItems([...editItems, {
                                          tempId: `new-${p.id}-${Date.now()}`,
                                          name: p.name,
                                          variant: variant.name,
                                          qty: qtyToAdd,
                                          basePrice: price,
                                          offerText,
                                          offerDiscount,
                                          couponCode: null,
                                          couponDiscount: 0,
                                          productId: p.id
                                        }])

                                        showToastMsg('Product added!')
                                      }}
                                      className="px-3 py-1 bg-[#18a87a] text-white rounded-[4px] text-xs font-medium hover:bg-[#16a34a] transition flex items-center gap-1"
                                    >
                                      <i className="ri-add-line"></i> Add
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                            {(!productSearch.trim() || paginatedProducts.length === 0) && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-[#9ca3af]">
                                  {!productSearch.trim() ? 'Type to search products...' : 'No products found'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                    {/* Pagination */}
                    {productSearch.trim() && filteredProducts.length > 0 && (
                      <div className="flex items-center justify-between mt-4 text-sm">
                        <span className="text-[#4b5563]">
                          Showing {filteredProducts.length > 0 ? (productPage - 1) * PRODUCTS_PER_PAGE + 1 : 0} – {Math.min(productPage * PRODUCTS_PER_PAGE, filteredProducts.length)} of {filteredProducts.length} products
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setProductPage(Math.max(1, productPage - 1))}
                            disabled={productPage === 1}
                            className="px-3 py-1 border border-[#e5e7eb] rounded-[4px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6]"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setProductPage(Math.min(totalPages, productPage + 1))}
                            disabled={productPage === totalPages || totalPages === 0}
                            className="px-3 py-1 border border-[#e5e7eb] rounded-[4px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6]"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* CALCULATION - Single Line */}
            <div className="border border-[#e4e7ee] rounded p-3 bg-white text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6b7280] text-xs font-medium">Order Calculation</span>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span>Subtotal: <span className="font-medium">TK {roundPrice(currentTotals.subtotal)}</span></span>
                  {currentTotals.discount > 0 && (
                    <>
                      <span className="text-[#e4e7ee]">|</span>
                      <span className="text-[#ef4444]">Discount: <span className="font-medium">TK {roundPrice(currentTotals.discount)}</span></span>
                    </>
                  )}
                  {currentTotals.coupon > 0 && (
                    <>
                      <span className="text-[#e4e7ee]">|</span>
                      <span className="text-[#16a34a]">Coupon: <span className="font-medium">TK {roundPrice(currentTotals.coupon)}</span></span>
                    </>
                  )}
                  <span className="text-[#e4e7ee]">|</span>
                  <span>Delivery: <span className="font-medium">{currentTotals.delivery === 0 ? 'Free' : `TK ${roundPrice(currentTotals.delivery)}`}</span></span>
                  <span className="text-[#e4e7ee]">|</span>
                  <span className="font-semibold">Total: TK {roundPrice(currentTotals.total)}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* INVOICE MODAL - Premium Design */}
      {showInvoice && selectedOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/50" onClick={() => setShowInvoice(false)}>
          <div className="bg-white w-[1100px] max-h-[90vh] overflow-y-auto rounded-md shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="p-[50px]" style={{ fontFamily: "'Inter', sans-serif" }}>
              {/* Header */}
              <div className="flex justify-between items-end pb-[35px] border-b border-[#e2e8f0] mb-[50px]">
                <div className="flex flex-col items-start">
                  <img src={settings?.logoUrl || "https://i.postimg.cc/43DGNgCK/1000022032-removebg-preview.png"} alt="Logo" className="h-12 w-auto object-contain" />
                  <span className="text-[10px] text-[#64748b] font-medium tracking-[1.5px] uppercase mt-1">{settings?.slogan || 'Premium Quality Groceries'}</span>
                  <span className="text-[12px] font-medium text-[#1e293b] mt-2">www.krishibitan.com</span>
                  {/* Contact Information */}
                  <div className="mt-2 text-[12px] text-[#64748b]">
                    <div className="flex items-center gap-4">
                      {settings?.phoneNumber && (
                        <div className="flex items-center gap-1.5">
                          <i className="ri-phone-line text-[#16a34a] text-sm"></i>
                          <span>{settings.phoneNumber}</span>
                        </div>
                      )}
                      {settings?.whatsappNumber && (
                        <div className="flex items-center gap-1.5">
                          <i className="ri-whatsapp-line text-[#16a34a] text-sm"></i>
                          <span>{settings.whatsappNumber}</span>
                        </div>
                      )}
                    </div>
                    {settings?.facebookUrl && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <i className="ri-facebook-fill text-[#16a34a] text-sm"></i>
                        <span>{settings.facebookUrl}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-[13px]">
                  <span className="text-[#64748b] text-[9px] uppercase font-semibold tracking-[1px] block">Invoice Identification</span>
                  <strong className="text-[#1e293b] text-[14px] font-medium block mt-0.5">#{selectedOrder.id}</strong>
                  <div className="mt-3">
                    <span className="text-[#64748b] text-[9px] uppercase font-semibold tracking-[1px] block">Issued Date</span>
                    <strong className="text-[#1e293b] text-[14px] font-medium block mt-0.5">{selectedOrder.date}</strong>
                  </div>
                </div>
              </div>

              {/* Customer Details Grid */}
              <div className="grid grid-cols-[1.2fr_1fr_2fr] gap-10 mb-[50px]">
                <div>
                  <label className="block text-[9px] uppercase font-semibold text-[#64748b] mb-2.5 tracking-[1px]">Customer Name</label>
                  <p className="m-0 text-[14px] font-medium text-[#1e293b] leading-relaxed">{selectedOrder.customer}</p>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-semibold text-[#64748b] mb-2.5 tracking-[1px]">Phone Number</label>
                  <p className="m-0 text-[14px] text-[#1e293b] leading-relaxed">{selectedOrder.phone}</p>
                </div>
                <div>
                  <label className="block text-[9px] uppercase font-semibold text-[#64748b] mb-2.5 tracking-[1px]">Delivery Address</label>
                  <p className="m-0 text-[14px] text-[#1e293b] leading-relaxed">{selectedOrder.address}</p>
                </div>
              </div>

              {/* Premium Wrapped Table */}
              <div className="border border-[#e2e8f0] rounded-md overflow-hidden mb-10">
                <table className="w-full border-collapse bg-white">
                  <thead>
                    <tr>
                      <th className="text-left py-[18px] px-6 text-[10px] uppercase tracking-[1px] text-[#64748b] border-b border-[#e2e8f0] font-medium bg-[#f8fafc]" style={{ width: '30%' }}>Product Order</th>
                      <th className="text-left py-[18px] px-6 text-[10px] uppercase tracking-[1px] text-[#64748b] border-b border-[#e2e8f0] font-medium bg-[#f8fafc]" style={{ width: '30%' }}>Variety / Type</th>
                      <th className="text-center py-[18px] px-6 text-[10px] uppercase tracking-[1px] text-[#64748b] border-b border-[#e2e8f0] font-medium bg-[#f8fafc]">Qty</th>
                      <th className="text-right py-[18px] px-6 text-[10px] uppercase tracking-[1px] text-[#64748b] border-b border-[#e2e8f0] font-medium bg-[#f8fafc]">Unit Price</th>
                      <th className="text-right py-[18px] px-6 text-[10px] uppercase tracking-[1px] text-[#64748b] border-b border-[#e2e8f0] font-medium bg-[#f8fafc]">Total Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, i) => {
                      const itemTotal = item.basePrice * item.qty - (item.offerDiscount || 0) - (item.couponDiscount || 0)
                      return (
                        <tr key={i} className="border-b border-[#f1f5f9] last:border-0">
                          <td className="py-6 px-6 text-[14px] text-[#334155] font-medium">{item.name}</td>
                          <td className="py-6 px-6 text-[14px] text-[#334155]">{item.variant || '-'}</td>
                          <td className="py-6 px-6 text-[14px] text-[#334155] text-center">{item.qty}</td>
                          <td className="py-6 px-6 text-[14px] text-[#334155] text-right">TK {roundPrice(item.basePrice)}</td>
                          <td className="py-6 px-6 text-[14px] text-[#1e293b] font-medium text-right">TK {roundPrice(itemTotal)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="py-[22px] px-6 border-t border-[#e2e8f0] bg-white">
                        <div className="flex justify-between items-center w-full text-[13px] font-medium text-[#1e293b] whitespace-nowrap tracking-wide">
                          <span>Subtotal: TK {roundPrice(selectedOrder.subtotal)}</span>
                          <span className="text-[#e2e8f0] font-light mx-4">|</span>
                          {selectedOrder.discount > 0 && (
                            <>
                              <span className="text-[#ef4444]">Discount: -TK {roundPrice(selectedOrder.discount)}</span>
                              <span className="text-[#e2e8f0] font-light mx-4">|</span>
                            </>
                          )}
                          {selectedOrder.couponAmount > 0 && (
                            <>
                              <span className="text-[#16a34a]">Coupon: -TK {roundPrice(selectedOrder.couponAmount)}</span>
                              <span className="text-[#e2e8f0] font-light mx-4">|</span>
                            </>
                          )}
                          <span>Delivery: {selectedOrder.delivery === 0 ? 'Free' : `TK ${roundPrice(selectedOrder.delivery)}`}</span>
                          <span className="text-[#e2e8f0] font-light mx-4">|</span>
                          <span className="font-bold">Grand Total: TK {roundPrice(selectedOrder.total)}</span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Customer Note Section */}
              {selectedOrder.note && (
                <div className="mt-2.5 p-6 bg-[#f8fafc] border border-[#e2e8f0] rounded-md">
                  <label className="block text-[9px] uppercase font-semibold text-[#64748b] mb-2 tracking-[1px]">Note on Order</label>
                  <p className="m-0 text-[13px] italic text-[#64748b] leading-relaxed">"{selectedOrder.note}"</p>
                </div>
              )}

              {/* Thank You Message - Simple Text */}
              <div className="mt-8 text-center">
                <p className="text-[18px] font-medium text-[#1e293b]">Thank You for Your Purchase!</p>
              </div>

              {/* Actions */}
              <div className="flex justify-center gap-4 mt-8 pt-6 border-t border-[#e2e8f0]">
                <button onClick={() => window.print()} 
                  className="px-6 py-2.5 bg-[#16a34a] text-white text-[13px] font-semibold rounded-md hover:bg-[#15803d] transition-colors flex items-center gap-2">
                  <i className="ri-download-2-line"></i> Download Invoice
                </button>
                <button onClick={() => setShowInvoice(false)} 
                  className="px-6 py-2.5 border border-[#e2e8f0] text-[#64748b] text-[13px] font-semibold rounded-md hover:bg-[#f8fafc] transition-colors">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {createOrderOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1c2333]/40 backdrop-blur-sm" onClick={() => {
          setCreateOrderOpen(false)
          setNewCustomer('')
          setNewPhone('')
          setNewAddress('')
          setNewNote('')
          setNewItems([])
          setNewProdSearch('')
          setNewProdPage(1)
          setNewSelectedVariants({})
          setNewQuantities({})
          setNewShowAddProd(true)
        }}>
          <div className="w-full max-w-[780px] max-h-[90vh] overflow-y-auto bg-white rounded-[5px] border border-gray-200 shadow-lg" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1c2333]">Create Custom Order</h2>
                <p className="text-xs text-[#6b7280] mt-0.5">Place an order for phone/customers</p>
              </div>
              <button onClick={() => {
                setCreateOrderOpen(false)
                setNewCustomer('')
                setNewPhone('')
                setNewAddress('')
                setNewNote('')
                setNewItems([])
                setNewProdSearch('')
                setNewProdPage(1)
                setNewSelectedVariants({})
                setNewQuantities({})
                setNewShowAddProd(true)
              }} className="p-2 hover:bg-[#f5f6f9] rounded-[5px]">
                <i className="ri-close-line text-xl text-[#6b7280]"></i>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Customer Info */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1 block">Customer Name *</label>
                  <input
                    type="text"
                    value={newCustomer}
                    onChange={e => setNewCustomer(e.target.value)}
                    placeholder="Enter name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-[5px] text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1 block">Phone *</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-200 rounded-[5px] text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1 block">Address *</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    placeholder="Delivery address"
                    className="w-full px-3 py-2 border border-gray-200 rounded-[5px] text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider mb-1 block">Note (Optional)</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Any special instructions..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-[5px] text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                />
              </div>

              {/* Added Items List */}
              {newItems.length > 0 && (
                <div className="border border-[#e4e7ee] rounded-[5px] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f3f4f6] border-b border-[#e4e7ee]">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Item</th>
                        <th className="text-left px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Variant</th>
                        <th className="text-center px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Qty</th>
                        <th className="text-right px-4 py-2 text-xs uppercase text-[#374151] font-semibold">Price</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newItems.map((item, i) => {
                        const itemTotal = item.basePrice * item.qty - (item.offerDiscount || 0)
                        const itemVariants = item.productId ? (productVariants[item.productId] || []) : []
                        
                        return (
                          <tr key={item.tempId} className="border-b border-[#e4e7ee] last:border-0">
                            <td className="px-4 py-3">
                              <span>{item.name}</span>
                              {item.offerText && <span className="text-[10px] font-bold text-[#ef4444] ml-1">[{item.offerText}]</span>}
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={item.variant || ''}
                                onChange={(e) => {
                                  const variantName = e.target.value
                                  const selectedVariant = itemVariants.find(v => v.name === variantName)
                                  if (selectedVariant) {
                                    let offerText: string | null = null
                                    let offerDiscount = 0
                                    const product = allProducts.find(p => p.id === item.productId)
                                    const dVal = selectedVariant.discountValue || product?.discountValue || 0
                                    const dType = selectedVariant.discountType || product?.discountType || 'pct'

                                    if (dVal > 0) {
                                      if (dType === 'pct') {
                                        offerText = `${dVal}% OFF`
                                        offerDiscount = Math.round(selectedVariant.price * item.qty * (dVal / 100))
                                      } else {
                                        offerText = `TK ${dVal} OFF`
                                        offerDiscount = Math.min(dVal * item.qty, selectedVariant.price * item.qty)
                                      }
                                    }

                                    setNewItems(newItems.map((it, idx) => 
                                      idx === i ? { 
                                        ...it, 
                                        variant: variantName, 
                                        basePrice: selectedVariant.price,
                                        offerText,
                                        offerDiscount
                                      } : it
                                    ))
                                  }
                                }}
                                className="px-2 py-1 border border-[#e5e7eb] rounded-[5px] text-[13px] bg-white focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                              >
                                {itemVariants.map(v => (
                                  <option key={v.id} value={v.name}>{v.name} (TK {roundPrice(v.price)})</option>
                                ))}
                              </select>
                            </td>
                            <td className="text-center px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => setNewItems(newItems.map((it, idx) => idx === i ? { ...it, qty: Math.max(1, it.qty - 1) } : it))}
                                  className="w-6 h-6 rounded-[3px] border border-[#e4e7ee] bg-white flex items-center justify-center hover:bg-[#f5f6f9] text-[12px]">−</button>
                                <span className="w-5 text-center font-medium">{item.qty}</span>
                                <button onClick={() => setNewItems(newItems.map((it, idx) => idx === i ? { ...it, qty: it.qty + 1 } : it))}
                                  className="w-6 h-6 rounded-[3px] border border-[#e4e7ee] bg-white flex items-center justify-center hover:bg-[#f5f6f9] text-[12px]">+</button>
                              </div>
                            </td>
                            <td className="text-right font-semibold px-4 py-3">
                              <span className="text-[#16a34a]">TK {roundPrice(itemTotal)}</span>
                            </td>
                            <td className="px-2">
                              <button onClick={() => setNewItems(newItems.filter((_, idx) => idx !== i))}
                                className="w-6 h-6 rounded-[3px] bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center hover:bg-[#ef4444] hover:text-white flex-shrink-0">
                                <i className="ri-delete-bin-line text-[12px]"></i>
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Product Section - Searchable Table */}
              <div className="border border-[#e4e7ee] rounded-[5px] p-4 bg-white">
                <div className="text-[13px] font-semibold text-[#1c2333] mb-3">Search & Add Products</div>
                
                {/* Search Bar */}
                <div className="relative mb-3">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"></i>
                  <input
                    type="text"
                    value={newProdSearch}
                    onChange={e => {
                      setNewProdSearch(e.target.value)
                      setNewProdPage(1)
                    }}
                    placeholder="Search products by name, category, or variety..."
                    className="w-full pl-9 pr-4 py-2 border border-[#e5e7eb] rounded-[5px] text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                  />
                </div>

                {/* Products Table */}
                <div className="overflow-x-auto border border-[#e5e7eb] rounded-[5px]">
                  <table className="w-full text-sm">
                    <thead className="bg-white border-b border-[#e5e7eb]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Product</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Variety</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Stock</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e7eb]">
                      {(() => {
                        // Filter products by search
                        const filtered = allProducts.filter(p => {
                          if (!newProdSearch) return true
                          const q = newProdSearch.toLowerCase()
                          const variants = productVariants[p.id] || []
                          return p.name.toLowerCase().includes(q) ||
                            (p.category && p.category.toLowerCase().includes(q)) ||
                            variants.some(v => v.name.toLowerCase().includes(q))
                        })
                        // Pagination
                        const totalPages = Math.ceil(filtered.length / PRODUCTS_PER_PAGE)
                        const paginated = filtered.slice((newProdPage - 1) * PRODUCTS_PER_PAGE, newProdPage * PRODUCTS_PER_PAGE)

                        if (!newProdSearch.trim()) {
                          return (
                            <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-[#9ca3af]">
                                    Type to search products...
                                  </td>
                                </tr>
                              )
                            }

                            if (paginated.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="px-4 py-8 text-center text-[#9ca3af]">
                                    No products found
                                  </td>
                                </tr>
                              )
                            }

                            return paginated.map(p => {
                              const variants = productVariants[p.id] || []
                              const totalStock = variants.reduce((acc, v) => acc + v.stock, 0)
                              const selectedVarName = newSelectedVariants[p.id] || (variants[0]?.name || '')
                              const currentVar = variants.find(v => v.name === selectedVarName)
                              const variantStock = currentVar?.stock || 0

                              return (
                                <tr key={p.id} className="hover:bg-[#f9fafb]">
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-[#f3f4f6] rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {p.image ? (
                                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <i className="ri-image-line text-lg text-[#9ca3af]"></i>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1 max-w-[140px]">
                                        <div className="font-medium text-[#1f2937] whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                                        <div className="text-xs text-[#6b7280] whitespace-nowrap overflow-hidden text-ellipsis">{p.category || '—'}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <select
                                      value={selectedVarName}
                                      onChange={(e) => {
                                        const newVar = e.target.value
                                        setNewSelectedVariants({ ...newSelectedVariants, [p.id]: newVar })
                                        const v = variants.find(v => v.name === newVar)
                                        if (v && (newQuantities[p.id] || 1) > v.stock) {
                                          setNewQuantities({ ...newQuantities, [p.id]: v.stock })
                                        }
                                      }}
                                      className="px-2 py-1 border border-[#e5e7eb] rounded-[5px] text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a]"
                                    >
                                      {variants.map(v => (
                                        <option key={v.id} value={v.name}>
                                          {v.name} (TK {roundPrice(v.price)})
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => {
                                          const current = newQuantities[p.id] || 1
                                          if (current > 1) {
                                            setNewQuantities({ ...newQuantities, [p.id]: current - 1 })
                                          }
                                        }}
                                        className="w-6 h-6 flex items-center justify-center border border-[#e5e7eb] rounded-[3px] hover:bg-[#f3f4f6]"
                                      >−</button>
                                      <span className="w-8 text-center">{newQuantities[p.id] || 1}</span>
                                      <button
                                        onClick={() => {
                                          const current = newQuantities[p.id] || 1
                                          if (current < variantStock) {
                                            setNewQuantities({ ...newQuantities, [p.id]: current + 1 })
                                          }
                                        }}
                                        className="w-6 h-6 flex items-center justify-center border border-[#e5e7eb] rounded-[3px] hover:bg-[#f3f4f6]"
                                      >+</button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-[#1f2937]">{variantStock} out of {totalStock}</span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <button
                                      onClick={() => {
                                        const varName = newSelectedVariants[p.id] || (variants[0]?.name || '')
                                        if (!varName) {
                                          showToastMsg('Select variant first')
                                          return
                                        }
                                        const variant = variants.find(v => v.name === varName)
                                        if (!variant) return

                                        const price = variant.price
                                        const qtyToAdd = newQuantities[p.id] || 1
                                        let offerText: string | null = null
                                        let offerDiscount = 0
                                        const dVal = variant.discountValue || p.discountValue || 0
                                        const dType = variant.discountType || p.discountType || 'pct'

                                        if (dVal > 0) {
                                          if (dType === 'pct') {
                                            offerText = `${dVal}% OFF`
                                            offerDiscount = Math.round(price * qtyToAdd * (dVal / 100))
                                          } else {
                                            offerText = `TK ${dVal} OFF`
                                            offerDiscount = Math.min(dVal * qtyToAdd, price * qtyToAdd)
                                          }
                                        }

                                        setNewItems([...newItems, {
                                          tempId: `new-${p.id}-${Date.now()}`,
                                          name: p.name,
                                          variant: variant.name,
                                          qty: qtyToAdd,
                                          basePrice: price,
                                          offerText,
                                          offerDiscount,
                                          couponCode: null,
                                          couponDiscount: 0,
                                          productId: p.id
                                        }])

                                        // Reset selection
                                        setNewQuantities({ ...newQuantities, [p.id]: 1 })
                                        showToastMsg('Product added!')
                                      }}
                                      className="px-3 py-1 bg-[#16a34a] text-white rounded-[5px] text-xs font-medium hover:bg-[#15803d] transition flex items-center gap-1"
                                    >
                                      <i className="ri-add-line"></i> Add
                                    </button>
                                  </td>
                                </tr>
                              )
                            })
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {(() => {
                      const filtered = allProducts.filter(p => {
                        if (!newProdSearch) return false
                        const q = newProdSearch.toLowerCase()
                        const variants = productVariants[p.id] || []
                        return p.name.toLowerCase().includes(q) ||
                          (p.category && p.category.toLowerCase().includes(q)) ||
                          variants.some(v => v.name.toLowerCase().includes(q))
                      })
                      const totalPages = Math.ceil(filtered.length / PRODUCTS_PER_PAGE)

                      if (newProdSearch.trim() && filtered.length > 0) {
                        return (
                          <div className="flex items-center justify-between mt-4 text-sm">
                            <span className="text-[#4b5563]">
                              Showing {((newProdPage - 1) * PRODUCTS_PER_PAGE) + 1} – {Math.min(newProdPage * PRODUCTS_PER_PAGE, filtered.length)} of {filtered.length} products
                            </span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setNewProdPage(Math.max(1, newProdPage - 1))}
                                disabled={newProdPage === 1}
                                className="px-3 py-1 border border-[#e5e7eb] rounded-[5px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6]"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => setNewProdPage(Math.min(totalPages, newProdPage + 1))}
                                disabled={newProdPage === totalPages || totalPages === 0}
                                className="px-3 py-1 border border-[#e5e7eb] rounded-[5px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#f3f4f6]"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )
                      }
                      return null
                    })()}
              </div>

              {/* Coupon Code Section - Only show when products are selected */}
              {newItems.length > 0 && (
                <div className="border border-[#e4e7ee] rounded-[5px] p-4 bg-white">
                  <div className="text-[13px] font-semibold text-[#1c2333] mb-3">Apply Coupon Code</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCouponCode}
                      onChange={(e) => {
                        setNewCouponCode(e.target.value.toUpperCase())
                        setCouponError('')
                      }}
                      placeholder="Enter coupon code"
                      disabled={!!appliedCoupon}
                      className="flex-1 px-3 py-2 border border-[#e5e7eb] rounded-[5px] text-sm focus:outline-none focus:ring-1 focus:ring-[#16a34a] focus:border-[#16a34a] uppercase disabled:bg-gray-50 disabled:text-gray-500"
                    />
                    {appliedCoupon ? (
                      <button
                        onClick={removeCoupon}
                        className="px-4 py-2 bg-[#ef4444] text-white rounded-[5px] text-[13px] font-medium hover:bg-[#dc2626] transition"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={validateAndApplyCoupon}
                        disabled={couponValidating || !newCouponCode.trim()}
                        className="px-4 py-2 bg-[#3b82f6] text-white rounded-[5px] text-[13px] font-medium hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {couponValidating ? 'Validating...' : 'Apply'}
                      </button>
                    )}
                  </div>
                  {couponError && (
                    <div className="mt-2 text-[12px] text-[#ef4444]">{couponError}</div>
                  )}
                  {appliedCoupon && (
                    <div className="mt-2 flex items-center gap-2 text-[12px]">
                      <span className="text-[#16a34a] font-semibold">
                        <i className="ri-checkbox-circle-fill mr-1"></i>
                        Coupon "{appliedCoupon.code}" applied
                      </span>
                      <span className="text-[#16a34a] font-bold">
                        -TK {appliedCoupon.discount}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Total - Single Line like Overview */}
              {(() => {
                const subtotal = newItems.reduce((sum, item) => sum + item.basePrice * item.qty, 0)
                const offerDiscount = newItems.reduce((sum, item) => sum + (item.offerDiscount || 0), 0)
                const delivery = subtotal >= 500 ? 0 : 60
                const total = subtotal - offerDiscount - newCouponDiscount + delivery
                
                return (
                  <div className="border border-[#e4e7ee] rounded-[5px] p-3 bg-white text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#6b7280] text-xs font-medium">Order Calculation</span>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span>Subtotal: <span className="font-medium">TK {roundPrice(subtotal)}</span></span>
                        {offerDiscount > 0 && (
                          <>
                            <span className="text-[#e4e7ee]">|</span>
                            <span className="text-[#ef4444]">Discount: <span className="font-medium">TK {roundPrice(offerDiscount)}</span></span>
                          </>
                        )}
                        {newCouponDiscount > 0 && (
                          <>
                            <span className="text-[#e4e7ee]">|</span>
                            <span className="text-[#16a34a]">Coupon: <span className="font-medium">TK {roundPrice(newCouponDiscount)}</span></span>
                          </>
                        )}
                        <span className="text-[#e4e7ee]">|</span>
                        <span>Delivery: <span className="font-medium">{delivery === 0 ? 'Free' : `TK ${roundPrice(delivery)}`}</span></span>
                        <span className="text-[#e4e7ee]">|</span>
                        <span className="font-semibold text-[#16a34a]">Total: TK {roundPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setCreateOrderOpen(false)}
                className="px-4 py-2 text-[13px] font-semibold text-[#6b7280] border border-gray-200 rounded-[5px] hover:bg-[#f5f6f9]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newCustomer || !newPhone || !newAddress) {
                    showToastMsg('Please fill customer info')
                    return
                  }
                  if (newItems.length === 0) {
                    showToastMsg('Please add at least one item')
                    return
                  }
                  
                  const validItems = newItems.filter(item => item.name && item.basePrice > 0)
                  if (validItems.length === 0) {
                    showToastMsg('Please select valid products')
                    return
                  }
                  
                  setCreating(true)
                  const subtotal = validItems.reduce((sum, item) => sum + item.basePrice * item.qty, 0)
                  const offerDiscount = validItems.reduce((sum, item) => sum + (item.offerDiscount || 0), 0)
                  const delivery = subtotal >= 500 ? 0 : 60
                  const total = subtotal - offerDiscount - newCouponDiscount + delivery
                  
                  try {
                    const res = await csrfFetch('/api/orders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        customerName: newCustomer,
                        phone: newPhone,
                        address: newAddress,
                        note: newNote || null,
                        subtotal,
                        delivery,
                        discount: offerDiscount,
                        couponCodes: appliedCoupon ? [appliedCoupon.code] : [],
                        couponAmount: newCouponDiscount,
                        total,
                        // FIX: Distribute coupon discount proportionally to avoid rounding errors
                        items: (() => {
                          // Calculate proportional distribution
                          const itemsSubtotal = validItems.reduce((sum, item) => sum + item.basePrice * item.qty, 0)
                          let distributed = 0

                          return validItems.map((item, idx) => {
                            const itemTotal = item.basePrice * item.qty
                            let couponDiscount = 0

                            if (appliedCoupon && itemsSubtotal > 0) {
                              if (idx === validItems.length - 1) {
                                // Last item gets remainder to ensure total matches exactly
                                couponDiscount = newCouponDiscount - distributed
                              } else {
                                // Proportional distribution
                                couponDiscount = Math.round((itemTotal / itemsSubtotal) * newCouponDiscount)
                                distributed += couponDiscount
                              }
                            }

                            return {
                              name: item.name,
                              variant: item.variant,
                              qty: item.qty,
                              basePrice: item.basePrice,
                              offerText: item.offerText,
                              offerDiscount: item.offerDiscount || 0,
                              couponCode: appliedCoupon?.code || null,
                              couponDiscount,
                              productId: item.productId,
                            }
                          })
                        })(),
                        status: 'pending',
                        paymentMethod: 'Cash on Delivery',
                      })
                    })
                    const result = await res.json()
                    if (result.success) {
                      showToastMsg('Order created successfully!')
                      setCreateOrderOpen(false)
                      setNewCustomer('')
                      setNewPhone('')
                      setNewAddress('')
                      setNewNote('')
                      setNewItems([])
                      setNewProdSearch('')
                      setNewProdPage(1)
                      setNewSelectedVariants({})
                      setNewQuantities({})
                      setNewCouponCode('')
                      setNewCouponDiscount(0)
                      setAppliedCoupon(null)
                      setCouponError('')
                      // Refetch orders to get the new order from database
                      await refetchOrders()
                    } else {
                      showToastMsg(result.error || 'Failed to create order')
                    }
                  } catch (err) {
                    showToastMsg('Error creating order')
                  }
                  setCreating(false)
                }}
                disabled={creating}
                className="px-5 py-2 text-[13px] font-semibold text-white bg-[#16a34a] rounded-[5px] hover:bg-[#15803d] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Download Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowReportModal(false)}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Download Orders Report</h3>
            
            {/* Report Type Selection */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="reportType"
                  value="weekly"
                  checked={reportType === 'weekly'}
                  onChange={() => setReportType('weekly')}
                  className="w-4 h-4 text-green-600"
                />
                <div>
                  <div className="font-medium text-gray-800">Weekly Report</div>
                  <div className="text-sm text-gray-500">Last 7 days orders</div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="reportType"
                  value="monthly"
                  checked={reportType === 'monthly'}
                  onChange={() => setReportType('monthly')}
                  className="w-4 h-4 text-green-600"
                />
                <div>
                  <div className="font-medium text-gray-800">Monthly Report</div>
                  <div className="text-sm text-gray-500">Last 30 days orders</div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="reportType"
                  value="current_filter"
                  checked={reportType === 'current_filter'}
                  onChange={() => setReportType('current_filter')}
                  className="w-4 h-4 text-green-600"
                />
                <div>
                  <div className="font-medium text-gray-800">Current Filter</div>
                  <div className="text-sm text-gray-500">Export {filteredOrders.length} filtered orders</div>
                </div>
              </label>
              
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="radio"
                  name="reportType"
                  value="custom"
                  checked={reportType === 'custom'}
                  onChange={() => setReportType('custom')}
                  className="w-4 h-4 text-green-600"
                />
                <div>
                  <div className="font-medium text-gray-800">Custom Range</div>
                  <div className="text-sm text-gray-500">Select specific dates</div>
                </div>
              </label>
            </div>
            
            {/* Custom Date Range */}
            {reportType === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDownloading(true)
                  try {
                    let ordersToExport: Order[] = []
                    let periodStr = ''
                    
                    if (reportType === 'current_filter') {
                      ordersToExport = filteredOrders
                      periodStr = `Filter: ${currentOrderFilter}`
                    } else {
                      let startDate: Date
                      let endDate: Date = new Date()
                      endDate.setHours(23, 59, 59, 999)
                      
                      if (reportType === 'weekly') {
                        startDate = new Date()
                        startDate.setDate(startDate.getDate() - 7)
                        startDate.setHours(0, 0, 0, 0)
                        periodStr = 'Last 7 days'
                      } else if (reportType === 'monthly') {
                        startDate = new Date()
                        startDate.setMonth(startDate.getMonth() - 1)
                        startDate.setHours(0, 0, 0, 0)
                        periodStr = 'Last 30 days'
                      } else {
                        if (!customStartDate || !customEndDate) {
                          showToastMsg('Please select start and end dates')
                          setDownloading(false)
                          return
                        }
                        startDate = new Date(customStartDate)
                        startDate.setHours(0, 0, 0, 0)
                        endDate = new Date(customEndDate)
                        endDate.setHours(23, 59, 59, 999)
                        periodStr = `${customStartDate} to ${customEndDate}`
                      }
                      
                      ordersToExport = orders.filter(o => {
                        if (!o.createdAt) return false
                        const orderDate = new Date(o.createdAt)
                        return orderDate >= startDate && orderDate <= endDate
                      })
                    }
                    
                    // Generate CSV
                    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    let csvContent = ''
                    csvContent += 'KRISHI BITAN - ORDERS REPORT\n'
                    csvContent += `Generated: ${reportDate}\n`
                    csvContent += `Period: ${periodStr}\n`
                    csvContent += '\n'
                    csvContent += 'SUMMARY\n'
                    csvContent += `Total Orders,${ordersToExport.length}\n`
                    csvContent += `Approved Orders,${ordersToExport.filter(o => o.status === 'approved').length}\n`
                    csvContent += `Pending Orders,${ordersToExport.filter(o => o.status === 'pending').length}\n`
                    csvContent += `Canceled Orders,${ordersToExport.filter(o => o.status === 'canceled').length}\n`
                    csvContent += `Total Revenue (TK),${ordersToExport.filter(o => o.status === 'approved').reduce((sum, o) => sum + roundPrice(o.total), 0)}\n`
                    csvContent += '\n'
                    csvContent += 'ORDER DETAILS\n'
                    csvContent += 'Order ID,Customer,Phone,Address,Items,Total (TK),Status,Payment Method,Date,Time\n'
                    
                    ordersToExport.forEach(order => {
                      const items = order.items?.map((i: any) => `${i.name}${i.variant ? ` (${i.variant})` : ''} x${i.qty}`).join('; ')
                      csvContent += `"${order.id}","${order.customer}","${order.phone}","${order.address}","${items}",${roundPrice(order.total)},"${order.status}","${order.paymentMethod}","${order.date}","${order.time}"\n`
                    })
                    
                    // Download file
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                    const link = document.createElement('a')
                    link.href = URL.createObjectURL(blob)
                    link.download = `KrishiBitan_Orders_${reportType === 'current_filter' ? 'filtered' : reportType}_${new Date().toISOString().split('T')[0]}.csv`
                    link.click()
                    
                    setShowReportModal(false)
                    showToastMsg('Report downloaded successfully!')
                  } catch (error) {
                    showToastMsg('Error generating report')
                  } finally {
                    setDownloading(false)
                  }
                }}
                disabled={downloading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {downloading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download CSV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrdersView
