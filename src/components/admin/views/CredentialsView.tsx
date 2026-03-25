'use client'

import React, { useState, useMemo } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { useCsrfFetch } from '@/hooks/useCsrfFetch'

interface Credential {
  id: number
  type: 'admin' | 'courier' | 'cloudinary'
  label: string
  icon: string
  timestampKey: string
  fieldKey: string
  hasKey?: string // Key to check if value exists (for sensitive fields)
  required?: boolean
  isSensitive?: boolean
}

// Helper function to format last edited time
const formatLastEdited = (isoString: string | null | undefined): string => {
  if (!isoString) return 'Never edited'
  
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    
    let timeAgo = ''
    if (diffDays > 0) {
      timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    } else if (diffHours > 0) {
      timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    } else if (diffMinutes > 0) {
      timeAgo = `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    } else {
      timeAgo = 'Just now'
    }
    
    const dateStr = date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }).toLowerCase()
    
    return `${timeAgo} - ${dateStr} - ${timeStr}`
  } catch {
    return 'Never edited'
  }
}

const CredentialsView: React.FC = () => {
  const { csrfFetch } = useCsrfFetch()
  const { settings, showToastMsg, refetchSettings } = useAdmin()
  const [activeTab, setActiveTab] = useState<'admin' | 'courier' | 'cloudinary'>('admin')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [testing, setTesting] = useState(false)
  
  // Track the actual value being edited
  const [editValue, setEditValue] = useState('')

  // Define all credentials
  const credentialDefs: Credential[] = useMemo(() => [
    // Admin credentials
    { 
      id: 1, 
      type: 'admin', 
      label: 'Admin Username', 
      icon: 'fa-user', 
      timestampKey: 'adminUsernameUpdatedAt',
      fieldKey: 'adminUsername',
      required: true,
      isSensitive: false
    },
    { 
      id: 2, 
      type: 'admin', 
      label: 'Admin Password', 
      icon: 'fa-lock', 
      timestampKey: 'adminPasswordUpdatedAt',
      fieldKey: 'adminPassword',
      hasKey: 'hasAdminPassword',
      required: true,
      isSensitive: true
    },
    // Courier credentials
    { 
      id: 3, 
      type: 'courier', 
      label: 'Steadfast API Key', 
      icon: 'fa-key', 
      timestampKey: 'steadfastApiUpdatedAt',
      fieldKey: 'steadfastApiKey',
      hasKey: 'hasSteadfastApiKey',
      isSensitive: true
    },
    { 
      id: 4, 
      type: 'courier', 
      label: 'Steadfast Secret Key', 
      icon: 'fa-shield-halved', 
      timestampKey: 'steadfastApiUpdatedAt',
      fieldKey: 'steadfastSecretKey',
      hasKey: 'hasSteadfastSecretKey',
      isSensitive: true
    },
    { 
      id: 5, 
      type: 'courier', 
      label: 'Steadfast Webhook URL', 
      icon: 'fa-link', 
      timestampKey: 'steadfastApiUpdatedAt',
      fieldKey: 'steadfastWebhookUrl',
      isSensitive: false
    },
    // Cloudinary credentials
    { 
      id: 6, 
      type: 'cloudinary', 
      label: 'Cloudinary Cloud Name', 
      icon: 'fa-cloud', 
      timestampKey: 'cloudinaryUpdatedAt',
      fieldKey: 'cloudinaryCloudName',
      isSensitive: false
    },
    { 
      id: 7, 
      type: 'cloudinary', 
      label: 'Cloudinary API Key', 
      icon: 'fa-key', 
      timestampKey: 'cloudinaryUpdatedAt',
      fieldKey: 'cloudinaryApiKey',
      isSensitive: false
    },
    { 
      id: 8, 
      type: 'cloudinary', 
      label: 'Cloudinary API Secret', 
      icon: 'fa-user-secret', 
      timestampKey: 'cloudinaryUpdatedAt',
      fieldKey: 'cloudinaryApiSecret',
      hasKey: 'hasCloudinaryApiSecret',
      isSensitive: true
    },
  ], [])

  // Check if a credential has a value set
  const hasValue = (cred: Credential): boolean => {
    // For sensitive fields, use the "has" flag from API
    if (cred.hasKey) {
      return settings[cred.hasKey as keyof typeof settings] === true
    }
    // For non-sensitive fields, check the actual value
    const rawValue = settings[cred.fieldKey as keyof typeof settings]
    return rawValue !== undefined && rawValue !== null && rawValue !== ''
  }

  // Get the display value for non-editing mode
  const getDisplayValue = (cred: Credential): string => {
    if (cred.isSensitive) {
      return '' // Don't show values for sensitive fields
    }
    const rawValue = settings[cred.fieldKey as keyof typeof settings] as string || ''
    return rawValue
  }

  // Start editing a credential
  const startEdit = (cred: Credential) => {
    setEditingId(cred.id)
    
    // For sensitive fields, always start empty
    // For non-sensitive fields, pre-fill with current value
    if (cred.isSensitive) {
      setEditValue('')
    } else {
      setEditValue(getDisplayValue(cred))
    }
  }

  // Cancel editing
  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  // Save credential
  const saveCredential = async (id: number) => {
    const cred = credentialDefs.find(c => c.id === id)
    if (!cred) return

    // Validate
    if (cred.isSensitive && !editValue.trim()) {
      showToastMsg(`Please enter a value for ${cred.label}`)
      return
    }

    if (cred.required && !editValue.trim()) {
      showToastMsg(`${cred.label} cannot be empty`)
      return
    }

    // For non-sensitive fields, check if value changed
    if (!cred.isSensitive) {
      const currentVal = getDisplayValue(cred)
      if (editValue === currentVal) {
        cancelEdit()
        showToastMsg('No changes made')
        return
      }
    }

    setSaving(true)
    try {
      const res = await csrfFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [cred.fieldKey]: editValue.trim() })
      })
      const data = await res.json()
      
      if (data.success) {
        // Update local settings immediately with the response
        await refetchSettings()
        setEditingId(null)
        setEditValue('')
        showToastMsg(`${cred.label} saved successfully!`)
      } else {
        showToastMsg(data.error || 'Failed to save')
      }
    } catch (error) {
      showToastMsg('Error saving credential')
    }
    setSaving(false)
  }

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveCredential(id)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

  // Test connection function
  const testConnection = async () => {
    setTesting(true)

    try {
      const res = await csrfFetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeTab })
      })
      const data = await res.json()

      const serviceName = activeTab === 'courier' ? 'Courier API' : 'Cloudinary API'
      
      if (data.success) {
        showToastMsg(`${serviceName} connected! Enjoy your journey!`, 'success')
      } else {
        showToastMsg(`${serviceName} not connected`, 'error')
      }
    } catch (error) {
      showToastMsg('Connection test failed', 'error')
    }

    setTesting(false)
  }

  // Get test button text based on active tab
  const getTestButtonText = () => {
    switch (activeTab) {
      case 'courier':
        return 'Test Courier Connection'
      case 'cloudinary':
        return 'Test Cloudinary Connection'
      default:
        return 'Test Connection'
    }
  }

  // Check if current tab supports testing
  const canTest = activeTab === 'courier' || activeTab === 'cloudinary'

  const filteredCredentials = credentialDefs.filter(c => c.type === activeTab)

  return (
    <div className="p-12 bg-white min-h-screen" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style jsx global>{`
        .rounded-5 { border-radius: 5px !important; }
        .table-container { border: 1px solid #cbd5e1; border-radius: 5px; overflow: hidden; }
        .credentials-table { width: 100%; border-collapse: collapse; }
        .credentials-table th, .credentials-table td { border: 1px solid #cbd5e1; }
        .credentials-table tr th:first-child, .credentials-table tr td:first-child { border-left: none; }
        .credentials-table tr th:last-child, .credentials-table tr td:last-child { border-right: none; }
        .credentials-table thead tr:first-child th { border-top: none; }
        .credentials-table tbody tr:last-child td { border-bottom: none; }
        .typing-input {
          background: transparent;
          border: none;
          border-radius: 0;
          outline: none;
          text-align: center;
          width: 100%;
          padding: 0;
          font-weight: 500;
          color: #0f172a;
          font-size: 16px !important;
        }
        .typing-input:focus {
          outline: none;
        }
        .typing-input::placeholder {
          color: #94a3b8;
          font-style: italic;
        }
        .test-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: 2px solid #16a34a;
          background: #16a34a;
          color: white;
        }
        .test-btn:hover:not(:disabled) {
          background: #15803d;
          border-color: #15803d;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
        }
        .test-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .test-btn.testing {
          background: #64748b;
          border-color: #64748b;
        }
        .edit-actions {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .action-btn {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }
        .action-btn.save {
          background: #16a34a;
          color: white;
        }
        .action-btn.save:hover {
          background: #15803d;
        }
        .action-btn.cancel {
          background: #fee2e2;
          color: #dc2626;
        }
        .action-btn.cancel:hover {
          background: #fecaca;
        }
        .action-btn.edit {
          background: #f1f5f9;
          color: #64748b;
        }
        .action-btn.edit:hover {
          background: #e2e8f0;
          color: #0f172a;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        {/* Filter Tabs */}
        <div className="flex gap-3 mb-5 flex-wrap items-center">
          <button
            onClick={() => { setActiveTab('admin'); cancelEdit(); }}
            className={`px-5 py-1.5 border rounded-5 text-sm font-semibold transition-all ${
              activeTab === 'admin'
                ? 'border-slate-800 text-slate-900 bg-slate-50'
                : 'border-slate-200 text-slate-400 hover:border-slate-300'
            }`}
          >
            Admin Credentials
          </button>
          <button
            onClick={() => { setActiveTab('courier'); cancelEdit(); }}
            className={`px-5 py-1.5 border rounded-5 text-sm font-semibold transition-all ${
              activeTab === 'courier'
                ? 'border-slate-800 text-slate-900 bg-slate-50'
                : 'border-slate-200 text-slate-400 hover:border-slate-300'
            }`}
          >
            Courier API
          </button>
          <button
            onClick={() => { setActiveTab('cloudinary'); cancelEdit(); }}
            className={`px-5 py-1.5 border rounded-5 text-sm font-semibold transition-all ${
              activeTab === 'cloudinary'
                ? 'border-slate-800 text-slate-900 bg-slate-50'
                : 'border-slate-200 text-slate-400 hover:border-slate-300'
            }`}
          >
            Cloudinary
          </button>

          {/* Test Connection Button - Same style as filter tabs */}
          {canTest && (
            <button
              onClick={testConnection}
              disabled={testing}
              className={`px-5 py-1.5 border rounded-5 text-sm font-semibold transition-all ${
                testing
                  ? 'border-slate-400 text-slate-500 bg-slate-100 cursor-not-allowed'
                  : 'border-green-600 text-green-700 bg-green-50 hover:bg-green-100'
              }`}
            >
              {testing ? (
                <>
                  <i className="fa-solid fa-spinner spinner mr-2"></i>
                  Testing...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-plug mr-2"></i>
                  Test Connection
                </>
              )}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="table-container">
          <table className="credentials-table">
            <thead className="bg-slate-50">
              <tr className="text-[11px] uppercase tracking-widest text-slate-500">
                <th className="px-6 py-4 text-left font-bold">Credential Name</th>
                <th className="px-6 py-4 text-center font-bold">Status / Value</th>
                <th className="px-6 py-4 text-center font-bold">Last Edited</th>
                <th className="px-6 py-4 text-center font-bold w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCredentials.map((cred) => {
                const timestamp = settings[cred.timestampKey as keyof typeof settings] as string | null
                const lastEdited = formatLastEdited(timestamp)
                const isEditing = editingId === cred.id
                const hasVal = hasValue(cred)
                
                return (
                  <tr key={cred.id} className="hover:bg-slate-50/30">
                    {/* Credential Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 border border-slate-200 rounded-full flex items-center justify-center text-slate-400">
                          <i className={`fa-solid text-[10px] ${cred.icon}`}></i>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">{cred.label}</span>
                          <div className="flex items-center gap-2">
                            {cred.required && (
                              <span className="text-[10px] text-red-400">Required</span>
                            )}
                            {cred.isSensitive && (
                              <span className="text-[10px] text-amber-500">Sensitive</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status / Value */}
                    <td className="px-6 py-4 text-center">
                      {isEditing ? (
                        <input 
                          type={cred.fieldKey.includes('password') || cred.fieldKey.includes('secret') ? 'password' : 'text'} 
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, cred.id)}
                          className="typing-input"
                          style={{ fontSize: '16px' }}
                          autoFocus
                          disabled={saving}
                          placeholder={cred.isSensitive ? 'Enter new value...' : `Enter ${cred.label.toLowerCase()}...`}
                        />
                      ) : (
                        <span className="text-sm text-slate-600">
                          {hasVal ? '••••••••' : 'Not set'}
                        </span>
                      )}
                    </td>

                    {/* Last Edited */}
                    <td className="px-6 py-4 text-center">
                      <span className="text-xs text-slate-400 font-medium">{lastEdited}</span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4">
                      {isEditing ? (
                        <div className="edit-actions">
                          <button 
                            onClick={() => saveCredential(cred.id)} 
                            className="action-btn save"
                            style={{ background: '#16a34a', color: 'white' }}
                            disabled={saving || !editValue.trim()}
                            title="Save"
                          >
                            <i className="fa-solid fa-check text-sm"></i>
                          </button>
                          <button 
                            onClick={cancelEdit} 
                            className="action-btn cancel"
                            style={{ background: '#fee2e2', color: '#dc2626' }}
                            disabled={saving}
                            title="Cancel"
                          >
                            <i className="fa-solid fa-xmark text-sm"></i>
                          </button>
                        </div>
                      ) : (
                        <div className="edit-actions">
                          <button 
                            onClick={() => startEdit(cred)} 
                            className="action-btn edit"
                            style={{ background: '#f1f5f9', color: '#64748b' }}
                            disabled={saving}
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen text-sm"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Status Info */}
        {saving && (
          <div className="mt-4 text-center text-sm text-slate-400">
            <i className="fa-solid fa-spinner fa-spin mr-2"></i>
            Saving...
          </div>
        )}
      </div>
    </div>
  )
}

export default CredentialsView
