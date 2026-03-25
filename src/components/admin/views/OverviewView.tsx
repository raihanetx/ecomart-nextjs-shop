'use client'

import React, { useState, useEffect } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { AlertCircle } from 'lucide-react'
import GettingStarted from '@/components/admin/components/GettingStarted'

interface OverviewViewProps {
  setDashView: (view: string) => void
}

interface DashboardData {
  totalRevenue: number
  totalOrders: number
  pendingOrders: number
  canceledOrders: number
  abandonedCartValue: number
  // Visitor metrics
  totalVisits: number
  uniqueVisitors: number
  returningVisitors: number
  newVisitors: number
  // Customer metrics
  totalCustomers: number
  newCustomers: number
  repeatCustomers: number
  // Product analytics
  totalProductViews: number
  uniqueProductsViewed: number
  totalCartAdds: number
  avgOrderValue: number
  conversionRate: string
  revPerVisitor: string
  topSellingProducts: Array<{ name: string; sales: number; revenue: number; category: string }>
  mostViewedProducts: Array<{ name: string; category: string; views: number }>
  topCustomers: Array<{ name: string; phone: string; totalSpent: number; orderCount: number }>
  dailyStats: Array<{ date: string; sales: number; revenue: number; orders: number; visitors: number; productViews?: number }>
  deviceStats: {
    mobile: number
    desktop: number
    tablet: number
    ios: number
    android: number
    chrome: number
    safari: number
    other: number
    total: number
  }
  sessionAnalytics?: {
    avgSessionDuration: string
    avgSessionSeconds: number
    bounceRate: number
    totalSessions: number
    bouncedSessions: number
  }
  cartActionsPerProduct?: Array<{ productName: string; cartAdds: number; cartRemoves: number }>
  timeFrame: string
  days: number
}

type Period = 'Today' | '7D' | '15D' | '30D' | '6M' | '1Y'

export const OverviewView: React.FC<OverviewViewProps> = ({ setDashView }) => {
  const { showToastMsg, categories, products, settings } = useAdmin()
  const [period, setPeriod] = useState<Period>('30D')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  
  // Check if this is a new shop (needs setup guidance)
  const hasCategories = categories.length > 0
  const hasProducts = products.length > 0
  const hasCredentials = !!(settings.cloudinaryCloudName && (settings.hasCloudinaryApiSecret || settings.cloudinaryApiSecret))
  const isNewShop = !hasCategories || !hasProducts

  // Fetch dashboard data from API
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const timeFrameMap: Record<Period, string> = {
          'Today': 'today',
          '7D': '7d',
          '15D': '15d',
          '30D': '30d',
          '6M': '6m',
          '1Y': '1y'
        }
        const response = await fetch(`/api/dashboard?timeFrame=${timeFrameMap[period]}`)
        const result = await response.json()
        
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error || 'Failed to load data')
        }
      } catch (err) {
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period])

  // Build active data based on period and API data
  const getActiveData = () => {
    if (!data) {
      return {
        revenue: '0',
        confirmed: 0,
        canceled: 0,
        aov: 0,
        abandonedCartValue: 0,
        visits: 0,
        unique: 0,
        newVisitors: 0,
        returning: 0,
        conv: 0,
        bounce: 0,
        duration: 'N/A',
        friction: 0,
        meta: { desktop: 0, mobile: 0, android: 0, ios: 0 },
        productsSold: [] as Array<{ name: string; s: number; v: number; c: number; buyerType: string }>,
        productsVisited: [] as Array<{ name: string; v: number; s: number; c: number; dropOff: number }>,
        productsCarted: [] as Array<{ name: string; c: number; v: number; s: number; stuck: number }>
      }
    }

    // ============================================
    // VISITOR METRICS (REAL DATA from API)
    // ============================================
    const totalVisits = data.totalVisits || 0
    const uniqueVisitors = data.uniqueVisitors || 0
    const returningVisitors = data.returningVisitors || 0
    const newVisitors = data.newVisitors || 0
    
    // ============================================
    // SESSION ANALYTICS (REAL DATA from session_analytics table)
    // ============================================
    const bounceRate = data.sessionAnalytics?.bounceRate ?? 0
    const sessionDuration = data.sessionAnalytics?.avgSessionDuration ?? 'N/A'
    
    // ============================================
    // CALCULATED METRICS
    // ============================================
    const conversionRate = parseFloat(data.conversionRate) || 0
    const friction = data.totalOrders > 0 
      ? parseFloat((data.totalVisits / data.totalOrders).toFixed(1)) 
      : 0
    const abandonedCartValue = data.abandonedCartValue || 0

    // ============================================
    // DEVICE STATS (REAL DATA from visitorSessions table)
    // ============================================
    const deviceTotal = data.deviceStats.total || 1
    const meta = {
      desktop: data.deviceStats.total > 0 ? Math.round((data.deviceStats.desktop / deviceTotal) * 100) : 0,
      mobile: data.deviceStats.total > 0 ? Math.round((data.deviceStats.mobile / deviceTotal) * 100) : 0,
      android: data.deviceStats.total > 0 ? Math.round((data.deviceStats.android / deviceTotal) * 100) : 0,
      ios: data.deviceStats.total > 0 ? Math.round((data.deviceStats.ios / deviceTotal) * 100) : 0
    }

    // ============================================
    // CART ACTIONS PER PRODUCT (REAL DATA)
    // ============================================
    const cartActionsMap: Record<string, number> = {}
    if (data.cartActionsPerProduct) {
      for (const cap of data.cartActionsPerProduct) {
        cartActionsMap[cap.productName] = cap.cartAdds
      }
    }

    // ============================================
    // PRODUCT VIEWS MAP (REAL DATA)
    // ============================================
    const viewCountMap: Record<string, number> = {}
    for (const p of data.mostViewedProducts) {
      viewCountMap[p.name] = p.views
    }
    
    // ============================================
    // BUYER TYPE RATIO (REAL DATA from customer data)
    // ============================================
    const repeatRatio = data.totalCustomers > 0 ? Math.round((data.repeatCustomers / data.totalCustomers) * 100) : 0
    const newRatio = 100 - repeatRatio

    // ============================================
    // PRODUCTS SOLD (REAL DATA)
    // ============================================
    const salesCountMap: Record<string, number> = {}
    for (const p of data.topSellingProducts) {
      salesCountMap[p.name] = p.sales
    }

    const productsSold = data.topSellingProducts.slice(0, 5).map(p => ({
      name: p.name,
      s: p.sales,
      v: viewCountMap[p.name] || 0,
      c: cartActionsMap[p.name] || 0,
      buyerType: `Repeat: ${repeatRatio}% / New: ${newRatio}%`
    }))

    const productsVisited = data.mostViewedProducts.slice(0, 5).map(p => ({
      name: p.name,
      v: p.views,
      s: salesCountMap[p.name] || 0,
      c: cartActionsMap[p.name] || 0,
      dropOff: p.views > 0 ? Math.round(100 - ((salesCountMap[p.name] || 0) / p.views) * 100) : 100
    }))

    const productsCarted = data.topSellingProducts.slice(0, 5).map(p => ({
      name: p.name,
      c: cartActionsMap[p.name] || 0,
      v: viewCountMap[p.name] || 0,
      s: p.sales,
      stuck: cartActionsMap[p.name] ? Math.round(cartActionsMap[p.name] * p.revenue / p.sales) : 0
    }))

    return {
      revenue: data.totalRevenue.toLocaleString(),
      confirmed: data.totalOrders,
      canceled: data.canceledOrders,
      aov: data.avgOrderValue,
      abandonedCartValue: abandonedCartValue,
      visits: totalVisits,
      unique: uniqueVisitors,
      newVisitors: newVisitors,
      returning: returningVisitors,
      conv: conversionRate,
      bounce: Math.round(bounceRate),
      duration: sessionDuration,
      friction: friction,
      meta,
      productsSold,
      productsVisited,
      productsCarted
    }
  }

  const active = getActiveData()

  const handleDownload = () => {
    if (!data || !data.dailyStats) return
    
    const headers = ['Date', 'Sales', 'Revenue', 'Orders', 'Visitors']
    const csvContent = [
      headers.join(','),
      ...data.dailyStats.map(row => [row.date, row.sales, row.revenue, row.orders, row.visitors].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `krishibitan_report_${period}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToastMsg('Report downloaded!')
  }

  // Format number with commas
  const formatNum = (num: number) => num.toLocaleString()

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center p-6">
          <AlertCircle size={48} className="text-red-500" />
          <p className="text-gray-700 font-medium">Failed to load analytics</p>
          <p className="text-gray-500 text-sm">{error}</p>
          <button 
            onClick={() => setPeriod(period)}
            className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            style={{ borderRadius: '5px' }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 bg-white min-h-[calc(100vh-80px)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Embedded CSS */}
      <style jsx>{`
        .ledger-container { 
          background: white; 
          border: 1px solid #d1d5db; 
          border-radius: 5px; 
          overflow: hidden; 
          margin-bottom: 30px; 
          width: 100%; 
        }
        .ledger-table { 
          width: 100%; 
          border-collapse: collapse; 
          text-align: left; 
          table-layout: fixed; 
        }
        .ledger-table thead { 
          background-color: #f3f4f6; 
          border-bottom: 1px solid #d1d5db; 
        }
        .ledger-table th { 
          padding: 12px 16px; 
          font-size: 11px; 
          text-transform: uppercase; 
          color: #4b5563; 
          font-weight: 800; 
          border-right: 1px solid #e5e7eb; 
        }
        .ledger-table td { 
          padding: 14px 16px; 
          font-size: 13px; 
          border-bottom: 1px solid #f3f4f6; 
          border-right: 1px solid #e5e7eb; 
          vertical-align: middle; 
        }
        .ledger-table th:last-child, .ledger-table td:last-child { 
          border-right: none; 
        }
        .ledger-table tr:last-child td { 
          border-bottom: none; 
        }
      `}</style>
      
      <div className="max-w-[1600px] mx-auto">
        {/* Getting Started Checklist - Shows for new shops */}
        {isNewShop && (
          <GettingStarted 
            hasCategories={hasCategories}
            hasProducts={hasProducts}
            hasCredentials={hasCredentials}
            onClose={() => {}}
          />
        )}
        
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['Today', '7D', '15D', '30D', '6M', '1Y'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium transition-all border ${
                period === p
                  ? 'border-[#1e293b] text-[#1e293b] bg-[#1e293b]/5'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
              style={{ borderRadius: '5px' }}
            >
              {p}
            </button>
          ))}
          <button 
            onClick={handleDownload}
            className="px-4 py-2 text-sm font-medium transition-all border border-gray-300 text-gray-600 hover:border-gray-400"
            style={{ borderRadius: '5px' }}
          >
            <i className="fa-solid fa-download mr-2"></i>
            Export
          </button>
        </div>

        {/* 01. REVENUE & ORDERS */}
        <div className="mb-2">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">01. Order & Revenue Logistics</h3>
        </div>
        <div className="ledger-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th className="w-1/5">Total Gross Revenue</th>
                <th className="w-1/5">Confirmed Orders</th>
                <th className="w-1/5">Canceled Units</th>
                <th className="w-1/5">Avg. Order Value (AOV)</th>
                <th className="w-1/5 text-right">Abandoned Cart Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold text-gray-900">
                <td className="text-xl font-black text-emerald-600">TK {active.revenue}</td>
                <td>{active.confirmed}</td>
                <td className="text-red-500">{active.canceled}</td>
                <td className="text-blue-600">TK {formatNum(active.aov)}</td>
                <td className="text-right text-orange-600 font-black">TK {formatNum(active.abandonedCartValue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 02. VISITOR BEHAVIOR */}
        <div className="mb-2">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">02. Visitor Intelligence & Behavior</h3>
        </div>
        <div className="ledger-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th className="w-[14.2%]">Total Visitors</th>
                <th className="w-[14.2%]">New Visitors</th>
                <th className="w-[14.2%]">Repeat Visitors</th>
                <th className="w-[14.2%]">Conv. Rate (CR%)</th>
                <th className="w-[14.2%]">Bounce Rate</th>
                <th className="w-[14.2%]">Avg Session Time</th>
                <th className="w-[14.2%] text-right">Visit Friction</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold text-gray-900">
                <td className="text-purple-700">{formatNum(active.unique)}</td>
                <td className="text-emerald-600">{formatNum(active.newVisitors)}</td>
                <td className="text-blue-700">{formatNum(active.returning)}</td>
                <td className="text-emerald-700">{active.conv}%</td>
                <td className="text-red-400">{active.bounce}%</td>
                <td className="text-gray-500">{active.duration}</td>
                <td className="text-right text-orange-600 font-black">{active.friction} Visits/Order</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 03. MOST SELLING */}
        <div className="mb-2">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">03. Top 5 Selling Products (Sales Focus)</h3>
        </div>
        <div className="ledger-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th className="w-1/5">Product Description</th>
                <th className="w-1/5">Units Sold</th>
                <th className="w-1/5">Total Views</th>
                <th className="w-1/5">Add To Cart</th>
                <th className="w-1/5 text-right">Customer Type</th>
              </tr>
            </thead>
            <tbody>
              {active.productsSold.length > 0 ? active.productsSold.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="font-bold text-gray-900 uppercase">{p.name}</td>
                  <td className="font-black text-emerald-600 text-base">{formatNum(p.s)}</td>
                  <td className="text-gray-400">{formatNum(p.v)}</td>
                  <td className="text-gray-400">{formatNum(p.c)}</td>
                  <td className="text-right font-bold text-blue-600">{p.buyerType}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400">No sales data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 04. MOST VISITED */}
        <div className="mb-2">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">04. Top 5 Visited Products (Interest Focus)</h3>
        </div>
        <div className="ledger-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th className="w-1/5">Product Description</th>
                <th className="w-1/5">Total Views</th>
                <th className="w-1/5">Units Sold</th>
                <th className="w-1/5">Add To Cart</th>
                <th className="w-1/5 text-right">Drop-off Rate</th>
              </tr>
            </thead>
            <tbody>
              {active.productsVisited.length > 0 ? active.productsVisited.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="font-bold text-gray-900 uppercase">{p.name}</td>
                  <td className="font-black text-blue-600 text-base">{formatNum(p.v)}</td>
                  <td className="text-gray-400">{formatNum(p.s)}</td>
                  <td className="text-gray-400">{formatNum(p.c)}</td>
                  <td className="text-right font-bold text-red-500">{p.dropOff}%</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400">No visit data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 05. MOST ADDED TO CART */}
        <div className="mb-2">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">05. Top 5 Added To Cart (Intent Focus)</h3>
        </div>
        <div className="ledger-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th className="w-1/5">Product Description</th>
                <th className="w-1/5">Cart Actions</th>
                <th className="w-1/5">Total Views</th>
                <th className="w-1/5">Units Sold</th>
                <th className="w-1/5 text-right">Stuck Revenue</th>
              </tr>
            </thead>
            <tbody>
              {active.productsCarted.length > 0 ? active.productsCarted.map((p, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="font-bold text-gray-900 uppercase">{p.name}</td>
                  <td className="font-black text-orange-500 text-base">{formatNum(p.c)}</td>
                  <td className="text-gray-400">{formatNum(p.v)}</td>
                  <td className="text-gray-400">{formatNum(p.s)}</td>
                  <td className="text-right font-black text-gray-900">TK {formatNum(p.stuck)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400">No cart data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 06. SYSTEM ENVIRONMENT */}
        <div className="mb-2">
          <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">06. System & Device Environment</h3>
        </div>
        <div className="ledger-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th className="w-1/5">Label</th>
                <th className="w-1/5">Android Distribution</th>
                <th className="w-1/5">iOS / iPhone Distribution</th>
                <th className="w-1/5">Desktop Environment</th>
                <th className="w-1/5 text-right">Mobile Environment</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-bold text-gray-900">
                <td className="text-gray-400 uppercase text-[11px]">Usage Share</td>
                <td className="text-emerald-600">{active.meta.android}%</td>
                <td>{active.meta.ios}%</td>
                <td>{active.meta.desktop}%</td>
                <td className="text-right font-black">{active.meta.mobile}%</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}

export default OverviewView
