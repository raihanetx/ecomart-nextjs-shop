'use client'

import { ViewType } from '@/types'
import { useAdmin } from './context/AdminContext'

interface AdminSidebarProps {
  dashView: string
  setDashView: (view: string) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  onAddInventory: () => void
  editingCategory: boolean
  editingProduct: boolean
  editingCoupon: boolean
  setEditingCategory: (cat: null) => void
  setEditingProduct: (prod: null) => void
  setEditingCoupon: (coupon: null) => void
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
  { id: 'orders', label: 'Orders', icon: 'ri-shopping-bag-line' },
  { id: 'products', label: 'Products', icon: 'ri-store-2-line' },
  { id: 'inventory', label: 'Inventory', icon: 'ri-archive-line' },
  { id: 'categories', label: 'Categories', icon: 'ri-folder-line' },
  { id: 'coupons', label: 'Coupons', icon: 'ri-ticket-2-line' },
  { id: 'reviews', label: 'Reviews', icon: 'ri-star-line' },
  { id: 'abandoned', label: 'Abandoned', icon: 'ri-alert-line' },
  { id: 'customers', label: 'Customers', icon: 'ri-user-line' },
]

const configItems = [
  { id: 'credentials', label: 'Credentials', icon: 'ri-shield-keyhole-line' },
  { id: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
  { id: 'backup', label: 'Backup', icon: 'ri-database-2-line' },
]

export default function AdminSidebar({
  dashView,
  setDashView,
  sidebarCollapsed,
  setSidebarCollapsed,
  onAddInventory,
  editingCategory,
  editingProduct,
  editingCoupon,
  setEditingCategory,
  setEditingProduct,
  setEditingCoupon,
}: AdminSidebarProps) {
  const { settings } = useAdmin()
  
  // Use logo from settings (database) or fallback to default
  const logoUrl = settings.logoUrl || 'https://i.postimg.cc/4xZk3k2j/IMG-20260226-120143.png'
  const websiteName = settings.websiteName || 'EcoMart'

  const handleNavClick = (id: string) => {
    setDashView(id)
    setEditingCategory(null)
    setEditingProduct(null)
    setEditingCoupon(null)
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/admin'
    } catch (error) {
    }
  }

  return (
    <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="admin-sidebar-brand">
        <img src={logoUrl} alt="Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
        <h2>{websiteName}</h2>
      </div>
      <button
        className="admin-sidebar-toggle"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <i className="ri-arrow-left-s-line"></i>
      </button>

      <nav className="admin-sidebar-nav">
        <div className="admin-nav-section">
          <div className="admin-nav-section-title">Main Menu</div>
          {navItems.map(item => (
            <div
              key={item.id}
              className={`admin-nav-item ${dashView === item.id && !editingCategory && !editingProduct && !editingCoupon ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              data-tooltip={item.label}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div className="admin-nav-divider"></div>

        <div className="admin-nav-section">
          <div className="admin-nav-section-title">Configuration</div>
          {configItems.map(item => (
            <div
              key={item.id}
              className={`admin-nav-item ${dashView === item.id ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              data-tooltip={item.label}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </nav>

      <div className="admin-sidebar-footer">
        {/* User info & Logout */}
        <div style={{
          padding: '12px',
          marginBottom: '12px',
          background: '#f8fafc',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: '#16a34a',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 600,
            fontSize: '14px',
            flexShrink: 0
          }}>
            A
          </div>
          {!sidebarCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Admin
              </div>
              <div style={{
                fontSize: '11px',
                color: '#64748b'
              }}>
                admin
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              padding: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <i className="ri-logout-box-line" style={{ fontSize: '18px' }}></i>
          </button>
        </div>

        <button className="admin-sidebar-add-btn" onClick={onAddInventory} data-tooltip="Add Inventory">
          <i className="ri-add-line"></i>
          <span>Add Inventory</span>
        </button>
      </div>
    </aside>
  )
}
