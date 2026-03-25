'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'

type ContentType = 'about' | 'terms' | 'refund' | 'privacy'

const PageContentView: React.FC = () => {
  const { settings, setSettings, showToastMsg, refetchSettings } = useAdmin()
  
  const [activeTab, setActiveTab] = useState<ContentType>('about')
  const [aboutUs, setAboutUs] = useState('')
  const [termsConditions, setTermsConditions] = useState('')
  const [refundPolicy, setRefundPolicy] = useState('')
  const [privacyPolicy, setPrivacyPolicy] = useState('')
  const [saving, setSaving] = useState(false)
  
  const syncedRef = useRef(false)

  useEffect(() => {
    if (!syncedRef.current) {
      setAboutUs(settings.aboutUs ?? '')
      setTermsConditions(settings.termsConditions ?? '')
      setRefundPolicy(settings.refundPolicy ?? '')
      setPrivacyPolicy(settings.privacyPolicy ?? '')
      syncedRef.current = true
    }
  }, [settings])

  const handleSaveContent = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          aboutUs,
          termsConditions,
          refundPolicy,
          privacyPolicy,
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        await refetchSettings()
        showToastMsg('Page content saved successfully!')
      } else {
        showToastMsg('Failed to save content')
      }
    } catch (error) {
      showToastMsg('Error saving content')
    } finally {
      setSaving(false)
    }
  }

  const tabs: { id: ContentType; label: string; icon: string; description: string }[] = [
    { id: 'about', label: 'About Us', icon: 'ri-building-line', description: 'Company introduction' },
    { id: 'terms', label: 'Terms & Conditions', icon: 'ri-file-list-3-line', description: 'Usage policies' },
    { id: 'refund', label: 'Refund Policy', icon: 'ri-exchange-line', description: 'Return guidelines' },
    { id: 'privacy', label: 'Privacy Policy', icon: 'ri-shield-user-line', description: 'Data protection' },
  ]

  const getContent = () => {
    switch (activeTab) {
      case 'about': return aboutUs
      case 'terms': return termsConditions
      case 'refund': return refundPolicy
      case 'privacy': return privacyPolicy
    }
  }

  const setContent = (value: string) => {
    switch (activeTab) {
      case 'about': setAboutUs(value); break
      case 'terms': setTermsConditions(value); break
      case 'refund': setRefundPolicy(value); break
      case 'privacy': setPrivacyPolicy(value); break
    }
  }

  const getPlaceholder = () => {
    switch (activeTab) {
      case 'about': return 'Write about your company, mission, values, and what makes your business unique...'
      case 'terms': return 'Define your terms of service, usage rules, purchase conditions, and policies...'
      case 'refund': return 'Explain your refund and return policies, eligibility criteria, and process...'
      case 'privacy': return 'Describe how you collect, use, store, and protect customer information...'
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto p-6 lg:p-8">

        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 shrink-0">
            <nav className="bg-white border border-[#e2e8f0] overflow-hidden" style={{ borderRadius: '5px' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all border-b border-[#f1f5f9] last:border-b-0 ${
                    activeTab === tab.id
                      ? 'bg-[#f0fdf4] border-l-2 border-l-[#16a34a]'
                      : 'hover:bg-[#f8fafc] border-l-2 border-l-transparent'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    activeTab === tab.id ? 'bg-[#16a34a] text-white' : 'bg-[#f1f5f9] text-[#64748b]'
                  }`}>
                    <i className={`${tab.icon} text-lg`}></i>
                  </div>
                  <div>
                    <span className={`block text-sm font-medium ${activeTab === tab.id ? 'text-[#16a34a]' : 'text-[#0f172a]'}`}>
                      {tab.label}
                    </span>
                    <span className="text-xs text-[#94a3b8]">{tab.description}</span>
                  </div>
                </button>
              ))}
            </nav>

            {/* Quick Stats */}
            <div className="mt-4 bg-white border border-[#e2e8f0] p-4" style={{ borderRadius: '5px' }}>
              <h4 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Content Stats</h4>
              <div className="space-y-3">
                {tabs.map((tab) => {
                  const len = tab.id === 'about' ? aboutUs.length :
                              tab.id === 'terms' ? termsConditions.length :
                              tab.id === 'refund' ? refundPolicy.length :
                              privacyPolicy.length
                  return (
                    <div key={tab.id} className="flex items-center justify-between">
                      <span className="text-xs text-[#64748b]">{tab.label}</span>
                      <span className={`text-xs font-medium ${len > 0 ? 'text-[#16a34a]' : 'text-[#94a3b8]'}`}>
                        {len} chars
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Editor Card */}
            <div className="bg-white border border-[#e2e8f0] overflow-hidden" style={{ borderRadius: '5px' }}>
              {/* Card Header */}
              <div className="px-6 py-4 border-b border-[#f1f5f9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#f0fdf4] rounded-lg flex items-center justify-center">
                    <i className={`${tabs.find(t => t.id === activeTab)!.icon} text-[#16a34a] text-lg`}></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#0f172a]">
                      {tabs.find(t => t.id === activeTab)!.label}
                    </h3>
                    <p className="text-xs text-[#64748b]">
                      {activeTab === 'about' && 'Tell customers about your business'}
                      {activeTab === 'terms' && 'Rules for using your service'}
                      {activeTab === 'refund' && 'Return and refund guidelines'}
                      {activeTab === 'privacy' && 'How you protect customer data'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f8fafc] rounded-lg">
                  <i className="ri-text text-[#64748b] text-sm"></i>
                  <span className="text-xs text-[#64748b]">{getContent().length} characters</span>
                </div>
              </div>

              {/* Editor Area */}
              <div className="p-6">
                <textarea
                  placeholder={getPlaceholder()}
                  value={getContent()}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] p-5 text-sm text-[#0f172a] outline-none focus:border-[#16a34a] focus:bg-white transition-all resize-none"
                  style={{ borderRadius: '5px', minHeight: '420px', lineHeight: '1.8' }}
                />
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-[#f8fafc] border-t border-[#f1f5f9] flex items-center justify-between" style={{ borderBottomLeftRadius: '5px', borderBottomRightRadius: '5px' }}>
                <div className="flex items-center gap-2 text-xs text-[#64748b]">
                  <i className="ri-information-line"></i>
                  <span>Content appears on your public {tabs.find(t => t.id === activeTab)!.label.toLowerCase()} page</span>
                </div>
                <button
                  onClick={() => setActiveTab(activeTab === 'about' ? 'terms' : activeTab === 'terms' ? 'refund' : activeTab === 'refund' ? 'privacy' : 'about')}
                  className="text-xs text-[#16a34a] font-medium hover:underline"
                >
                  Next page →
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveContent}
                disabled={saving}
                className="px-6 py-3 bg-[#16a34a] text-white text-sm font-semibold hover:bg-[#15803d] transition-colors flex items-center gap-2 disabled:bg-[#cbd5e1]"
                style={{ borderRadius: '5px' }}
              >
                <i className="ri-save-line"></i>
                {saving ? 'Saving...' : 'Save All Content'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PageContentView
