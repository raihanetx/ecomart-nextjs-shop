'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAdmin } from '@/components/admin/context/AdminContext'
import { useCsrfFetch } from '@/hooks/useCsrfFetch'

type SettingsTab = 'branding' | 'hero' | 'delivery' | 'social' | 'legal' | 'sections'

interface LegalPage {
  id: string
  name: string
  content: string
}

interface SectionItem {
  id: number
  label: string
  field: string
  value: string
  icon: string
  lastEdited: string
}

// Animation options for hero
const ANIMATION_OPTIONS = [
  { value: 'Fade', label: 'Fade' },
  { value: 'Slide', label: 'Slide' },
  { value: 'Zoom', label: 'Zoom' },
  { value: 'KenBurns', label: 'Ken Burns' },
  { value: 'Flip', label: 'Flip' },
  { value: 'Blur', label: 'Blur' },
]

const SettingsView: React.FC = () => {
  const { csrfFetch } = useCsrfFetch()
  const { settings, setSettings, showToastMsg, refetchSettings } = useAdmin()
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('branding')
  const [previewModal, setPreviewModal] = useState(false)
  const [previewSrc, setPreviewSrc] = useState('')
  const [saving, setSaving] = useState(false)
  
  // Branding state
  const [brandingEditing, setBrandingEditing] = useState(false)
  const [websiteName, setWebsiteName] = useState('My Store')
  const [slogan, setSlogan] = useState('Premium Quality')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoName, setLogoName] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [faviconName, setFaviconName] = useState('')
  // Original values for cancel
  const [origWebsiteName, setOrigWebsiteName] = useState('My Store')
  const [origSlogan, setOrigSlogan] = useState('Premium Quality')
  const [origLogoUrl, setOrigLogoUrl] = useState('')
  const [origFaviconUrl, setOrigFaviconUrl] = useState('')
  
  // Hero state
  const [heroImages, setHeroImages] = useState<{name: string, url: string}[]>([])
  const [animationSpeed, setAnimationSpeed] = useState(3000)
  const [animationType, setAnimationType] = useState('Fade')
  const [heroEditing, setHeroEditing] = useState(false)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  // Original values for cancel
  const [origHeroImages, setOrigHeroImages] = useState<{name: string, url: string}[]>([])
  const [origAnimationSpeed, setOrigAnimationSpeed] = useState(3000)
  const [origAnimationType, setOrigAnimationType] = useState('Fade')
  
  // Delivery state
  const [deliveryEditing, setDeliveryEditing] = useState(false)
  const [insideDhaka, setInsideDhaka] = useState(60)
  const [outsideDhaka, setOutsideDhaka] = useState(120)
  const [universalCharge, setUniversalCharge] = useState(0)
  const [isUniversalOn, setIsUniversalOn] = useState(false)
  const [freeThreshold, setFreeThreshold] = useState(2000)
  // Original values for cancel
  const [origInsideDhaka, setOrigInsideDhaka] = useState(60)
  const [origOutsideDhaka, setOrigOutsideDhaka] = useState(120)
  const [origUniversalCharge, setOrigUniversalCharge] = useState(0)
  const [origIsUniversalOn, setOrigIsUniversalOn] = useState(false)
  const [origFreeThreshold, setOrigFreeThreshold] = useState(2000)
  
  // Social state
  const [socialEditing, setSocialEditing] = useState(false)
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [facebook, setFacebook] = useState('')
  const [messenger, setMessenger] = useState('')
  // Original values for cancel
  const [origPhone, setOrigPhone] = useState('')
  const [origWhatsapp, setOrigWhatsapp] = useState('')
  const [origFacebook, setOrigFacebook] = useState('')
  const [origMessenger, setOrigMessenger] = useState('')
  
  // Legal state
  const [editingLegalId, setEditingLegalId] = useState<string | null>(null)
  const [legalPages, setLegalPages] = useState<LegalPage[]>([
    { id: 'about', name: 'About Us', content: '' },
    { id: 'terms', name: 'Terms and Conditions', content: '' },
    { id: 'refund', name: 'Refund Policy', content: '' },
    { id: 'privacy', name: 'Privacy Policy', content: '' }
  ])
  
  // Section Naming state
  const [sectionItems, setSectionItems] = useState<SectionItem[]>([
    { id: 1, label: 'First Section Name', field: 'firstSectionName', value: 'Categories', icon: 'fa-layer-group', lastEdited: 'Never edited' },
    { id: 2, label: 'First Section Slogan', field: 'firstSectionSlogan', value: '', icon: 'fa-quote-left', lastEdited: 'Never edited' },
    { id: 3, label: 'Second Section Name', field: 'secondSectionName', value: 'Offers', icon: 'fa-tag', lastEdited: 'Never edited' },
    { id: 4, label: 'Second Section Slogan', field: 'secondSectionSlogan', value: '', icon: 'fa-quote-right', lastEdited: 'Never edited' },
    { id: 5, label: 'Third Section Name', field: 'thirdSectionName', value: 'Featured', icon: 'fa-star', lastEdited: 'Never edited' },
    { id: 6, label: 'Third Section Slogan', field: 'thirdSectionSlogan', value: '', icon: 'fa-message', lastEdited: 'Never edited' },
  ])
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null)
  const [editingSectionValue, setEditingSectionValue] = useState('')
  
  const syncedRef = useRef(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  const heroInputRef = useRef<HTMLInputElement>(null)

  // Sync settings from context
  useEffect(() => {
    if (!syncedRef.current && settings) {
      queueMicrotask(() => {
        setWebsiteName(settings.websiteName || 'My Store')
        setSlogan(settings.slogan || 'Premium Quality')
        setLogoUrl(settings.logoUrl || '')
        setLogoName(settings.logoUrl ? 'logo' : '')
        setFaviconUrl(settings.faviconUrl || '')
        setFaviconName(settings.faviconUrl ? 'favicon' : '')
        // Set original values
        setOrigWebsiteName(settings.websiteName || 'My Store')
        setOrigSlogan(settings.slogan || 'Premium Quality')
        setOrigLogoUrl(settings.logoUrl || '')
        setOrigFaviconUrl(settings.faviconUrl || '')
        
        // Parse hero images
        if (settings.heroImages) {
          try {
            const parsed = typeof settings.heroImages === 'string' 
              ? JSON.parse(settings.heroImages) 
              : settings.heroImages
            if (Array.isArray(parsed) && parsed.length > 0) {
              const heroImgs = parsed.map((url: string, i: number) => ({ name: `banner${i+1}`, url }))
              setHeroImages(heroImgs)
              setOrigHeroImages(heroImgs)
            }
          } catch { /* empty */ }
        }
        
        // Hero animation settings
        setAnimationSpeed(settings.heroAnimationSpeed || 3000)
        setAnimationType(settings.heroAnimationType || 'Fade')
        setOrigAnimationSpeed(settings.heroAnimationSpeed || 3000)
        setOrigAnimationType(settings.heroAnimationType || 'Fade')
        
        setInsideDhaka(settings.insideDhakaDelivery || 60)
        setOutsideDhaka(settings.outsideDhakaDelivery || 120)
        setUniversalCharge(settings.universalDeliveryCharge || 0)
        setIsUniversalOn(settings.universalDelivery ?? false)
        setFreeThreshold(settings.freeDeliveryMin || 2000)
        setOrigInsideDhaka(settings.insideDhakaDelivery || 60)
        setOrigOutsideDhaka(settings.outsideDhakaDelivery || 120)
        setOrigUniversalCharge(settings.universalDeliveryCharge || 0)
        setOrigIsUniversalOn(settings.universalDelivery ?? false)
        setOrigFreeThreshold(settings.freeDeliveryMin || 2000)
        
        setPhone(settings.phoneNumber || '')
        setWhatsapp(settings.whatsappNumber || '')
        setFacebook(settings.facebookUrl || '')
        setMessenger(settings.messengerUsername || '')
        setOrigPhone(settings.phoneNumber || '')
        setOrigWhatsapp(settings.whatsappNumber || '')
        setOrigFacebook(settings.facebookUrl || '')
        setOrigMessenger(settings.messengerUsername || '')
        
        // Set legal pages content
        setLegalPages([
          { id: 'about', name: 'About Us', content: settings.aboutUs || '' },
          { id: 'terms', name: 'Terms and Conditions', content: settings.termsConditions || '' },
          { id: 'refund', name: 'Refund Policy', content: settings.refundPolicy || '' },
          { id: 'privacy', name: 'Privacy Policy', content: settings.privacyPolicy || '' }
        ])
        
        // Section naming - use ?? to allow empty strings (|| treats '' as falsy)
        setSectionItems([
          { id: 1, label: 'First Section Name', field: 'firstSectionName', value: settings.firstSectionName ?? 'Categories', icon: 'fa-layer-group', lastEdited: 'Never edited' },
          { id: 2, label: 'First Section Slogan', field: 'firstSectionSlogan', value: settings.firstSectionSlogan ?? '', icon: 'fa-quote-left', lastEdited: 'Never edited' },
          { id: 3, label: 'Second Section Name', field: 'secondSectionName', value: settings.secondSectionName ?? 'Offers', icon: 'fa-tag', lastEdited: 'Never edited' },
          { id: 4, label: 'Second Section Slogan', field: 'secondSectionSlogan', value: settings.secondSectionSlogan ?? '', icon: 'fa-quote-right', lastEdited: 'Never edited' },
          { id: 5, label: 'Third Section Name', field: 'thirdSectionName', value: settings.thirdSectionName ?? 'Featured', icon: 'fa-star', lastEdited: 'Never edited' },
          { id: 6, label: 'Third Section Slogan', field: 'thirdSectionSlogan', value: settings.thirdSectionSlogan ?? '', icon: 'fa-message', lastEdited: 'Never edited' },
        ])
        
        syncedRef.current = true
      })
    }
  }, [settings])

  const openPreview = (url: string) => {
    if (url) {
      setPreviewSrc(url)
      setPreviewModal(true)
    }
  }

  // Upload file
  const uploadFile = async (file: File, type: string): Promise<string | null> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    
    try {
      const response = await csrfFetch('/api/upload', { method: 'POST', body: formData })
      const result = await response.json()
      return result.success ? result.url : null
    } catch {
      return null
    }
  }

  // Optimized save function - updates local state immediately, no refetch needed
  const saveSettingsOptimized = useCallback(async (updateData: Record<string, any>, onSuccess?: () => void) => {
    setSaving(true)
    try {
      const res = await csrfFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      })
      const data = await res.json()
      if (data.success) {
        // Update local state immediately - no need to refetch
        setSettings((prev: any) => ({ ...prev, ...updateData }))
        onSuccess?.()
        showToastMsg('Saved successfully!')
        return true
      }
      return false
    } catch {
      showToastMsg('Error saving')
      return false
    } finally {
      setSaving(false)
    }
  }, [setSettings, showToastMsg])

  // Branding handlers
  const startBrandingEdit = () => {
    setOrigWebsiteName(websiteName)
    setOrigSlogan(slogan)
    setOrigLogoUrl(logoUrl)
    setOrigFaviconUrl(faviconUrl)
    setBrandingEditing(true)
  }
  
  const cancelBrandingEdit = () => {
    setWebsiteName(origWebsiteName)
    setSlogan(origSlogan)
    setLogoUrl(origLogoUrl)
    setFaviconUrl(origFaviconUrl)
    setBrandingEditing(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    showToastMsg('Uploading logo...')
    const url = await uploadFile(file, 'logo')
    if (url) {
      setLogoUrl(url)
      setLogoName(file.name)
      showToastMsg('Logo uploaded!')
    } else {
      showToastMsg('Upload failed')
    }
  }

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    showToastMsg('Uploading favicon...')
    const url = await uploadFile(file, 'favicon')
    if (url) {
      setFaviconUrl(url)
      setFaviconName(file.name)
      showToastMsg('Favicon uploaded!')
    } else {
      showToastMsg('Upload failed')
    }
  }

  const saveBranding = async () => {
    await saveSettingsOptimized({
      websiteName,
      slogan,
      logoUrl,
      faviconUrl
    }, () => setBrandingEditing(false))
  }

  // Hero handlers
  const startHeroEdit = () => {
    setOrigHeroImages([...heroImages])
    setOrigAnimationSpeed(animationSpeed)
    setOrigAnimationType(animationType)
    setHeroEditing(true)
  }
  
  const cancelHeroEdit = () => {
    setHeroImages([...origHeroImages])
    setAnimationSpeed(origAnimationSpeed)
    setAnimationType(origAnimationType)
    setHeroEditing(false)
  }

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    setUploadingHero(true)
    setUploadProgress({ current: 0, total: files.length })
    
    const newImages: {name: string, url: string}[] = []
    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length })
      const url = await uploadFile(files[i], `hero-${Date.now()}-${i}`)
      if (url) {
        newImages.push({ name: files[i].name, url })
      }
    }
    
    setUploadingHero(false)
    setUploadProgress({ current: 0, total: 0 })
    
    if (newImages.length > 0) {
      setHeroImages(prev => [...prev, ...newImages])
      showToastMsg(`${newImages.length} image(s) uploaded! Click Save to apply.`, 'success')
    } else {
      showToastMsg('Upload failed. Please try again.', 'error')
    }
    
    // Clear the input
    e.target.value = ''
  }

  const removeHeroImage = (index: number) => {
    setHeroImages(prev => prev.filter((_, i) => i !== index))
  }

  const adjustSpeed = (delta: number) => {
    setAnimationSpeed(prev => Math.max(500, Math.min(10000, prev + delta)))
  }

  const saveHero = async () => {
    await saveSettingsOptimized({
      heroImages: JSON.stringify(heroImages.map(h => h.url)),
      heroAnimationSpeed: animationSpeed,
      heroAnimationType: animationType
    }, () => setHeroEditing(false))
  }

  // Delivery handlers
  const startDeliveryEdit = () => {
    setOrigInsideDhaka(insideDhaka)
    setOrigOutsideDhaka(outsideDhaka)
    setOrigUniversalCharge(universalCharge)
    setOrigIsUniversalOn(isUniversalOn)
    setOrigFreeThreshold(freeThreshold)
    setDeliveryEditing(true)
  }
  
  const cancelDeliveryEdit = () => {
    setInsideDhaka(origInsideDhaka)
    setOutsideDhaka(origOutsideDhaka)
    setUniversalCharge(origUniversalCharge)
    setIsUniversalOn(origIsUniversalOn)
    setFreeThreshold(origFreeThreshold)
    setDeliveryEditing(false)
  }

  const saveDelivery = async () => {
    await saveSettingsOptimized({
      insideDhakaDelivery: insideDhaka,
      outsideDhakaDelivery: outsideDhaka,
      universalDeliveryCharge: universalCharge,
      universalDelivery: isUniversalOn,
      freeDeliveryMin: freeThreshold
    }, () => setDeliveryEditing(false))
  }

  // Social handlers
  const startSocialEdit = () => {
    setOrigPhone(phone)
    setOrigWhatsapp(whatsapp)
    setOrigFacebook(facebook)
    setOrigMessenger(messenger)
    setSocialEditing(true)
  }
  
  const cancelSocialEdit = () => {
    setPhone(origPhone)
    setWhatsapp(origWhatsapp)
    setFacebook(origFacebook)
    setMessenger(origMessenger)
    setSocialEditing(false)
  }

  const saveSocial = async () => {
    await saveSettingsOptimized({
      phoneNumber: phone,
      whatsappNumber: whatsapp,
      facebookUrl: facebook,
      messengerUsername: messenger
    }, () => setSocialEditing(false))
  }

  // Legal handlers
  const getActivePageName = () => legalPages.find(p => p.id === editingLegalId)?.name || ''
  const getActivePageContent = () => legalPages.find(p => p.id === editingLegalId)?.content || ''
  const updateActivePageContent = (val: string) => {
    setLegalPages(prev => prev.map(p => p.id === editingLegalId ? { ...p, content: val } : p))
  }
  const saveLegalPage = async () => {
    const page = legalPages.find(p => p.id === editingLegalId)
    if (page) {
      const fieldMap: Record<string, string> = {
        about: 'aboutUs',
        terms: 'termsConditions',
        refund: 'refundPolicy',
        privacy: 'privacyPolicy'
      }
      await saveSettingsOptimized({ [fieldMap[page.id]]: page.content }, () => {
        showToastMsg(`${getActivePageName()} saved!`)
        setEditingLegalId(null)
      })
    }
  }

  // Section Naming handlers - same pattern as Credentials
  const startSectionEdit = (item: SectionItem) => {
    setEditingSectionId(item.id)
    setEditingSectionValue(item.value)
  }

  const cancelSectionEdit = () => {
    setEditingSectionId(null)
    setEditingSectionValue('')
  }

  const saveSectionItem = async (id: number) => {
    const item = sectionItems.find(s => s.id === id)
    if (!item) return

    // Trim the value - empty string is valid for slogans
    const trimmedValue = editingSectionValue.trim()

    // Check if value actually changed (compare trimmed values)
    if (trimmedValue === item.value) {
      cancelSectionEdit()
      showToastMsg('No changes made')
      return
    }

    setSaving(true)
    try {
      
      const res = await csrfFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [item.field]: trimmedValue })
      })
      const data = await res.json()

      if (data.success) {
        
        // Update local settings state directly
        setSettings((prev: any) => ({ ...prev, [item.field]: trimmedValue }))
        
        const now = new Date()
        const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
        const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
        setSectionItems(prev => prev.map(s =>
          s.id === id ? { ...s, value: trimmedValue, lastEdited: `${dateStr} - ${timeStr}` } : s
        ))
        setEditingSectionId(null)
        setEditingSectionValue('')
        showToastMsg(`${item.label} saved successfully!`)
      } else {
        showToastMsg(data.error || 'Failed to save')
      }
    } catch (error) {
      showToastMsg('Error saving')
    }
    setSaving(false)
  }

  const handleSectionKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveSectionItem(id)
    } else if (e.key === 'Escape') {
      cancelSectionEdit()
    }
  }

  const tabs: { id: SettingsTab; name: string }[] = [
    { id: 'branding', name: 'Branding' },
    { id: 'hero', name: 'Hero' },
    { id: 'delivery', name: 'Delivery' },
    { id: 'social', name: 'Social' },
    { id: 'legal', name: 'Legal' },
    { id: 'sections', name: 'Section Naming' }
  ]

  return (
    <div className="p-4 md:p-8 bg-white min-h-[calc(100vh-80px)]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* CSS Styles */}
      <style jsx global>{`
        .rounded-5 { border-radius: 5px !important; }
        .table-container { border: 1px solid #cbd5e1; border-radius: 5px; overflow: hidden; }
        .settings-table { width: 100%; border-collapse: collapse; }
        .settings-table th, .settings-table td { border: 1px solid #cbd5e1; }
        .settings-table tr th:first-child, .settings-table tr td:first-child { border-left: none; }
        .settings-table tr th:last-child, .settings-table tr td:last-child { border-right: none; }
        .settings-table thead tr:first-child th { border-top: none; }
        .settings-table tbody tr:last-child td { border-bottom: none; }
        .single-line {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
          display: inline-block;
        }
        .same-input {
          font-size: 16px !important;
          border: none;
          outline: none;
          background: transparent;
          text-align: center;
          width: 100%;
          padding: 0;
          color: #334155;
        }
        .same-input:focus {
          outline: none;
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
        .toggle-switch {
          position: relative;
          width: 44px;
          height: 24px;
          background-color: #cbd5e1;
          border-radius: 12px;
          cursor: pointer;
          transition: background-color 0.2s;
          display: inline-block;
        }
        .toggle-switch.active {
          background-color: #16a34a;
        }
        .toggle-switch::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background-color: white;
          border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .toggle-switch.active::after {
          transform: translateX(20px);
        }
        /* Speed control buttons */
        .speed-btn {
          width: 28px;
          height: 28px;
          border: 1px solid #d1d5db;
          background: #f9fafb;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 16px;
          font-weight: 600;
          color: #374151;
        }
        .speed-btn:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
        }
        .speed-btn:active {
          background: #d1d5db;
        }
        /* Hero image card */
        .hero-image-card {
          position: relative;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.2s;
        }
        .hero-image-card:hover {
          border-color: #16a34a;
          box-shadow: 0 4px 12px rgba(22, 163, 74, 0.15);
        }
        .hero-delete-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          background: rgba(239, 68, 68, 0.9);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s;
          font-size: 18px;
          font-weight: bold;
        }
        .hero-image-card:hover .hero-delete-btn {
          opacity: 1;
        }
        .hero-delete-btn:hover {
          background: #dc2626;
          transform: scale(1.1);
        }
        /* Animation select */
        .animation-select {
          font-size: 14px;
          border: 1px solid #d1d5db;
          padding: 6px 10px;
          border-radius: 8px;
          background: white;
          cursor: pointer;
          min-width: 120px;
        }
        .animation-select:focus {
          outline: none;
          border-color: #16a34a;
        }
      `}</style>

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90" onClick={() => setPreviewModal(false)}>
          <div className="bg-white p-2 rounded max-w-3xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewModal(false)} className="absolute -top-10 right-0 text-4xl text-white hover:text-gray-300">&times;</button>
            <img src={previewSrc} alt="Preview" className="max-w-full max-h-[80vh] object-contain" />
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Filter Tabs */}
        <div className="flex gap-3 mb-5 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-1.5 border rounded-5 text-sm font-semibold transition-all ${
                activeTab === tab.id
                  ? 'border-slate-800 text-slate-900 bg-slate-50'
                  : 'border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {/* ================= BRANDING SECTION ================= */}
        {activeTab === 'branding' && (
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Website Name</th>
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Slogan</th>
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Logo</th>
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Favicon</th>
                <th className="p-4 text-center w-1/5 font-bold uppercase text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="border border-gray-400">
              <tr>
                <td className="p-4 text-center border-r border-gray-400">
                  {!brandingEditing ? (
                    <span className="text-sm text-slate-700 single-line">{websiteName}</span>
                  ) : (
                    <input 
                      type="text"
                      value={websiteName}
                      onChange={(e) => setWebsiteName(e.target.value)}
                      className="same-input"
                      style={{ fontSize: '16px' }}
                      autoFocus
                    />
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!brandingEditing ? (
                    <span className="text-sm text-slate-700 single-line">{slogan}</span>
                  ) : (
                    <input 
                      type="text"
                      value={slogan}
                      onChange={(e) => setSlogan(e.target.value)}
                      className="same-input"
                      style={{ fontSize: '16px' }}
                    />
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!brandingEditing ? (
                    logoUrl ? (
                      <span 
                        className="text-xs text-blue-600 cursor-pointer hover:underline single-line block max-w-[150px] mx-auto"
                        onClick={() => openPreview(logoUrl)}
                        title={logoUrl}
                      >
                        {logoUrl}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">No logo</span>
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <input 
                        ref={logoInputRef}
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload} 
                        className="hidden" 
                      />
                      <button 
                        onClick={() => logoInputRef.current?.click()}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {logoUrl ? 'Change' : 'Upload'}
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!brandingEditing ? (
                    faviconUrl ? (
                      <span 
                        className="text-xs text-blue-600 cursor-pointer hover:underline single-line block max-w-[150px] mx-auto"
                        onClick={() => openPreview(faviconUrl)}
                        title={faviconUrl}
                      >
                        {faviconUrl}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">No favicon</span>
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <input 
                        ref={faviconInputRef}
                        type="file" 
                        accept="image/*"
                        onChange={handleFaviconUpload} 
                        className="hidden" 
                      />
                      <button 
                        onClick={() => faviconInputRef.current?.click()}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {faviconUrl ? 'Change' : 'Upload'}
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-4 text-center">
                  {!brandingEditing ? (
                    <div className="edit-actions">
                      <button 
                        onClick={startBrandingEdit} 
                        className="action-btn edit"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        <i className="fa-solid fa-pen text-sm"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="edit-actions">
                      <button 
                        onClick={saveBranding} 
                        disabled={saving}
                        className="action-btn save"
                        style={{ background: '#16a34a', color: 'white' }}
                      >
                        <i className="fa-solid fa-check text-sm"></i>
                      </button>
                      <button 
                        onClick={cancelBrandingEdit} 
                        disabled={saving}
                        className="action-btn cancel"
                        style={{ background: '#fee2e2', color: '#dc2626' }}
                      >
                        <i className="fa-solid fa-xmark text-sm"></i>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ================= HERO SECTION ================= */}
        {activeTab === 'hero' && (
          <>
            <table className="w-full border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Total Items</th>
                  <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Speed (ms)</th>
                  <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Animation</th>
                  <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Upload</th>
                  <th className="p-4 text-center w-1/5 font-bold uppercase text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="border border-gray-400">
                <tr>
                  <td className="p-4 text-center border-r border-gray-400">
                    <span className="text-sm text-slate-700 font-medium">{heroImages.length}</span>
                  </td>
                  <td className="p-4 text-center border-r border-gray-400">
                    {!heroEditing ? (
                      <span className="text-sm text-slate-700">{animationSpeed}ms</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          className="speed-btn" 
                          onClick={() => adjustSpeed(-500)}
                          title="Decrease 500ms"
                        >
                          −
                        </button>
                        <span className="text-sm font-medium min-w-[60px]">{animationSpeed}</span>
                        <button 
                          className="speed-btn" 
                          onClick={() => adjustSpeed(500)}
                          title="Increase 500ms"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-center border-r border-gray-400">
                    {!heroEditing ? (
                      <span className="text-sm text-slate-700 font-medium">{animationType}</span>
                    ) : (
                      <select
                        value={animationType}
                        onChange={(e) => setAnimationType(e.target.value)}
                        className="animation-select"
                      >
                        {ANIMATION_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="p-4 text-center border-r border-gray-400">
                    {heroEditing ? (
                      <div>
                        <input 
                          ref={heroInputRef}
                          type="file" 
                          multiple 
                          accept="image/*"
                          onChange={handleHeroUpload} 
                          className="hidden" 
                        />
                        <button 
                          onClick={() => heroInputRef.current?.click()}
                          className="text-sm text-blue-600 hover:underline font-medium"
                        >
                          + Add Images
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Click edit</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {!heroEditing ? (
                      <div className="edit-actions">
                        <button 
                          onClick={startHeroEdit} 
                          className="action-btn edit"
                          style={{ background: '#f1f5f9', color: '#64748b' }}
                        >
                          <i className="fa-solid fa-pen text-sm"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="edit-actions">
                        <button 
                          onClick={saveHero} 
                          disabled={saving}
                          className="action-btn save"
                          style={{ background: '#16a34a', color: 'white' }}
                        >
                          <i className="fa-solid fa-check text-sm"></i>
                        </button>
                        <button 
                          onClick={cancelHeroEdit} 
                          disabled={saving}
                          className="action-btn cancel"
                          style={{ background: '#fee2e2', color: '#dc2626' }}
                        >
                          <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Upload Progress */}
            {uploadingHero && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <i className="fa-solid fa-spinner fa-spin text-blue-500"></i>
                  <span className="text-sm text-blue-700 font-medium">
                    Uploading image {uploadProgress.current} of {uploadProgress.total}...
                  </span>
                </div>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Hero Images Preview - Only cross button, no names */}
            {heroImages.length > 0 && (
              <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                {heroImages.map((img, index) => (
                  <div key={index} className="hero-image-card aspect-video">
                    <img 
                      src={img.url} 
                      alt="Hero banner"
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => openPreview(img.url)}
                    />
                    {heroEditing && (
                      <button 
                        onClick={() => removeHeroImage(index)}
                        className="hero-delete-btn"
                        title="Remove image"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ================= DELIVERY SECTION ================= */}
        {activeTab === 'delivery' && (
          <>
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-4 text-center w-1/4 font-bold border-r border-gray-400 uppercase text-xs">Inside Dhaka</th>
                <th className="p-4 text-center w-1/4 font-bold border-r border-gray-400 uppercase text-xs">Outside Dhaka</th>
                <th className="p-4 text-center w-1/4 font-bold border-r border-gray-400 uppercase text-xs">Free Delivery Over</th>
                <th className="p-4 text-center w-1/4 font-bold uppercase text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="border border-gray-400">
              <tr>
                <td className="p-4 text-center border-r border-gray-400">
                  {!deliveryEditing ? (
                    <span className="text-sm text-slate-700">TK {insideDhaka}</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm text-slate-700">TK</span>
                      <input 
                        type="number"
                        value={insideDhaka}
                        onChange={(e) => setInsideDhaka(parseInt(e.target.value) || 0)}
                        className="same-input w-12"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!deliveryEditing ? (
                    <span className="text-sm text-slate-700">TK {outsideDhaka}</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm text-slate-700">TK</span>
                      <input 
                        type="number"
                        value={outsideDhaka}
                        onChange={(e) => setOutsideDhaka(parseInt(e.target.value) || 0)}
                        className="same-input w-12"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!deliveryEditing ? (
                    <span className="text-sm text-slate-700">TK {freeThreshold}</span>
                  ) : (
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-sm text-slate-700">TK</span>
                      <input 
                        type="number"
                        value={freeThreshold}
                        onChange={(e) => setFreeThreshold(parseInt(e.target.value) || 0)}
                        className="same-input w-16"
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  )}
                </td>
                <td className="p-4 text-center">
                  {!deliveryEditing ? (
                    <div className="edit-actions">
                      <button 
                        onClick={startDeliveryEdit} 
                        className="action-btn edit"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        <i className="fa-solid fa-pen text-sm"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="edit-actions">
                      <button 
                        onClick={saveDelivery} 
                        disabled={saving}
                        className="action-btn save"
                        style={{ background: '#16a34a', color: 'white' }}
                      >
                        <i className="fa-solid fa-check text-sm"></i>
                      </button>
                      <button 
                        onClick={cancelDeliveryEdit} 
                        disabled={saving}
                        className="action-btn cancel"
                        style={{ background: '#fee2e2', color: '#dc2626' }}
                      >
                        <i className="fa-solid fa-xmark text-sm"></i>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          {/* Free Delivery Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-2">
              <i className="ri-information-line text-blue-600 text-lg"></i>
              <div>
                <p className="text-sm text-blue-800 font-medium">Free Delivery Threshold</p>
                <p className="text-xs text-blue-600 mt-1">Orders above this amount will have FREE delivery. Set to 0 to disable free delivery.</p>
              </div>
            </div>
          </div>
          </>
        )}

        {/* ================= SOCIAL SECTION ================= */}
        {activeTab === 'social' && (
          <table className="w-full border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Phone</th>
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">WhatsApp</th>
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Facebook</th>
                <th className="p-4 text-center w-1/5 font-bold border-r border-gray-400 uppercase text-xs">Messenger</th>
                <th className="p-4 text-center w-1/5 font-bold uppercase text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="border border-gray-400">
              <tr>
                <td className="p-4 text-center border-r border-gray-400">
                  {!socialEditing ? (
                    <span className="text-sm text-slate-700 single-line">{phone || '-'}</span>
                  ) : (
                    <input 
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="same-input"
                      style={{ fontSize: '16px' }}
                      placeholder="Phone"
                    />
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!socialEditing ? (
                    <span className="text-sm text-slate-700 single-line">{whatsapp || '-'}</span>
                  ) : (
                    <input 
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="same-input"
                      style={{ fontSize: '16px' }}
                      placeholder="WhatsApp"
                    />
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!socialEditing ? (
                    <span className="text-sm text-slate-700 single-line">{facebook || '-'}</span>
                  ) : (
                    <input 
                      type="text"
                      value={facebook}
                      onChange={(e) => setFacebook(e.target.value)}
                      className="same-input"
                      style={{ fontSize: '16px' }}
                      placeholder="Facebook URL"
                    />
                  )}
                </td>
                <td className="p-4 text-center border-r border-gray-400">
                  {!socialEditing ? (
                    <span className="text-sm text-slate-700 single-line">{messenger || '-'}</span>
                  ) : (
                    <input 
                      type="text"
                      value={messenger}
                      onChange={(e) => setMessenger(e.target.value)}
                      className="same-input"
                      style={{ fontSize: '16px' }}
                      placeholder="Messenger"
                    />
                  )}
                </td>
                <td className="p-4 text-center">
                  {!socialEditing ? (
                    <div className="edit-actions">
                      <button 
                        onClick={startSocialEdit} 
                        className="action-btn edit"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        <i className="fa-solid fa-pen text-sm"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="edit-actions">
                      <button 
                        onClick={saveSocial} 
                        disabled={saving}
                        className="action-btn save"
                        style={{ background: '#16a34a', color: 'white' }}
                      >
                        <i className="fa-solid fa-check text-sm"></i>
                      </button>
                      <button 
                        onClick={cancelSocialEdit} 
                        disabled={saving}
                        className="action-btn cancel"
                        style={{ background: '#fee2e2', color: '#dc2626' }}
                      >
                        <i className="fa-solid fa-xmark text-sm"></i>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* ================= LEGAL SECTION ================= */}
        {activeTab === 'legal' && (
          <>
            <table className="w-full border-collapse border border-gray-400">
              <thead>
                <tr className="bg-gray-50">
                  {legalPages.map((page) => (
                    <th key={page.id} className="p-4 text-center w-1/4 font-bold border-r border-gray-400 last:border-r-0 uppercase text-xs">
                      {page.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="border border-gray-400">
                <tr>
                  {legalPages.map((page) => (
                    <td key={page.id} className="p-4 text-center border-r border-gray-400 last:border-r-0">
                      <div 
                        onClick={() => setEditingLegalId(editingLegalId === page.id ? null : page.id)}
                        className="text-sm text-blue-600 cursor-pointer hover:underline"
                      >
                        {page.content ? 'Content Written Here' : 'Click to Add'}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* Dropdown Editor Area */}
            {editingLegalId && (
              <div className="mt-4 p-6 border border-gray-400 bg-white shadow-sm">
                <div className="flex items-center gap-4 mb-3 border-b pb-2">
                  <span className="text-sm font-bold uppercase text-gray-700">{getActivePageName()}</span>
                  <button 
                    onClick={saveLegalPage}
                    disabled={saving}
                    className="text-sm font-bold text-blue-600 hover:underline"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <textarea
                  value={getActivePageContent()}
                  onChange={(e) => updateActivePageContent(e.target.value)}
                  className="w-full h-48 p-3 border border-gray-300 rounded"
                  style={{ fontSize: '16px' }}
                  placeholder={`Enter ${getActivePageName()} content...`}
                />
              </div>
            )}
          </>
        )}

        {/* ================= SECTION NAMING ================= */}
        {activeTab === 'sections' && (
          <div className="table-container">
            <table className="settings-table">
              <thead className="bg-slate-50">
                <tr className="text-[11px] uppercase tracking-widest text-slate-500">
                  <th className="px-6 py-4 text-left font-bold">Section Name</th>
                  <th className="px-6 py-4 text-center font-bold">Value</th>
                  <th className="px-6 py-4 text-center font-bold">Last Edited</th>
                  <th className="px-6 py-4 text-center font-bold w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {sectionItems.map((item) => {
                  const isEditing = editingSectionId === item.id
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/30">
                      {/* Section Name */}
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      </td>
                      {/* Value */}
                      <td className="px-6 py-4 text-center">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingSectionValue}
                            onChange={(e) => setEditingSectionValue(e.target.value)}
                            onKeyDown={(e) => handleSectionKeyDown(e, item.id)}
                            className="same-input text-center"
                            style={{ fontSize: '16px' }}
                            autoFocus
                            disabled={saving}
                          />
                        ) : (
                          <span className="text-sm text-slate-600">{item.value}</span>
                        )}
                      </td>
                      {/* Last Edited */}
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs text-slate-400 font-medium">{item.lastEdited}</span>
                      </td>
                      {/* Action */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveSectionItem(item.id)}
                                disabled={saving || (item.field.includes('Name') && !editingSectionValue.trim())}
                                className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                                style={{ background: '#16a34a', color: 'white' }}
                                title="Save"
                              >
                                <i className="fa-solid fa-check text-sm"></i>
                              </button>
                              <button
                                onClick={cancelSectionEdit}
                                disabled={saving}
                                className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                                style={{ background: '#fee2e2', color: '#dc2626' }}
                                title="Cancel"
                              >
                                <i className="fa-solid fa-xmark text-sm"></i>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startSectionEdit(item)}
                              disabled={saving}
                              className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                              style={{ background: '#f1f5f9', color: '#64748b' }}
                              title="Edit"
                            >
                              <i className="fa-solid fa-pen text-sm"></i>
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
        )}
      </div>
    </div>
  )
}

export default SettingsView
