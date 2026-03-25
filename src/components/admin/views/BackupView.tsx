'use client'

import React, { useState, useRef } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { useCsrfFetch } from '@/hooks/useCsrfFetch'

const BackupView: React.FC = () => {
  const { csrfFetch } = useCsrfFetch()
  const { showToastMsg } = useAdmin()
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Download backup
  const handleDownloadBackup = async () => {
    setDownloading(true)
    try {
      const response = await csrfFetch('/api/backup')
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Download failed')
      }
      
      // Get the blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')?.split('filename="')[1]?.replace('"', '') || `backup-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      // Update last backup time
      setLastBackup(new Date().toLocaleString())
      showToastMsg('Backup downloaded successfully!')
    } catch (error) {
      showToastMsg(error instanceof Error ? error.message : 'Download failed', 'error')
    } finally {
      setDownloading(false)
    }
  }

  // Upload and restore backup
  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.json')) {
      showToastMsg('Please select a valid backup file (.json)', 'error')
      return
    }

    // Confirm before restore
    const confirmed = window.confirm(
      '⚠️ WARNING: This will replace ALL existing data with the backup data.\n\n' +
      'This action cannot be undone. Are you sure you want to continue?'
    )
    
    if (!confirmed) {
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('backup', file)

      const response = await csrfFetch('/api/restore', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        showToastMsg('Backup restored successfully! Refreshing...')
        // Reload page to reflect changes
        setTimeout(() => window.location.reload(), 1500)
      } else {
        throw new Error(result.error || 'Restore failed')
      }
    } catch (error) {
      showToastMsg(error instanceof Error ? error.message : 'Restore failed', 'error')
    } finally {
      setUploading(false)
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Load sample data
  const handleLoadSampleData = async () => {
    const confirmed = window.confirm(
      '📦 This will add sample products and categories to your store.\n\n' +
      'Existing data will be cleared first. Continue?'
    )
    
    if (!confirmed) return

    setLoading(true)
    try {
      const response = await csrfFetch('/api/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearFirst: true })
      })

      const result = await response.json()

      if (result.success) {
        showToastMsg(`Sample data loaded! ${result.data.products} products, ${result.data.categories} categories`)
        // Reload page to reflect changes
        setTimeout(() => window.location.reload(), 1500)
      } else {
        throw new Error(result.error || 'Failed to load sample data')
      }
    } catch (error) {
      showToastMsg(error instanceof Error ? error.message : 'Failed to load sample data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Clear all data
  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      '🗑️ WARNING: This will permanently delete ALL data!\n\n' +
      'This includes products, categories, orders, customers, and coupons.\n' +
      'This action cannot be undone. Are you absolutely sure?'
    )
    
    if (!confirmed) return

    // Double confirmation
    const doubleConfirmed = window.confirm(
      '⚠️ FINAL WARNING: You are about to delete everything.\n\n' +
      'Type OK to proceed (this is your last chance to cancel).'
    )
    
    if (!doubleConfirmed) return

    setClearing(true)
    try {
      const response = await csrfFetch('/api/seed', { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        showToastMsg('All data cleared successfully! Refreshing...')
        setTimeout(() => window.location.reload(), 1500)
      } else {
        throw new Error(result.error || 'Failed to clear data')
      }
    } catch (error) {
      showToastMsg(error instanceof Error ? error.message : 'Failed to clear data', 'error')
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="p-6 bg-white min-h-[calc(100vh-80px)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        .backup-card {
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          transition: all 0.2s;
        }
        .backup-card:hover {
          border-color: #16a34a;
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.1);
        }
        .backup-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 14px 24px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }
        .backup-btn-primary {
          background: #16a34a;
          color: white;
          border: none;
        }
        .backup-btn-primary:hover:not(:disabled) {
          background: #15803d;
          transform: translateY(-1px);
        }
        .backup-btn-secondary {
          background: white;
          color: #16a34a;
          border: 2px solid #16a34a;
        }
        .backup-btn-secondary:hover:not(:disabled) {
          background: #f0fdf4;
          transform: translateY(-1px);
        }
        .backup-btn-warning {
          background: white;
          color: #dc2626;
          border: 2px solid #dc2626;
        }
        .backup-btn-warning:hover:not(:disabled) {
          background: #fef2f2;
          transform: translateY(-1px);
        }
        .backup-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* Header Info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <i className="ri-information-line text-blue-500 text-xl mt-0.5"></i>
            <div>
              <h4 className="font-semibold text-blue-800 mb-1">About Backup & Restore</h4>
              <p className="text-sm text-blue-700">
                Download a complete backup of your database including products, categories, orders, customers, and settings. 
                Use the restore function to restore data from a previously downloaded backup file.
              </p>
            </div>
          </div>
        </div>

        {/* Section 1: Backup & Restore */}
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <i className="ri-database-2-line text-green-600"></i>
          Database Backup
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Download Backup Card */}
          <div className="backup-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <i className="ri-download-2-line text-green-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Download Backup</h3>
                <p className="text-sm text-slate-500">Export all data as JSON</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Creates a complete backup of your database including products, categories, variants, orders, customers, coupons, and settings.
            </p>

            <button
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="backup-btn backup-btn-primary"
            >
              {downloading ? (
                <>
                  <i className="ri-loader-4-line spinner"></i>
                  <span>Creating Backup...</span>
                </>
              ) : (
                <>
                  <i className="ri-download-2-line"></i>
                  <span>Download Backup</span>
                </>
              )}
            </button>

            {lastBackup && (
              <p className="text-xs text-slate-400 text-center mt-3">
                Last download: {lastBackup}
              </p>
            )}
          </div>

          {/* Restore Backup Card */}
          <div className="backup-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <i className="ri-upload-2-line text-amber-600 text-xl"></i>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Restore Backup</h3>
                <p className="text-sm text-slate-500">Import data from JSON</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Restore your database from a previously downloaded backup file. This will replace all existing data.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleRestoreBackup}
              className="hidden"
              id="backup-file-input"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="backup-btn backup-btn-secondary"
            >
              {uploading ? (
                <>
                  <i className="ri-loader-4-line spinner"></i>
                  <span>Restoring...</span>
                </>
              ) : (
                <>
                  <i className="ri-upload-2-line"></i>
                  <span>Select Backup File</span>
                </>
              )}
            </button>

            <p className="text-xs text-amber-600 text-center mt-3">
              <i className="ri-alert-line mr-1"></i>
              Warning: This will replace all existing data
            </p>
          </div>
        </div>

        {/* Section 2: Sample Data */}
        <div className="border-t border-slate-200 pt-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <i className="ri-seedling-line text-green-600"></i>
            Sample Data
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Load demo products and categories to see how your store looks. Great for testing or as a starting point.
          </p>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Load Sample Data Card */}
            <div className="backup-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <i className="ri-magic-line text-blue-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Load Sample Data</h3>
                  <p className="text-sm text-slate-500">Add demo products & categories</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Adds 8 sample products with variants, 4 categories, and 2 demo coupons. Existing data will be cleared first.
              </p>

              <button
                onClick={handleLoadSampleData}
                disabled={loading || clearing}
                className="backup-btn backup-btn-secondary"
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line spinner"></i>
                    <span>Loading...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-seedling-line"></i>
                    <span>Load Sample Data</span>
                  </>
                )}
              </button>
            </div>

            {/* Clear All Data Card */}
            <div className="backup-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <i className="ri-delete-bin-line text-red-600 text-xl"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Clear All Data</h3>
                  <p className="text-sm text-slate-500">Remove all products & orders</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 mb-4">
                Permanently delete all products, categories, orders, customers, and coupons. Settings will be preserved.
              </p>

              <button
                onClick={handleClearAllData}
                disabled={loading || clearing}
                className="backup-btn backup-btn-warning"
              >
                {clearing ? (
                  <>
                    <i className="ri-loader-4-line spinner"></i>
                    <span>Clearing...</span>
                  </>
                ) : (
                  <>
                    <i className="ri-delete-bin-line"></i>
                    <span>Clear All Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* What's Included */}
        <div className="p-4 bg-slate-50 rounded-lg">
          <h4 className="font-medium text-slate-700 mb-2">What's included in the backup?</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-green-500"></i>
              <span>Products & Variants</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-green-500"></i>
              <span>Categories</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-green-500"></i>
              <span>Orders & Items</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-green-500"></i>
              <span>Customers</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-green-500"></i>
              <span>Coupons</span>
            </div>
            <div className="flex items-center gap-2">
              <i className="ri-checkbox-circle-fill text-green-500"></i>
              <span>Settings</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            <i className="ri-information-line mr-1"></i>
            Note: Sensitive credentials (passwords, API keys) are not included in backups for security reasons.
          </p>
        </div>
      </div>
    </div>
  )
}

export default BackupView
