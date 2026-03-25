'use client'

import React, { useState, useMemo } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'

type StockFilter = 'all' | 'low' | 'medium' | 'settings'

const InventoryView: React.FC = () => {
  const { 
    inventory, 
    setInventory, 
    editingInventoryItem, 
    setEditingInventoryItem,
    showToastMsg,
    refetchInventory,
    settings,
    setSettings
  } = useAdmin()

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingStock, setSavingStock] = useState(false)

  // Get percentage thresholds from settings (default: low=25%, medium=50%)
  const lowPercent = settings.stockLowPercent ?? 25
  const mediumPercent = settings.stockMediumPercent ?? 50

  // Update threshold values
  const [tempLowPercent, setTempLowPercent] = useState(lowPercent)
  const [tempMediumPercent, setTempMediumPercent] = useState(mediumPercent)

  // Get stock level percentage for a product
  const getStockLevel = (variants: { stock: number; initialStock: number }[]): 'low' | 'medium' | 'high' => {
    const totalStock = variants.reduce((acc, v) => acc + v.stock, 0)
    const totalInitial = variants.reduce((acc, v) => acc + (v.initialStock || v.stock), 0)
    
    if (totalInitial === 0) return 'high'
    
    const percentRemaining = (totalStock / totalInitial) * 100
    
    if (percentRemaining <= lowPercent) return 'low'
    if (percentRemaining <= mediumPercent) return 'medium'
    return 'high'
  }

  // Filter inventory based on stock level
  const filteredInventory = useMemo(() => {
    if (stockFilter === 'all') return inventory
    if (stockFilter === 'settings') return []
    return inventory.filter(item => getStockLevel(item.variants) === stockFilter)
  }, [inventory, stockFilter, lowPercent, mediumPercent])

  // Count by stock level
  const stockCounts = useMemo(() => ({
    all: inventory.length,
    low: inventory.filter(i => getStockLevel(i.variants) === 'low').length,
    medium: inventory.filter(i => getStockLevel(i.variants) === 'medium').length,
  }), [inventory, lowPercent, mediumPercent])

  const handleDeleteInventory = async (item: { id: number; name: string }) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"? This will also delete all its variants.`)) {
      return
    }
    
    setDeletingId(item.id)
    try {
      const response = await fetch(`/api/products?id=${item.id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setInventory(inventory.filter(i => i.id !== item.id))
        showToastMsg('Product deleted successfully!')
      } else {
        showToastMsg('Failed to delete product')
      }
    } catch (error) {
      showToastMsg('Failed to delete product')
    } finally {
      setDeletingId(null)
    }
  }

  const saveInventorySettings = async () => {
    setSavingSettings(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          stockLowPercent: tempLowPercent,
          stockMediumPercent: tempMediumPercent,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setSettings({ 
          ...settings, 
          stockLowPercent: tempLowPercent, 
          stockMediumPercent: tempMediumPercent 
        })
        showToastMsg('Settings saved!')
      } else {
        showToastMsg('Failed to save settings')
      }
    } catch (error) {
      showToastMsg('Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="p-4 md:p-8 bg-white min-h-[calc(100vh-80px)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setStockFilter('all')}
          className={`px-4 py-2 text-sm font-medium transition-all border ${
            stockFilter === 'all' 
              ? 'border-[#1e293b] text-[#1e293b] bg-[#1e293b]/5' 
              : 'border-gray-300 text-gray-600 hover:border-gray-400'
          }`}
          style={{ borderRadius: '5px' }}
        >
          All ({stockCounts.all})
        </button>
        <button
          onClick={() => setStockFilter('low')}
          className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 border ${
            stockFilter === 'low' 
              ? 'border-red-500 text-red-600 bg-red-50' 
              : 'border-red-300 text-red-500 hover:border-red-400'
          }`}
          style={{ borderRadius: '5px' }}
        >
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          Low ({stockCounts.low})
        </button>
        <button
          onClick={() => setStockFilter('medium')}
          className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 border ${
            stockFilter === 'medium' 
              ? 'border-amber-500 text-amber-600 bg-amber-50' 
              : 'border-amber-300 text-amber-500 hover:border-amber-400'
          }`}
          style={{ borderRadius: '5px' }}
        >
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          Medium ({stockCounts.medium})
        </button>
        <button
          onClick={() => setStockFilter('settings')}
          className={`px-4 py-2 text-sm font-medium transition-all flex items-center gap-2 border ${
            stockFilter === 'settings' 
              ? 'border-[#16a34a] text-[#16a34a] bg-green-50' 
              : 'border-gray-300 text-gray-600 hover:border-gray-400'
          }`}
          style={{ borderRadius: '5px' }}
        >
          <i className="ri-settings-3-line text-sm"></i>
          Settings
        </button>
      </div>

      {/* Settings Panel */}
      {stockFilter === 'settings' && (
        <div className="border border-[#e2e8f0] p-6 mb-4" style={{ borderRadius: '5px' }}>
          <h3 className="text-sm font-semibold text-[#1e293b] mb-1">Stock Level Thresholds</h3>
          <p className="text-xs text-[#64748b] mb-6">Set when stock levels are considered low or medium based on remaining percentage</p>
          
          <div className="grid grid-cols-2 gap-8 max-w-md">
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Low Stock
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tempLowPercent}
                  onChange={(e) => setTempLowPercent(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 border border-[#e2e8f0] text-sm outline-none focus:border-[#16a34a]"
                  style={{ borderRadius: '5px' }}
                  min="0"
                  max="100"
                />
                <span className="text-sm text-[#64748b]">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Medium Stock
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tempMediumPercent}
                  onChange={(e) => setTempMediumPercent(parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 border border-[#e2e8f0] text-sm outline-none focus:border-[#16a34a]"
                  style={{ borderRadius: '5px' }}
                  min="0"
                  max="100"
                />
                <span className="text-sm text-[#64748b]">%</span>
              </div>
            </div>
          </div>

          <button
            onClick={saveInventorySettings}
            disabled={savingSettings}
            className="mt-6 px-4 py-2 bg-[#16a34a] text-white text-sm font-medium hover:bg-[#15803d] transition-colors disabled:bg-[#cbd5e1]"
            style={{ borderRadius: '5px' }}
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Inventory Table */}
      {stockFilter !== 'settings' && (
        <div className="flex flex-col gap-2">
          {/* Header Row */}
          <div className="grid grid-cols-[1.3fr_2fr_0.7fr_0.7fr] bg-[#f1f5f9] border border-[#e2e8f0] rounded-[5px]">
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Product</div>
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Varieties</div>
            <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Last Edited</div>
            <div className="px-4 py-3 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-[#475569]">Action</div>
          </div>

          {/* Data Rows */}
          {filteredInventory.map((item) => {
            return (
              <div
                key={item.id}
                className="grid grid-cols-[1.3fr_2fr_0.7fr_0.7fr] bg-white rounded-[5px] border border-[#e2e8f0] overflow-hidden hover:border-[#94a3b8] hover:shadow-sm transition-all"
              >
                {/* Product - Compact */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center gap-3">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-10 h-10 rounded-[5px] object-cover flex-shrink-0 border border-[#d1d5db]" 
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1e293b] truncate">{item.name}</p>
                    <p className="text-[11px] text-[#94a3b8] truncate">{item.category}</p>
                  </div>
                </div>
                
                {/* Varieties - No background, plain text */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center">
                  <div className="flex flex-wrap items-center gap-3">
                    {item.variants.length > 0 ? (
                      item.variants.map((v, idx) => {
                        const initialStock = v.initialStock || v.stock
                        
                        return (
                          <span 
                            key={idx}
                            className="text-sm text-slate-600"
                          >
                            {v.name} ({v.stock}/{initialStock})
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-sm text-slate-400">No variants</span>
                    )}
                  </div>
                </div>
                
                {/* Last Edited */}
                <div className="px-4 py-3 border-r border-[#e2e8f0] flex items-center justify-center">
                  <span className="text-sm text-slate-500">{item.lastEdited}</span>
                </div>
                
                {/* Action */}
                <div className="px-4 py-3 flex items-center justify-center gap-1">
                  <button 
                    onClick={() => setEditingInventoryItem(item)} 
                    className="px-3 py-1.5 text-[11px] font-medium text-[#475569] bg-[#f1f5f9] rounded-md hover:bg-[#e2e8f0] hover:text-[#1e293b] transition-colors"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteInventory(item)} 
                    disabled={deletingId === item.id}
                    className="px-3 py-1.5 text-[11px] font-medium text-[#ef4444] bg-[#fef2f2] rounded-md hover:bg-[#fee2e2] transition-colors disabled:opacity-50"
                  >
                    {deletingId === item.id ? '...' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
          
          {filteredInventory.length === 0 && (
            <div className="bg-white rounded-[5px] border border-[#e2e8f0] p-12 text-center">
              <p className="text-slate-400 text-sm">No products found for this filter.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Inventory Edit Modal - Simple */}
      {editingInventoryItem && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingInventoryItem(null)}></div>
          <div className="relative bg-white w-full max-w-md p-6" style={{ borderRadius: '5px' }}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <h3 className="text-base font-semibold text-slate-800">Edit Stock</h3>
              <button onClick={() => setEditingInventoryItem(null)} className="text-slate-400 hover:text-slate-600">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>
            
            <div className="space-y-3">
              {editingInventoryItem.variants.map((variant, idx) => {
                const sold = (variant.initialStock || variant.stock) - variant.stock
                return (
                  <div key={idx} className="py-3 border-b border-slate-100 last:border-0">
                    {/* Variety Name */}
                    <div className="text-sm font-medium text-slate-700 mb-2">{variant.name}</div>
                    
                    {/* Stock and Sold in one line */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">
                        Stock: {variant.stock} | Sold: {sold}
                      </span>
                      
                      {/* Edit Stock Input */}
                      <input 
                        type="number"
                        value={variant.stock}
                        min="0"
                        onChange={(e) => {
                          const newVariants = [...editingInventoryItem.variants];
                          // FIX: Prevent negative stock values
                          const newStock = Math.max(0, parseInt(e.target.value) || 0);
                          newVariants[idx].stock = newStock;
                          setEditingInventoryItem({...editingInventoryItem, variants: newVariants});
                        }}
                        className="w-16 px-2 py-1 border border-slate-200 text-center text-sm focus:outline-none focus:border-slate-400"
                        style={{ borderRadius: '3px' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            
            <div className="flex gap-2 mt-5">
              <button 
                onClick={() => setEditingInventoryItem(null)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                style={{ borderRadius: '5px' }}
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (savingStock) return
                  setSavingStock(true)
                  try {
                    // FIX: Use Promise.all for parallel execution instead of sequential
                    const updatePromises = editingInventoryItem.variants
                      .filter(variant => variant.id)
                      .map(variant => 
                        fetch('/api/inventory', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            variantId: variant.id,
                            stock: Math.max(0, variant.stock) // Ensure non-negative
                          })
                        })
                      )
                    
                    await Promise.all(updatePromises)
                    refetchInventory()
                    setEditingInventoryItem(null)
                    showToastMsg('Stock updated!')
                  } catch (error) {
                    showToastMsg('Failed to update stock')
                  } finally {
                    setSavingStock(false)
                  }
                }}
                disabled={savingStock}
                className="flex-1 px-4 py-2 bg-slate-800 text-white text-sm hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: '5px' }}
              >
                {savingStock ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default InventoryView
