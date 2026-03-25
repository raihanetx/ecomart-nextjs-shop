'use client'

import React from 'react'
import type { Coupon } from '@/types'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { useCsrfFetch } from '@/hooks/useCsrfFetch'

export function CouponsView() {
  const { csrfFetch } = useCsrfFetch()
  
  const {
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
    showToastMsg,
    refetchCoupons,
  } = useAdmin()

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

  const handleSaveCoupon = async () => {
    if (!couponForm.code.trim()) { showToastMsg('Please enter a coupon code.'); return }
    if (!couponForm.value.trim()) { showToastMsg('Please enter a discount value.'); return }

    const couponData = {
      code: couponForm.code.toUpperCase(),
      type: couponForm.type,
      value: parseFloat(couponForm.value),
      scope: couponForm.scope,
      expiry: couponForm.expiry || null,
      selectedProducts: couponForm.scope === 'products' ? pickedProducts : undefined,
      selectedCategories: couponForm.scope === 'categories' ? pickedCategories : undefined,
    }

    try {
      if (editingCoupon?.id) {
        // Update existing coupon
        const response = await csrfFetch('/api/coupons', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCoupon.id, ...couponData }),
        })
        const result = await response.json()
        if (result.success) {
          showToastMsg('Coupon updated!')
          await refetchCoupons()
        } else {
          showToastMsg(result.error || 'Failed to update coupon')
        }
      } else {
        // Create new coupon
        const response = await csrfFetch('/api/coupons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(couponData),
        })
        const result = await response.json()
        if (result.success) {
          showToastMsg('Coupon added!')
          await refetchCoupons()
        } else {
          showToastMsg(result.error || 'Failed to create coupon')
        }
      }
    } catch (error) {
      showToastMsg('Error saving coupon')
    }
    
    setEditingCoupon(null)
  }

  const deleteCoupon = async (id: string) => {
    try {
      const response = await csrfFetch(`/api/coupons?id=${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (result.success) {
        setCoupons(coupons.filter(c => c.id !== id))
        showToastMsg('Coupon deleted!')
      } else {
        showToastMsg('Failed to delete coupon')
      }
    } catch (error) {
      showToastMsg('Error deleting coupon')
    }
  }

  const toggleProductPick = (id: number) => {
    if (pickedProducts.includes(id)) {
      setPickedProducts(pickedProducts.filter(p => p !== id))
    } else {
      setPickedProducts([...pickedProducts, id])
    }
  }

  const toggleCategoryPick = (name: string) => {
    if (pickedCategories.includes(name)) {
      setPickedCategories(pickedCategories.filter(c => c !== name))
    } else {
      setPickedCategories([...pickedCategories, name])
    }
  }

  const formatExpiry = (expiry: string) => {
    if (!expiry) return '[Not Applied]'
    const d = new Date(expiry + 'T00:00:00')
    return `[${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}]`
  }

  return (
    <div className="p-4 md:p-8" style={{fontFamily: "'IBM Plex Sans', sans-serif", backgroundColor: '#ffffff', color: '#1e293b', margin: '0', minHeight: 'calc(100vh - 80px)'}}>
      {editingCoupon ? (
        <div className="max-w-[560px] mx-auto px-6">
          {/* Back Header */}
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setEditingCoupon(null)} className="bg-none border-none cursor-pointer p-0 flex items-center">
              <i className="ri-arrow-left-line text-xl text-[#64748b]"></i>
            </button>
            <div>
              <div className="text-lg font-bold font-sans">{editingCoupon.id ? 'Edit Coupon' : 'Add Coupon'}</div>
              <div className="text-xs text-[#94a3b8] mt-0.5">Configure your discount coupon</div>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveCoupon(); }}>
            {/* Coupon Details Card */}
            <div className="bg-white border border-[#e2e8e0] rounded-xl p-6 mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-4">Coupon Details</div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-[#64748b] mb-1.5">Coupon Code</label>
                <input type="text" 
                  className="w-full px-3.5 py-2.5 bg-white border border-[#e2e8e0] rounded-lg text-sm outline-none focus:border-[#16a34a] transition-colors"
                  style={{textTransform: 'uppercase', letterSpacing: '0.6px'}}
                  placeholder="SUMMER20"
                  value={couponForm.code}
                  onChange={(e) => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1.5">Coupon Type</label>
                  <div className="relative">
                    <select 
                      className="w-full px-3.5 py-2.5 bg-white border border-[#e2e8e0] rounded-lg text-sm outline-none appearance-none cursor-pointer focus:border-[#16a34a] transition-colors"
                      value={couponForm.type}
                      onChange={(e) => setCouponForm({...couponForm, type: e.target.value as 'pct' | 'fixed'})}>
                      <option value="pct">% Percentage Off</option>
                      <option value="fixed">$ Fixed Amount Off</option>
                    </select>
                    <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"></i>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1.5">
                    {couponForm.type === 'pct' ? 'Discount Percentage' : 'Discount Amount'}
                  </label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm ${couponForm.type === 'pct' ? 'text-[#d97706]' : 'text-[#16a34a]'}`}>
                      {couponForm.type === 'pct' ? '%' : '$'}
                    </span>
                    <input type="number" 
                      className="w-full px-3.5 py-2.5 pl-7 bg-white border border-[#e2e8e0] rounded-lg text-sm outline-none focus:border-[#16a34a] transition-colors"
                      placeholder={couponForm.type === 'pct' ? '20' : '15'}
                      value={couponForm.value}
                      onChange={(e) => setCouponForm({...couponForm, value: e.target.value})}
                      min="1" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748b] mb-1.5">
                  Expiry Date <span className="text-[#cbd5e1] text-[11px] font-normal ml-1">(optional)</span>
                </label>
                <input type="date" 
                  className="w-full px-3.5 py-2.5 bg-white border border-[#e2e8e0] rounded-lg text-sm outline-none focus:border-[#16a34a] transition-colors"
                  value={couponForm.expiry}
                  onChange={(e) => setCouponForm({...couponForm, expiry: e.target.value})} />
              </div>
            </div>

            {/* Applies To Card */}
            <div className="bg-white border border-[#e2e8e0] rounded-xl p-6 mb-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-4">Applies To</div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-[#64748b] mb-1.5">Scope</label>
                <div className="relative">
                  <select 
                    className="w-full px-3.5 py-2.5 bg-white border border-[#e2e8e0] rounded-lg text-sm outline-none appearance-none cursor-pointer focus:border-[#16a34a] transition-colors"
                    value={couponForm.scope}
                    onChange={(e) => setCouponForm({...couponForm, scope: e.target.value as 'all' | 'products' | 'categories'})}>
                    <option value="all">All Products</option>
                    <option value="products">Specific Products</option>
                    <option value="categories">Specific Categories</option>
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"></i>
                </div>
              </div>

              {/* Product Picker */}
              {couponForm.scope === 'products' && (
                <div className="pt-4 border-t border-[#f1f5f9]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-3">Select Products</div>
                  <div className="grid grid-cols-2 gap-2">
                    {couponProducts.map(p => (
                      <div key={p.id} 
                        className={`flex items-center gap-2.5 p-2.5 border-[1.5px] rounded-lg cursor-pointer transition-all ${pickedProducts.includes(p.id) ? 'border-[#16a34a] bg-[#f0fdf4]' : 'border-[#e2e8e0] bg-white hover:border-[#94a3b8]'}`}
                        onClick={() => toggleProductPick(p.id)}>
                        <img src={p.img} alt={p.name} className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{p.name}</div>
                          <div className="text-[11px] text-[#16a34a] font-semibold">{p.price}</div>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${pickedProducts.includes(p.id) ? 'bg-[#16a34a] border-[#16a34a]' : 'border-[1.5px] border-[#cbd5e1]'}`}>
                          {pickedProducts.includes(p.id) && <span className="text-white text-[10px]">✓</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Category Picker */}
              {couponForm.scope === 'categories' && (
                <div className="pt-4 border-t border-[#f1f5f9]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-3">Select Categories</div>
                  <div className="flex flex-wrap gap-2">
                    {couponCategories.map(cat => (
                      <div key={cat.name}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 border-[1.5px] rounded-lg cursor-pointer text-xs font-medium transition-all ${pickedCategories.includes(cat.name) ? 'border-[#16a34a] bg-[#f0fdf4]' : 'border-[#e2e8e0] bg-white hover:border-[#94a3b8]'}`}
                        onClick={() => toggleCategoryPick(cat.name)}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background: cat.color}}></span>
                        <span className={pickedCategories.includes(cat.name) ? 'text-[#16a34a]' : ''}>{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3 mt-1">
              <button type="button" onClick={() => setEditingCoupon(null)} className="flex-1 py-3 bg-white text-[#64748b] border-[1.5px] border-[#e2e8e0] rounded-lg text-sm font-medium hover:bg-[#f8faf8] transition-all">Cancel</button>
              <button type="submit" className="flex-1 py-3 bg-[#16a34a] text-white border-none rounded-lg text-sm font-semibold hover:bg-[#15803d] transition-all">Save Coupon</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="max-w-full px-0">
          {/* Action Buttons */}
          <div className="mb-6 flex items-center justify-end flex-wrap gap-4">
            <button onClick={() => openCouponEdit()} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#16a34a] text-white rounded-[5px] text-[13px] font-semibold hover:bg-[#15803d] transition-colors">
              <i className="ri-add-line text-base"></i>
              Add Coupon
            </button>
          </div>

          {/* Table */}
          <div className="flex flex-col gap-2">
            {/* Header Row */}
            <div className="grid grid-cols-6 bg-[#f1f5f9] border border-[#e2e8f0] rounded-[5px]">
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Code</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Type</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Discount</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Applies To</div>
              <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Expiry</div>
              <div className="px-4 py-3 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Action</div>
            </div>

            {/* Data Rows */}
            {coupons.map((coupon) => (
              <div key={coupon.id} className="grid grid-cols-6 bg-white rounded-[5px] border border-[#e2e8f0] overflow-hidden hover:border-[#94a3b8] hover:shadow-sm transition-all">
                {/* Code */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center">
                  <span className="text-[13px] font-semibold text-[#1e293b] truncate">{coupon.code}</span>
                </div>
                
                {/* Type */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className="text-[12px] font-medium text-[#475569]">
                    {coupon.type === 'pct' ? 'Percentage' : 'Fixed'}
                  </span>
                </div>
                
                {/* Discount */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className="text-[12px] font-medium text-[#475569]">
                    {coupon.type === 'pct' ? `${coupon.value}% Off` : `TK ${coupon.value} Off`}
                  </span>
                </div>
                
                {/* Applies To */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className="text-[12px] font-medium text-[#475569]">
                    {coupon.scope === 'all' ? 'All Products' : coupon.scope === 'products' ? 'Specific Products' : 'Specific Categories'}
                  </span>
                </div>
                
                {/* Expiry */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className="text-[12px] text-[#6b7280]">{formatExpiry(coupon.expiry)}</span>
                </div>
                
                {/* Action - text buttons like ProductsView */}
                <div className="px-4 py-3 flex items-center justify-center gap-1">
                  <button 
                    onClick={() => openCouponEdit(coupon)} 
                    className="px-3 py-1.5 text-[11px] font-medium text-[#475569] bg-[#f1f5f9] rounded-md hover:bg-[#e2e8f0] hover:text-[#1e293b] transition-colors"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => deleteCoupon(coupon.id)} 
                    className="px-3 py-1.5 text-[11px] font-medium text-[#ef4444] bg-[#fef2f2] rounded-md hover:bg-[#fee2e2] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            
            {coupons.length === 0 && (
              <div className="bg-white rounded-[5px] border border-[#e2e8f0] p-12 text-center">
                <p className="text-[#94a3b8] text-sm">No coupons found. Click "Add Coupon" to create one.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CouponsView
