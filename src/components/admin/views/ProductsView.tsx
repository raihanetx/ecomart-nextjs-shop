'use client'

import React, { useEffect, useState } from 'react'
import type { Product } from '@/types'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { useCsrfFetch } from '@/hooks/useCsrfFetch'

export default function ProductsView() {
  const { csrfFetch } = useCsrfFetch()
  
  // Utility to clear shop data cache so frontend shows updates immediately
  const clearShopCache = async () => {
    try {
      await csrfFetch('/api/shop-data', { method: 'POST' })
    } catch (error) {
      // Silent fail - cache clear is not critical
    }
  }
  
  const {
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
    showToastMsg,
    refetchProducts,
  } = useAdmin()
  
  const [uploadingImages, setUploadingImages] = useState(false)

  // Load variants when editingProduct changes
  useEffect(() => {
    const loadVariants = async () => {
      // Only load variants for existing products (id must be in products list)
      if (editingProduct && typeof editingProduct.id === 'number') {
        // Check if this is a real database product (exists in products list)
        const existingProduct = products.find(p => p.id === editingProduct.id)
        if (!existingProduct) {
          // This is a new product, don't try to fetch variants
          return
        }
        
        try {
          const response = await csrfFetch(`/api/variants?productId=${editingProduct.id}`)
          if (!response.ok) {
            return
          }
          const result = await response.json()
          if (result.success && result.data) {
            setProdVarieties(result.data.map((v: any) => {
              // Build discount display string
              let discountStr = ''
              if (v.discountValue && parseFloat(v.discountValue) > 0) {
                discountStr = v.discountType === 'pct' ? `${v.discountValue}%` : v.discountValue.toString()
              }
              return {
                id: v.id,
                name: v.name || '',
                price: v.price?.toString() || '',
                stock: v.stock?.toString() || '',
                discount: discountStr,
                discountType: (v.discountType || 'pct') as 'pct' | 'fixed',
                discountValue: (v.discountValue || 0).toString()
              }
            }))
          }
        } catch (error) {
        }
      }
    }
    loadVariants()
  }, [editingProduct?.id, setProdVarieties, products])

  // Load images when editingProduct changes
  useEffect(() => {
    const loadImages = async () => {
      if (editingProduct && typeof editingProduct.id === 'number') {
        // Check if this is a real database product
        const existingProduct = products.find(p => p.id === editingProduct.id)
        if (!existingProduct) return
        
        try {
          const response = await csrfFetch(`/api/product-images?productId=${editingProduct.id}`)
          const result = await response.json()
          if (result.success && result.data && result.data.length > 0) {
            setProdImages(result.data.map((img: any) => img.url))
          }
        } catch (error) {
        }
      }
    }
    loadImages()
  }, [editingProduct?.id, setProdImages, products])

  // Load FAQs when editingProduct changes
  useEffect(() => {
    const loadFaqs = async () => {
      if (editingProduct && typeof editingProduct.id === 'number') {
        // Check if this is a real database product
        const existingProduct = products.find(p => p.id === editingProduct.id)
        if (!existingProduct) return
        
        try {
          const response = await csrfFetch(`/api/product-faqs?productId=${editingProduct.id}`)
          const result = await response.json()
          if (result.success && result.data) {
            setProdFaqs(result.data.map((faq: any) => ({
              id: faq.id,
              question: faq.question || '',
              answer: faq.answer || ''
            })))
          }
        } catch (error) {
        }
      }
    }
    loadFaqs()
  }, [editingProduct?.id, setProdFaqs, products])

  // Load related products when editingProduct changes
  useEffect(() => {
    const loadRelated = async () => {
      if (editingProduct && typeof editingProduct.id === 'number') {
        // Check if this is a real database product
        const existingProduct = products.find(p => p.id === editingProduct.id)
        if (!existingProduct) return
        
        try {
          const response = await csrfFetch(`/api/related-products?productId=${editingProduct.id}`)
          const result = await response.json()
          if (result.success && result.data) {
            setProdRelated(result.data.map((r: any) => r.relatedProductId))
          }
        } catch (error) {
        }
      }
    }
    loadRelated()
  }, [editingProduct?.id, setProdRelated, products])

  // Get categories from context
  const { categories } = useAdmin()

  // Product Functions
  const openProductEdit = async (prod: Product | null = null) => {
    if (prod) {
      setEditingProduct({ ...prod, shortDesc: prod.shortDesc || '', longDesc: prod.longDesc || '', offerSwitch: prod.offer })
    } else {
      setEditingProduct({
        id: Date.now(), name: '', category: '', image: 'https://via.placeholder.com/80', variants: '0 variants', price: '$0.00', discount: '0%', offer: false, status: 'active', shortDesc: '', longDesc: '', offerSwitch: false
      })
    }
    setProdVarieties([])
    setProdFaqs([])
    setProdImages([])
    setProdRelated([])
  }

  const handleSaveProduct = async () => {
    if (!editingProduct?.name) { showToastMsg('Please enter product name'); return }
    if (!editingProduct?.category) { showToastMsg('Please select a category'); return }
    
    // Check if at least one image is uploaded
    if (prodImages.length === 0) {
      showToastMsg('Please upload at least one product image');
      return
    }
    
    // Check if at least one variety/variant is added with price and stock
    if (prodVarieties.length === 0) {
      showToastMsg('Please add at least one variety with price and stock');
      return
    }
    
    // Validate all varieties have name, price, and stock
    for (const v of prodVarieties) {
      if (!v.name || !v.name.trim()) {
        showToastMsg('All varieties must have a name (e.g., 1kg, 500g)');
        return
      }
      if (!v.price || parseFloat(v.price) <= 0) {
        showToastMsg('All varieties must have a valid price');
        return
      }
      if (!v.stock || parseInt(v.stock) < 0) {
        showToastMsg('All varieties must have a valid stock quantity');
        return
      }
    }
    
    try {
      // Determine if this is a new product or update
      const existingInDb = products.find(p => p.id === editingProduct.id)
      const isNewProduct = !existingInDb || typeof existingInDb.id === 'string'
      
      // Get price from first variety if available, otherwise default
      const price = prodVarieties.length > 0 ? parseFloat(prodVarieties[0].price) || 0 : 0
      const discount = prodVarieties.length > 0 ? prodVarieties[0].discount || '0%' : '0%'
      const discountType = prodVarieties.length > 0 ? prodVarieties[0].discountType || 'pct' : 'pct'
      const discountValue = prodVarieties.length > 0 ? parseFloat(prodVarieties[0].discountValue) || 0 : 0
      
      // Find categoryId from categories
      const selectedCategory = categories.find(c => c.name === editingProduct.category)
      
      const productData = {
        name: editingProduct.name,
        category: editingProduct.category,
        categoryId: selectedCategory?.id || null,
        image: prodImages.length > 0 ? prodImages[0] : editingProduct.image,
        price: price,
        discount: discount,
        discountType: discountType,
        discountValue: discountValue,
        offer: editingProduct.offerSwitch || false,
        status: editingProduct.status || 'active',
        shortDesc: editingProduct.shortDesc || '',
        longDesc: editingProduct.longDesc || '',
      }
      
      let savedProductId = editingProduct.id
      
      if (isNewProduct) {
        // Create new product
        const response = await csrfFetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData),
        })
        const result = await response.json()
        if (result.success) {
          savedProductId = result.data.id
          showToastMsg('Product Created Successfully!')
          await refetchProducts()
        } else {
          showToastMsg('Failed to create product')
          return
        }
      } else {
        // Update existing product
        const response = await csrfFetch('/api/products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProduct.id, ...productData }),
        })
        const result = await response.json()
        if (result.success) {
          showToastMsg('Product Updated Successfully!')
          await refetchProducts()
        } else {
          showToastMsg('Failed to update product')
          return
        }
      }
      
      // Save variants to database
      if (prodVarieties.length > 0 && savedProductId) {
        // First, delete existing variants for this product
        await csrfFetch(`/api/variants?productId=${savedProductId}`, { method: 'DELETE' })
        
        // Then, create new variants
        await csrfFetch('/api/variants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prodVarieties.map(v => ({
            name: v.name,
            stock: parseInt(v.stock) || 0,
            initialStock: parseInt(v.stock) || 0,
            price: parseFloat(v.price) || 0,
            discount: v.discountValue ? `${v.discountValue}${v.discountType === 'pct' ? '%' : ''}` : '0%',
            discountType: v.discountType || 'pct',
            discountValue: parseFloat(v.discountValue) || 0,
            productId: savedProductId
          })))
        })
      }
      
      // Save images to database
      if (savedProductId) {
        // First, delete existing images for this product
        await csrfFetch(`/api/product-images?productId=${savedProductId}`, { method: 'DELETE' })
        
        // Then, create new images if any
        if (prodImages.length > 0) {
          await csrfFetch('/api/product-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prodImages.map((url, index) => ({
              url: url,
              sortOrder: index,
              productId: savedProductId
            })))
          })
        }
      }
      
      // Save FAQs to database
      if (savedProductId) {
        // First, delete existing FAQs for this product
        await csrfFetch(`/api/product-faqs?productId=${savedProductId}`, { method: 'DELETE' })
        
        // Then, create new FAQs if any
        if (prodFaqs.length > 0) {
          await csrfFetch('/api/product-faqs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prodFaqs.filter(f => f.question && f.answer).map((faq, index) => ({
              question: faq.question,
              answer: faq.answer,
              sortOrder: index,
              productId: savedProductId
            })))
          })
        }
      }
      
      // Save related products to database
      if (savedProductId) {
        // First, delete existing related products for this product
        await csrfFetch(`/api/related-products?productId=${savedProductId}`, { method: 'DELETE' })
        
        // Then, create new related products if any
        if (prodRelated.length > 0) {
          await csrfFetch('/api/related-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prodRelated.map((relatedProductId, index) => ({
              relatedProductId: relatedProductId,
              sortOrder: index,
              productId: savedProductId
            })))
          })
        }
      }
    } catch (error) {
      showToastMsg('Error saving product')
    }
    
    clearShopCache() // Clear frontend cache so changes reflect immediately
    setEditingProduct(null)
  }

  const toggleProdStatus = async (id: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return
    
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    
    // Optimistic update
    setProducts(products.map(p => p.id === id ? { ...p, status: newStatus } : p))
    
    try {
      const response = await csrfFetch('/api/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      })
      const result = await response.json()
      if (!result.success) {
        // Revert on failure
        setProducts(products.map(p => p.id === id ? { ...p, status: product.status } : p))
        showToastMsg('Failed to update status')
      } else {
        clearShopCache() // Clear frontend cache so changes reflect immediately
      }
    } catch (error) {
      // Revert on error
      setProducts(products.map(p => p.id === id ? { ...p, status: product.status } : p))
      showToastMsg('Error updating status')
    }
  }

  const deleteProduct = async (id: number) => {
    try {
      const response = await csrfFetch(`/api/products?id=${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (result.success) {
        setProducts(products.filter(p => p.id !== id))
        showToastMsg('Product deleted successfully')
        clearShopCache() // Clear frontend cache so changes reflect immediately
      } else {
        showToastMsg('Failed to delete product')
      }
    } catch (error) {
      showToastMsg('Error deleting product')
    }
  }

  const addVariety = () => {
    setProdVarieties(prev => {
      const newVarieties = [...prev, { 
        id: Date.now(), 
        name: '', 
        price: '', 
        stock: '', 
        discount: '', 
        discountType: 'pct' as const, 
        discountValue: '' 
      }]
      return newVarieties
    })
  }
  const addFaq = () => setProdFaqs(prev => [...prev, { id: Date.now(), question: '', answer: '' }])
  const removeVariety = (id: number) => setProdVarieties(prev => prev.filter(v => v.id !== id))
  const removeFaq = (id: number) => setProdFaqs(prev => prev.filter(f => f.id !== id))
  const updateVariety = (id: number, field: 'name' | 'price' | 'stock' | 'discount' | 'discountType' | 'discountValue', value: string) => {
    setProdVarieties(prev => prev.map(v => {
      if (v.id !== id) return v
      
      // Only percentage discount - always set to 'pct'
      if (field === 'discount') {
        const numValue = value.replace('%', '').trim()
        return {
          ...v,
          discount: numValue ? `${numValue}%` : '',
          discountType: 'pct',
          discountValue: numValue
        }
      }
      
      return {...v, [field]: value}
    }))
  }
  const updateFaq = (id: number, field: 'question' | 'answer', value: string) => {
    setProdFaqs(prev => prev.map(f => f.id === id ? {...f, [field]: value} : f))
  }
  const toggleRelated = (id: number) => {
    if (prodRelated.includes(id)) setProdRelated(prodRelated.filter(i => i !== id))
    else if (prodRelated.length < 4) setProdRelated([...prodRelated, id])
  }

  return (
    <div className="prod-mgmt-wrapper">
      {editingProduct ? (
        <div className="prod-edit-wrapper">
          <div className="max-w-3xl mx-auto" style={{padding: '0 16px'}}>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveProduct(); }}>
              <div className="ep-card">
                <h2 style={{fontSize: '16px', fontWeight: 600, marginBottom: '20px'}}>Basic Information</h2>
                <div style={{marginBottom: '18px'}}>
                  <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px'}}>Product Name</label>
                  <input type="text" className="form-input" placeholder="Organic Red Apples" value={editingProduct.name} onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})} />
                </div>
                <div style={{display: 'flex', gap: '12px', alignItems: 'flex-end'}}>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px'}}>Category</label>
                    <select className="form-input" value={editingProduct.category} onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}>
                      <option value="">Select Category</option>
                      {categories.filter(c => c.status === 'Active').map((cat) => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{flex: 1}}>
                    <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px'}}>Offer Product</label>
                    <div 
                      onClick={() => setEditingProduct({...editingProduct, offerSwitch: !editingProduct.offerSwitch})}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: '#fff',
                        border: `1px solid ${editingProduct.offerSwitch ? '#10b981' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{fontSize: '13px', color: editingProduct.offerSwitch ? '#059669' : '#64748b', fontWeight: 500}}>
                        {editingProduct.offerSwitch ? 'Yes, this is an offer' : 'No, regular price'}
                      </span>
                      <div style={{
                        width: '40px',
                        height: '22px',
                        background: editingProduct.offerSwitch ? '#10b981' : '#d1d5db',
                        borderRadius: '11px',
                        position: 'relative',
                        transition: 'background 0.2s'
                      }}>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          background: 'white',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '2px',
                          left: editingProduct.offerSwitch ? '20px' : '2px',
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                        }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ep-card">
                <h2 style={{fontSize: '16px', fontWeight: 600, marginBottom: '20px'}}>Descriptions</h2>
                <div style={{marginBottom: '18px'}}>
                  <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px'}}>Short Description</label>
                  <textarea 
                    className="form-input" 
                    rows={2} 
                    placeholder="Fresh and organic" 
                    value={editingProduct.shortDesc || ''} 
                    onChange={(e) => setEditingProduct({...editingProduct, shortDesc: e.target.value})}
                    style={{resize: 'vertical', whiteSpace: 'pre-wrap'}}
                  ></textarea>
                </div>
                <div>
                  <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px'}}>Long Description</label>
                  <textarea 
                    className="form-input" 
                    rows={6} 
                    placeholder="Describe the product..." 
                    value={editingProduct.longDesc || ''} 
                    onChange={(e) => setEditingProduct({...editingProduct, longDesc: e.target.value})}
                    style={{resize: 'vertical', whiteSpace: 'pre-wrap'}}
                  ></textarea>
                </div>
              </div>

              <div className="ep-card">
                <h2 style={{fontSize: '16px', fontWeight: 600, marginBottom: '16px'}}>Product Images</h2>
                
                <input 
                  type="file" 
                  id="prodImgUp" 
                  style={{display: 'none'}} 
                  accept="image/*"
                  multiple
                  onChange={async (e) => {
                    const files = e.target.files
                    if (!files || files.length === 0) return
                    
                    const remainingSlots = 5 - prodImages.length
                    if (remainingSlots <= 0) {
                      showToastMsg('Maximum 5 images allowed!')
                      return
                    }
                    
                    setUploadingImages(true)
                    const filesToProcess = Math.min(files.length, remainingSlots)
                    const uploadedUrls: string[] = []
                    
                    for (let i = 0; i < filesToProcess; i++) {
                      const file = files[i]
                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('type', 'product')
                        
                        const response = await csrfFetch('/api/upload', {
                          method: 'POST',
                          body: formData
                        })
                        const result = await response.json()
                        
                        if (result.success && result.url) {
                          uploadedUrls.push(result.url)
                        } else {
                          showToastMsg(`Failed to upload ${file.name}`)
                        }
                      } catch (error) {
                        showToastMsg(`Error uploading ${file.name}`)
                      }
                    }
                    
                    if (uploadedUrls.length > 0) {
                      setProdImages(prev => [...prev, ...uploadedUrls].slice(0, 5))
                    }
                    
                    setUploadingImages(false)
                    e.target.value = ''
                  }}
                  disabled={uploadingImages || prodImages.length >= 5}
                />
                
                {/* Image Upload Box */}
                <div 
                  onClick={() => !uploadingImages && prodImages.length < 5 && document.getElementById('prodImgUp')?.click()}
                  style={{
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '20px',
                    textAlign: 'center',
                    cursor: uploadingImages || prodImages.length >= 5 ? 'not-allowed' : 'pointer',
                    background: '#fafbfc',
                    transition: 'all 0.2s',
                    opacity: uploadingImages || prodImages.length >= 5 ? 0.6 : 1,
                    marginBottom: '16px'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingImages && prodImages.length < 5) {
                      e.currentTarget.style.borderColor = '#10b981'
                      e.currentTarget.style.background = '#f0fdf4'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0'
                    e.currentTarget.style.background = '#fafbfc'
                  }}
                >
                  {uploadingImages ? (
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                      <i className="ri-loader-4-line" style={{fontSize: '28px', color: '#10b981', animation: 'spin 1s linear infinite'}}></i>
                      <span style={{fontSize: '13px', color: '#64748b'}}>Uploading...</span>
                    </div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'}}>
                      <i className="ri-upload-cloud-2-line" style={{fontSize: '28px', color: '#94a3b8'}}></i>
                      <span style={{fontSize: '13px', color: '#374151', fontWeight: 500}}>
                        {prodImages.length >= 5 ? 'Maximum images reached' : 'Click to upload images'}
                      </span>
                      <span style={{fontSize: '12px', color: '#94a3b8'}}>PNG, JPG or WEBP • Max 5 images</span>
                    </div>
                  )}
                </div>
                
                {/* Fixed 5-Slot Image Grid - Always Full Width */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '10px'
                }}>
                  {[1, 2, 3, 4, 5].map((slot) => {
                    const img = prodImages[slot - 1]
                    return (
                      <div key={slot} style={{
                        position: 'relative',
                        aspectRatio: '1',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: img ? (slot === 1 ? '2px solid #10b981' : '1px solid #e2e8f0') : '2px dashed #cbd5e1',
                        background: img ? '#f8fafc' : '#fafbfc',
                        cursor: img ? 'default' : (uploadingImages ? 'not-allowed' : 'pointer'),
                        transition: 'all 0.2s'
                      }}>
                        {img ? (
                          <>
                            <img 
                              src={img} 
                              style={{width: '100%', height: '100%', objectFit: 'cover'}} 
                              alt="" 
                            />
                            {slot === 1 && (
                              <div style={{
                                position: 'absolute', top: '6px', left: '6px',
                                padding: '3px 8px', background: 'rgba(255,255,255,0.95)',
                                borderRadius: '5px', fontSize: '9px', color: '#0f766e', fontWeight: 600,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                              }}>Primary</div>
                            )}
                            <button
                              type="button"
                              onClick={() => setProdImages(prodImages.filter((_, idx) => idx !== slot - 1))}
                              style={{
                                position: 'absolute', top: '6px', right: '6px',
                                width: '22px', height: '22px',
                                background: 'rgba(255,255,255,0.95)',
                                border: 'none', borderRadius: '6px',
                                cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s',
                                color: '#ef4444'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = 'white'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.color = '#ef4444'; }}
                            >
                              <i className="ri-close-line" style={{fontSize: '12px'}}></i>
                            </button>
                          </>
                        ) : (
                          <div 
                            onClick={() => !uploadingImages && document.getElementById('prodImgUp')?.click()}
                            style={{
                              width: '100%', 
                              height: '100%', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            {uploadingImages ? (
                              <i className="ri-loader-4-line" style={{fontSize: '18px', color: '#10b981', animation: 'spin 1s linear infinite'}}></i>
                            ) : (
                              <>
                                <i className="ri-add-line" style={{fontSize: '20px', color: '#94a3b8'}}></i>
                                <span style={{fontSize: '9px', color: '#94a3b8', fontWeight: 500}}>{slot}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="ep-card">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                  <div>
                    <h2 style={{fontSize: '16px', fontWeight: 600}}>Varieties & Pricing</h2>
                    <p style={{fontSize: '11px', color: '#9ca3af', marginTop: '2px'}}>Different sizes or options</p>
                  </div>
                  <button type="button" onClick={addVariety} style={{color: '#16a34a', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px'}}>+ Add Variety</button>
                </div>
                {prodVarieties.length === 0 && <div style={{textAlign: 'center', padding: '24px', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: '10px', background: '#fafafa'}}>No varieties added yet</div>}
                {prodVarieties.map((v) => (
                  <div key={v.id} style={{display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px', padding: '12px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f0f0f0'}}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Variety (e.g. 1kg, 500g)" 
                      value={v.name}
                      onChange={(e) => updateVariety(v.id, 'name', e.target.value)}
                      style={{fontSize: '13px', flex: 2, background: 'white', fontWeight: 600}}
                    />
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Price" 
                      value={v.price}
                      onChange={(e) => updateVariety(v.id, 'price', e.target.value)}
                      style={{fontSize: '13px', flex: 1, background: 'white'}}
                    />
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="Stock" 
                      value={v.stock}
                      onChange={(e) => updateVariety(v.id, 'stock', e.target.value)}
                      style={{fontSize: '13px', flex: 1, background: 'white'}}
                    />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Discount % (e.g. 10)" 
                      value={v.discount}
                      onChange={(e) => updateVariety(v.id, 'discount', e.target.value)}
                      style={{fontSize: '13px', flex: 1, background: 'white'}}
                    />
                    <button 
                      type="button"
                      onClick={() => removeVariety(v.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        background: 'white',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                    >
                      <i className="ri-delete-bin-line" style={{fontSize: '14px'}}></i>
                    </button>
                  </div>
                ))}
              </div>

              <div className="ep-card">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px'}}>
                  <div>
                    <h2 style={{fontSize: '16px', fontWeight: 600}}>FAQs</h2>
                    <p style={{fontSize: '11px', color: '#9ca3af', marginTop: '2px'}}>Add common questions buyers might have</p>
                  </div>
                  <button type="button" onClick={addFaq} style={{display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 500, background: '#f0fdf4', border: '1px solid #16a34a', cursor: 'pointer', fontSize: '12px', padding: '6px 12px', borderRadius: '6px'}}>
                    <i className="ri-add-line" style={{fontSize: '14px'}}></i> Add FAQ
                  </button>
                </div>
                {prodFaqs.length === 0 && (
                  <div style={{textAlign: 'center', padding: '32px 24px', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: '10px', background: '#fafafa'}}>
                    <i className="ri-question-line" style={{fontSize: '28px', color: '#d1d5db', marginBottom: '8px', display: 'block'}}></i>
                    <p style={{margin: 0, fontSize: '13px'}}>No FAQs added yet</p>
                    <p style={{margin: '4px 0 0 0', fontSize: '11px'}}>Click "Add FAQ" to add questions</p>
                  </div>
                )}
                {prodFaqs.map((f, i) => (
                  <div key={f.id} style={{display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '10px', padding: '14px', background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)', borderRadius: '10px', border: '1px solid #eee'}}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      background: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
                      color: 'white',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 600,
                      flexShrink: 0
                    }}>{i + 1}</div>
                    <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Question (e.g., Is this product organic?)" 
                        value={f.question}
                        onChange={(e) => updateFaq(f.id, 'question', e.target.value)}
                        style={{fontSize: '13px', background: 'white', border: '1px solid #e2e8e0'}}
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Answer (e.g., Yes, 100% organic and pesticide-free)" 
                        value={f.answer}
                        onChange={(e) => updateFaq(f.id, 'answer', e.target.value)}
                        style={{fontSize: '13px', background: 'white', border: '1px solid #e2e8e0'}}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeFaq(f.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '32px',
                        height: '32px',
                        background: 'white',
                        border: '1px solid #e2e8e0',
                        borderRadius: '8px',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8e0'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                      <i className="ri-delete-bin-line" style={{fontSize: '14px'}}></i>
                    </button>
                  </div>
                ))}
              </div>

              <div className="ep-card">
                <div style={{marginBottom: '12px'}}>
                  <label style={{display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px'}}>Related Products</label>
                  <p style={{fontSize: '11px', color: '#64748b'}}>Select up to 4 related products to display</p>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px'}}>
                  {allRelatedOptions.filter(p => p.id !== editingProduct?.id).map(p => (
                    <div 
                      key={p.id} 
                      className={`related-product-card ${prodRelated.includes(p.id) ? 'selected' : ''}`} 
                      onClick={() => toggleRelated(p.id)}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: prodRelated.includes(p.id) ? '2px solid #16a34a' : '1px solid #e2e8e0',
                        background: prodRelated.includes(p.id) ? '#f0fdf4' : 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center'
                      }}
                    >
                      <img src={p.image} alt={p.name} style={{width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0}} />
                      <div style={{flex: 1, minWidth: 0}}>
                        <p style={{fontSize: '12px', fontWeight: 600, color: '#1c2333', margin: 0}}>{p.name}</p>
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px'}}>
                          <span style={{fontSize: '11px', color: '#64748b'}}>{p.category}</span>
                          <span style={{fontSize: '11px', color: '#d1d5db'}}>|</span>
                          <span style={{fontSize: '12px', color: '#16a34a', fontWeight: 600}}>TK {Math.round(p.price)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                      <div style={{display: 'flex', gap: '12px', marginTop: '8px', marginBottom: '40px'}}>
                <button type="button" className="btn-cancel-prod" style={{flex: 1}} onClick={() => setEditingProduct(null)}>Cancel</button>
                <button type="submit" className="btn-primary-prod" style={{flex: 1}}>
                  {products.find(p => p.id === editingProduct?.id) ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="p-4 md:p-8 bg-white min-h-[calc(100vh-80px)]" style={{ fontFamily: "'Inter', sans-serif" }}>
          {/* Action Buttons */}
          <div className="mb-6 flex items-center justify-end flex-wrap gap-4">
            <button onClick={() => openProductEdit()} className="px-4 py-2 bg-[#16a34a] text-white text-sm font-medium rounded-lg hover:bg-[#15803d] transition-colors">+ Add Product</button>
          </div>

          {/* Table */}
          <div className="flex flex-col gap-2">
            {/* Header Row - Professional lighter background */}
            <div className="grid grid-cols-6 bg-[#f1f5f9] border border-[#e2e8f0] rounded-[5px]">
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Product</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Variants</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Price</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Offer</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Status</div>
              <div className="px-4 py-3 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Action</div>
            </div>

            {/* Data Rows */}
            {products.map((prod) => (
              <div key={prod.id} className="grid grid-cols-6 bg-white rounded-[5px] border border-[#e2e8f0] overflow-hidden hover:border-[#94a3b8] hover:shadow-sm transition-all">
                {/* Product - Image left, Name + Category on right */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center gap-3">
                  <img 
                    src={prod.image || '/placeholder.svg'} 
                    alt={prod.name} 
                    className="w-10 h-10 rounded-[5px] object-cover flex-shrink-0 border border-[#d1d5db]" 
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1e293b] truncate">{prod.name}</p>
                    <p className="text-[11px] text-[#94a3b8] truncate">{prod.category}</p>
                  </div>
                </div>
                
                {/* Variants - actual count */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className="text-[12px] font-medium text-[#475569]">
                    {prod.variantCount && prod.variantCount > 0 ? `${prod.variantCount} variant${prod.variantCount > 1 ? 's' : ''}` : '0 variants'}
                  </span>
                </div>
                
                {/* Price - range from min to max */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className="text-[13px] font-bold text-[#16a34a]">
                    {prod.priceRange && prod.priceRange.min > 0 ? (
                      prod.priceRange.min === prod.priceRange.max 
                        ? `TK ${Math.round(prod.priceRange.min)}` 
                        : `TK ${Math.round(prod.priceRange.min)} - TK ${Math.round(prod.priceRange.max)}`
                    ) : `TK ${Math.round(parseFloat(prod.price?.toString().replace(/[^0-9.]/g, '') || '0'))}`}
                  </span>
                </div>
                
                {/* Offer - Yes or No */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className={`text-[12px] font-semibold ${prod.offer ? 'text-[#16a34a]' : 'text-[#64748b]'}`}>
                    {prod.offer ? '[Yes]' : '[No]'}
                  </span>
                </div>
                
                {/* Status - Simple Professional Toggle */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <button
                    onClick={() => toggleProdStatus(prod.id)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                      prod.status === 'active' 
                        ? 'bg-[#16a34a]' 
                        : 'bg-[#cbd5e1]'
                    }`}
                    title={prod.status === 'active' ? 'Click to deactivate' : 'Click to activate'}
                  >
                    <span 
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                        prod.status === 'active' ? 'left-6' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
                
                {/* Action */}
                <div className="px-4 py-3 flex items-center justify-center gap-1">
                  <button 
                    onClick={() => openProductEdit(prod)} 
                    className="px-3 py-1.5 text-[11px] font-medium text-[#475569] bg-[#f1f5f9] rounded-md hover:bg-[#e2e8f0] hover:text-[#1e293b] transition-colors"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => deleteProduct(prod.id)} 
                    className="px-3 py-1.5 text-[11px] font-medium text-[#ef4444] bg-[#fef2f2] rounded-md hover:bg-[#fee2e2] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            {products.length === 0 && (
              <div className="bg-white rounded-[5px] border border-[#e2e8f0] p-12 text-center">
                <p className="text-[#94a3b8] text-sm">No products found. Click "Add Product" to create one.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
