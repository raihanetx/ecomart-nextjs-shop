'use client'

import React, { useRef, useState } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { useCsrfFetch } from '@/hooks/useCsrfFetch'
import type { Category } from '@/types'

// Popular icons that non-technical users can easily understand
const POPULAR_ICONS = [
  { icon: 'ri-leaf-line', label: 'Leaf' },
  { icon: 'ri-plant-line', label: 'Plant' },
  { icon: 'ri-seedling-line', label: 'Seedling' },
  { icon: 'ri-apple-line', label: 'Apple' },
  { icon: 'ri-restaurant-line', label: 'Food' },
  { icon: 'ri-cake-line', label: 'Cake' },
  { icon: 'ri-gift-line', label: 'Gift' },
  { icon: 'ri-shopping-basket-line', label: 'Basket' },
  { icon: 'ri-shopping-cart-line', label: 'Cart' },
  { icon: 'ri-hand-heart-line', label: 'Hand Heart' },
  { icon: 'ri-heart-line', label: 'Heart' },
  { icon: 'ri-star-line', label: 'Star' },
  { icon: 'ri-home-line', label: 'Home' },
  { icon: 'ri-t-shirt-line', label: 'Clothing' },
  { icon: 'ri-footprint-line', label: 'Footwear' },
  { icon: 'ri-smartphone-line', label: 'Phone' },
  { icon: 'ri-laptop-line', label: 'Laptop' },
  { icon: 'ri-camera-line', label: 'Camera' },
  { icon: 'ri-book-line', label: 'Book' },
  { icon: 'ri-music-line', label: 'Music' },
  { icon: 'ri-medicine-bottle-line', label: 'Medicine' },
  { icon: 'ri-first-aid-kit-line', label: 'First Aid' },
  { icon: 'ri-car-line', label: 'Car' },
  { icon: 'ri-bike-line', label: 'Bike' },
  { icon: 'ri-tools-line', label: 'Tools' },
  { icon: 'ri-paint-brush-line', label: 'Art' },
  { icon: 'ri-basketball-line', label: 'Sports' },
  { icon: 'ri-gamepad-line', label: 'Gaming' },
  { icon: 'ri-baby-line', label: 'Baby' },
  { icon: 'ri-beauty-line', label: 'Beauty' },
]

export function CategoriesView() {
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
    categories,
    editingCategory,
    setEditingCategory,
    showToastMsg,
    refetchCategories
  } = useAdmin()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [iconSearch, setIconSearch] = useState('')

  const openCategoryEdit = (cat: Category | null = null) => {
    if (cat) {
      setEditingCategory({ ...cat, type: cat.type || 'icon' })
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

  const handleSaveCategory = async () => {
    if (!editingCategory?.name) {
      showToastMsg('Please enter a category name')
      return
    }

    // Validate based on type
    if (editingCategory.type === 'icon' && !editingCategory.icon) {
      showToastMsg('Please select an icon for the category')
      return
    }
    
    if (editingCategory.type === 'image' && !editingCategory.image) {
      showToastMsg('Please upload an image for the category')
      return
    }

    setIsSaving(true)
    
    try {
      const exists = categories.find(c => c.id === editingCategory.id)
      
      if (exists) {
        // Update existing category
        const response = await csrfFetch('/api/categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingCategory.id,
            name: editingCategory.name,
            type: editingCategory.type,
            icon: editingCategory.icon,
            image: editingCategory.image,
            items: editingCategory.items,
            status: editingCategory.status
          })
        })
        
        if (response.ok) {
          showToastMsg('Category updated successfully!')
          refetchCategories()
          clearShopCache() // Clear frontend cache so changes reflect immediately
          setEditingCategory(null)
        } else {
          const data = await response.json()
          showToastMsg(data.error || 'Failed to update category')
        }
      } else {
        // Create new category
        const response = await csrfFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingCategory.id,
            name: editingCategory.name,
            type: editingCategory.type,
            icon: editingCategory.icon,
            image: editingCategory.image,
            items: editingCategory.items,
            status: editingCategory.status
          })
        })
        
        if (response.ok) {
          showToastMsg('Category created successfully!')
          refetchCategories()
          clearShopCache() // Clear frontend cache so changes reflect immediately
          setEditingCategory(null)
        } else {
          const data = await response.json()
          showToastMsg(data.error || 'Failed to create category')
        }
      }
    } catch (error) {
      showToastMsg('Error saving category')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Products in this category will be unassigned.')) return
    
    try {
      const response = await csrfFetch(`/api/categories?id=${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        showToastMsg('Category deleted successfully!')
        refetchCategories()
        clearShopCache() // Clear frontend cache so changes reflect immediately
      } else {
        showToastMsg('Failed to delete category')
      }
    } catch (error) {
      showToastMsg('Error deleting category')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setIsUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', 'category')
        
        const response = await csrfFetch('/api/upload', {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        
        if (result.success && result.url) {
          setEditingCategory({ ...editingCategory!, image: result.url })
          showToastMsg('Image uploaded!')
        } else {
          // More helpful error message
          if (result.error?.includes('Cloudinary')) {
            showToastMsg('Image upload requires Cloudinary setup. Go to Settings → Credentials.')
          } else {
            showToastMsg(result.error || 'Failed to upload image')
          }
        }
      } catch (error) {
        showToastMsg('Upload failed. Check your internet connection.')
      } finally {
        setIsUploading(false)
      }
    }
  }

  const filteredIcons = POPULAR_ICONS.filter(i => 
    i.label.toLowerCase().includes(iconSearch.toLowerCase())
  )

  // ADD/EDIT CATEGORY PAGE
  if (editingCategory) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '2rem',
        paddingTop: '1rem',
        minHeight: 'calc(100vh - 80px)'
      }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '12px',
          overflow: 'hidden',
          width: '100%',
          maxWidth: '600px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
        }}>
          {/* Header */}
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h3 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.1rem',
              fontWeight: 600,
              color: '#111827',
              margin: 0
            }}>
              {categories.find(c => c.id === editingCategory.id) ? 'Edit Category' : 'Add New Category'}
            </h3>
          </div>
          
          <div style={{ padding: '1.5rem' }}>
            {/* Category Type - Simplified */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
                marginBottom: '0.5rem',
                color: '#374151'
              }}>
                Display Style
              </label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    cursor: 'pointer',
                    padding: '0.75rem 1rem',
                    border: editingCategory.type === 'icon' ? '2px solid #16a34a' : '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: editingCategory.type === 'icon' ? '#f0fdf4' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input 
                    type="radio" 
                    name="catType" 
                    checked={editingCategory.type === 'icon'}
                    onChange={() => setEditingCategory({ ...editingCategory, type: 'icon', image: '' })}
                    style={{ accentColor: '#16a34a', width: '16px', height: '16px' }}
                  />
                  <div>
                    <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Icon</span>
                    <p style={{ fontSize: '0.7rem', color: '#6b7280', margin: 0 }}>Choose from icon library</p>
                  </div>
                </label>
                <label 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem', 
                    cursor: 'pointer',
                    padding: '0.75rem 1rem',
                    border: editingCategory.type === 'image' ? '2px solid #16a34a' : '2px solid #e5e7eb',
                    borderRadius: '8px',
                    background: editingCategory.type === 'image' ? '#f0fdf4' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input 
                    type="radio" 
                    name="catType" 
                    checked={editingCategory.type === 'image'}
                    onChange={() => setEditingCategory({ ...editingCategory, type: 'image', icon: '' })}
                    style={{ accentColor: '#16a34a', width: '16px', height: '16px' }}
                  />
                  <div>
                    <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Image</span>
                    <p style={{ fontSize: '0.7rem', color: '#6b7280', margin: 0 }}>Upload custom image</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Category Name */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 500,
                marginBottom: '0.5rem',
                color: '#374151'
              }}>
                Category Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text" 
                placeholder="e.g., Vegetables, Fruits, Snacks"
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  color: '#111827',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#16a34a'
                  e.target.style.boxShadow = '0 0 0 3px rgba(22, 163, 74, 0.15)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.boxShadow = 'none'
                }}
              />
              <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                Example: "Organic Vegetables", "Fresh Fruits", "Snacks & Beverages"
              </p>
            </div>

            {/* Icon Picker - User Friendly */}
            {editingCategory.type === 'icon' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem',
                  color: '#374151'
                }}>
                  Choose an Icon
                </label>
                
                {/* Selected Icon Preview */}
                <div 
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: '#fafafa',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: editingCategory.icon ? '#f0fdf4' : '#f3f4f6',
                    border: `2px solid ${editingCategory.icon ? '#16a34a' : '#d1d5db'}`,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {editingCategory.icon ? (
                      <i className={editingCategory.icon} style={{ fontSize: '1.25rem', color: '#16a34a' }}></i>
                    ) : (
                      <i className="ri-add-line" style={{ fontSize: '1.25rem', color: '#9ca3af' }}></i>
                    )}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
                      {editingCategory.icon 
                        ? POPULAR_ICONS.find(i => i.icon === editingCategory.icon)?.label || 'Custom Icon'
                        : 'Click to select icon'
                      }
                    </p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#6b7280' }}>
                      {editingCategory.icon ? 'Click to change' : 'Required'}
                    </p>
                  </div>
                  <i className={`ri-arrow-${showIconPicker ? 'up' : 'down'}-s-line`} style={{ marginLeft: 'auto', color: '#9ca3af' }}></i>
                </div>

                {/* Icon Picker Dropdown */}
                {showIconPicker && (
                  <div style={{
                    marginTop: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: 'white',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}>
                    {/* Search */}
                    <input
                      type="text"
                      placeholder="Search icons..."
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        marginBottom: '0.75rem',
                        outline: 'none'
                      }}
                    />
                    
                    {/* Icon Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 1fr)',
                      gap: '0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {filteredIcons.map(({ icon, label }) => (
                        <div
                          key={icon}
                          onClick={() => {
                            setEditingCategory({ ...editingCategory, icon })
                            setShowIconPicker(false)
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.5rem',
                            border: editingCategory.icon === icon ? '2px solid #16a34a' : '1px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: editingCategory.icon === icon ? '#f0fdf4' : 'white',
                            transition: 'all 0.2s'
                          }}
                          title={label}
                        >
                          <i className={icon} style={{ fontSize: '1.25rem', color: editingCategory.icon === icon ? '#16a34a' : '#374151' }}></i>
                          <span style={{ fontSize: '0.6rem', color: '#6b7280' }}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image Upload */}
            {editingCategory.type === 'image' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginBottom: '0.5rem',
                  color: '#374151'
                }}>
                  Category Image
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
                <div 
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${editingCategory.image ? '#16a34a' : '#d1d5db'}`,
                    borderRadius: '12px',
                    padding: editingCategory.image ? '1.5rem' : '2rem',
                    textAlign: 'center',
                    cursor: isUploading ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    background: editingCategory.image ? '#f0fdf4' : '#f9fafb',
                    opacity: isUploading ? 0.7 : 1
                  }}
                >
                  {isUploading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <i className="ri-loader-4-line" style={{ fontSize: '2rem', color: '#16a34a', animation: 'spin 1s linear infinite' }}></i>
                      <p style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>Uploading...</p>
                    </div>
                  ) : editingCategory.image ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <img 
                        src={editingCategory.image} 
                        alt="Preview" 
                        style={{ 
                          width: '80px', 
                          height: '80px', 
                          objectFit: 'cover', 
                          borderRadius: '8px',
                          border: '2px solid #16a34a'
                        }} 
                      />
                      <p style={{ color: '#16a34a', fontSize: '0.875rem', fontWeight: 500, margin: 0 }}>Click to change image</p>
                    </div>
                  ) : (
                    <>
                      <i className="ri-upload-cloud-2-line" style={{ fontSize: '2rem', color: '#16a34a', marginBottom: '0.75rem', display: 'block' }}></i>
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Click to upload image</p>
                      <p style={{ color: '#9ca3af', fontSize: '0.75rem', margin: '0.25rem 0 0 0' }}>PNG, JPG up to 5MB</p>
                    </>
                  )}
                </div>
                
                {/* Help text if no image */}
                {!editingCategory.image && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#fef3c7', borderRadius: '6px', fontSize: '0.75rem', color: '#92400e' }}>
                    <i className="ri-information-line"></i> Note: Image uploads require Cloudinary setup in Settings
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
              <button 
                onClick={handleSaveCategory}
                disabled={isSaving || !editingCategory.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  fontFamily: 'inherit',
                  background: 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#ffffff',
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
                  opacity: isSaving || !editingCategory.name ? 0.7 : 1
                }}
              >
                {isSaving ? 'Saving...' : 'Save Category'}
              </button>
              <button 
                onClick={() => setEditingCategory(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid #d1d5db',
                  fontFamily: 'inherit',
                  background: '#ffffff',
                  color: '#374151'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // CATEGORIES LIST PAGE
  return (
    <div className="p-4 md:p-8 bg-white min-h-[calc(100vh-80px)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Help Banner - Show if no categories */}
      {categories.length === 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <i className="ri-lightbulb-line text-blue-600 text-xl"></i>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 text-sm">Getting Started</h4>
              <p className="text-blue-700 text-xs mt-1">Categories help organize your products. Create your first category to start adding products!</p>
              <p className="text-blue-600 text-xs mt-2">Examples: "Vegetables", "Fruits", "Snacks", "Drinks"</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex items-center justify-end flex-wrap gap-4">
        <button
          onClick={() => openCategoryEdit()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#16a34a] text-white rounded-[5px] text-[13px] font-semibold hover:bg-[#15803d] transition-colors"
        >
          <i className="ri-add-line text-base"></i>
          Add Category
        </button>
      </div>

      {/* Table */}
      <div className="flex flex-col gap-2">
        {/* Header Row */}
        <div className="grid grid-cols-6 bg-[#f1f5f9] border border-[#e2e8f0] rounded-[5px]">
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Category</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Type</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Products</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Created</div>
          <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Status</div>
          <div className="px-4 py-3 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Action</div>
        </div>

        {/* Data Rows */}
        {categories.map((cat) => (
          <div key={cat.id} className="grid grid-cols-6 bg-white rounded-[5px] border border-[#e2e8f0] overflow-hidden hover:border-[#94a3b8] hover:shadow-sm transition-all">
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center gap-3">
              <div style={{
                width: '32px',
                height: '32px',
                background: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: cat.type === 'image' ? 'hidden' : 'visible',
                color: '#6b7280',
                flexShrink: 0
              }}>
                {cat.type === 'icon' ? (
                  <i className={cat.icon}></i>
                ) : (
                  <img src={cat.image} style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} alt={cat.name} />
                )}
              </div>
              <span className="text-[13px] font-semibold text-[#1e293b] truncate">{cat.name}</span>
            </div>
            
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
              <span className="text-[12px] font-medium text-[#475569]">{cat.type === 'icon' ? 'Icon' : 'Image'}</span>
            </div>
            
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
              <span className={`text-[12px] font-medium ${cat.items > 0 ? 'text-[#16a34a]' : 'text-[#94a3b8]'}`}>
                {cat.items} {cat.items === 1 ? 'item' : 'items'}
              </span>
            </div>
            
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
              <span className="text-[12px] text-[#6b7280]">{cat.created}</span>
            </div>
            
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
              <span className={`text-[11px] font-semibold ${cat.status === 'Active' ? 'text-[#16a34a]' : 'text-[#ef4444]'}`}>
                {cat.status === 'Active' ? 'Active' : 'Hidden'}
              </span>
            </div>
            
            <div className="px-4 py-3 flex items-center justify-center gap-1">
              <button 
                onClick={() => openCategoryEdit(cat)} 
                className="px-3 py-1.5 text-[11px] font-medium text-[#475569] bg-[#f1f5f9] rounded-md hover:bg-[#e2e8f0] hover:text-[#1e293b] transition-colors"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDeleteCategory(cat.id)} 
                className="px-3 py-1.5 text-[11px] font-medium text-[#ef4444] bg-[#fef2f2] rounded-md hover:bg-[#fee2e2] transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        
        {categories.length === 0 && (
          <div className="bg-white rounded-[5px] border border-[#e2e8f0] p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="ri-folder-add-line text-2xl text-gray-400"></i>
            </div>
            <p className="text-[#374151] font-medium mb-1">No categories yet</p>
            <p className="text-[#94a3b8] text-sm mb-4">Click "Add Category" to create your first category</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoriesView
