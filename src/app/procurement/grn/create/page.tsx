// ============================================================
// JEET ERP — Record Goods Receipt Note (GRN) Workbench
// Route: /procurement/grn/create
// Mobile-First, Offline-Tolerant, AI-Assisted Gate Inspector
// ============================================================

'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { poService } from '@/services/poService';
import { grnService } from '@/services/grnService';
import { stockService } from '@/services/stockService';
import { runUploadPipeline } from '@/lib/document-upload-service';
import { offerExtractionService } from '@/lib/offer-extraction-service';
import { ALL_GRN_LOCATIONS, ALL_GRN_REJECTION_REASONS, GRN_LOCATION_LABELS, GRN_REJECTION_REASONS } from '@/constants/po.constants';
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  RefreshCw, 
  Upload, 
  Plus, 
  Minus, 
  Camera, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  Info, 
  Trash2,
  CheckCircle,
  Smartphone,
  Wifi,
  WifiOff
} from 'lucide-react';
import '@/app/procurement/comparisons/comparisons.css';

export default function RecordGRNPage() {
  return (
    <Suspense fallback={
      <div className="comp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading receipt workbench...</p>
        </div>
      </div>
    }>
      <GRNFormContent />
    </Suspense>
  );
}

interface ItemRejectionPhoto {
  file: File;
  previewUrl: string;
}

interface ReceiptItemState {
  po_item_id: string;
  description: string;
  brand: string;
  unit: string;
  system?: string;
  unit_price?: number;
  ordered_qty: number;
  qty_already_received: number;
  qty_received: number;
  qty_rejected: number;
  rejection_reason: string | null;
  notes: string;
  rejection_photos: ItemRejectionPhoto[];
}

function GRNFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const poIdParam = searchParams.get('po_id');

  // Lookup options
  const [activePOs, setActivePOs] = useState<any[]>([]);
  const [selectedPO, setSelectedPO] = useState<any | null>(null);
  const [loadingPOs, setLoadingPOs] = useState(true);

  // Form states
  const [poId, setPoId] = useState<string>('');
  const [deliveryNoteRef, setDeliveryNoteRef] = useState<string>('');
  const [deliveryNoteFile, setDeliveryNoteFile] = useState<File | null>(null);
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [location, setLocation] = useState<'SITE' | 'STORE'>('SITE');
  const [notes, setNotes] = useState<string>('');
  const [isStockItem, setIsStockItem] = useState<boolean>(false);
  const [stockLocations, setStockLocations] = useState<any[]>([]);
  const [stockLocationId, setStockLocationId] = useState<string>('');

  // Items receipt states
  const [receiptItems, setReceiptItems] = useState<ReceiptItemState[]>([]);

  useEffect(() => {
    async function loadLocations() {
      try {
        const locs = await stockService.getLocations();
        setStockLocations(locs.filter(l => l.is_active));
      } catch (err) {
        console.error('Failed to load stock locations:', err);
      }
    }
    loadLocations();
  }, []);

  // Page States
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [extractingDNRef, setExtractingDNRef] = useState(false);
  const [dnExtractedByAI, setDNExtractedByAI] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [confirmOverDelivery, setConfirmOverDelivery] = useState(false);
  const [hasOverDeliveryWarning, setHasOverDeliveryWarning] = useState(false);

  // Connection status
  const [isOnline, setIsOnline] = useState(true);
  const [draftRestored, setDraftRestored] = useState(false);

  // Hidden file input refs for rejection camera
  const cameraInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  // Monitor network connection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 1. Fetch active PO list
  useEffect(() => {
    async function loadPOs() {
      try {
        setLoadingPOs(true);
        const { data, error } = await supabase
          .from('purchase_orders')
          .select('id, po_number, supplier_name, project_id, total')
          .in('status', ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_DELIVERED'])
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setActivePOs(data || []);

        if (poIdParam) {
          setPoId(poIdParam);
          handlePOSelect(poIdParam);
        } else {
          // Check if there is an unsaved draft in localStorage
          const draftStr = localStorage.getItem('jeet_grn_draft');
          if (draftStr) {
            try {
              const draft = JSON.parse(draftStr);
              if (draft && draft.poId) {
                setPoId(draft.poId);
                setDeliveryNoteRef(draft.deliveryNoteRef || '');
                setVehicleNo(draft.vehicleNo || '');
                setDriverName(draft.driverName || '');
                setLocation(draft.location || 'SITE');
                setNotes(draft.notes || '');
                
                // Fetch details for that PO
                const poDetails = await poService.getPODetail(draft.poId);
                setSelectedPO(poDetails);
                
                // Map items combining PO details with draft values
                const initialized = (poDetails.items || []).map(it => {
                  const draftItem = (draft.items || []).find((di: any) => di.po_item_id === it.id);
                  return {
                    po_item_id: it.id,
                    description: it.description,
                    brand: it.brand || '',
                    unit: it.unit,
                    ordered_qty: Number(it.quantity) || 0,
                    qty_already_received: Number(it.qty_received) || 0,
                    qty_received: draftItem ? Number(draftItem.qty_received) : 0,
                    qty_rejected: draftItem ? Number(draftItem.qty_rejected) : 0,
                    rejection_reason: draftItem ? (draftItem.rejection_reason || null) : null,
                    notes: draftItem ? (draftItem.notes || '') : '',
                    rejection_photos: [] // Files can't be stored in localStorage
                  };
                });
                
                setReceiptItems(initialized);
                setDraftRestored(true);
              }
            } catch (e) {
              console.error('Failed to parse GRN draft:', e);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load active POs:', err);
      } finally {
        setLoadingPOs(false);
      }
    }

    loadPOs();
  }, [poIdParam]);

  // 2. Draft Autosave Effect
  useEffect(() => {
    if (!poId) return;
    const draftData = {
      poId,
      deliveryNoteRef,
      vehicleNo,
      driverName,
      location,
      notes,
      items: receiptItems.map(it => ({
        po_item_id: it.po_item_id,
        qty_received: it.qty_received,
        qty_rejected: it.qty_rejected,
        rejection_reason: it.rejection_reason,
        notes: it.notes
      }))
    };
    localStorage.setItem('jeet_grn_draft', JSON.stringify(draftData));
  }, [poId, deliveryNoteRef, vehicleNo, driverName, location, notes, receiptItems]);

  const clearDraft = () => {
    localStorage.removeItem('jeet_grn_draft');
    setDraftRestored(false);
    setPoId('');
    setSelectedPO(null);
    setDeliveryNoteRef('');
    setDeliveryNoteFile(null);
    setVehicleNo('');
    setDriverName('');
    setLocation('SITE');
    setNotes('');
    setReceiptItems([]);
    setErrorMessages([]);
    setDNExtractedByAI(false);
  };

  // 3. Fetch selected PO details and items
  const handlePOSelect = async (selectedPoId: string) => {
    setPoId(selectedPoId);
    if (!selectedPoId) {
      setSelectedPO(null);
      setReceiptItems([]);
      return;
    }

    try {
      const poDetails = await poService.getPODetail(selectedPoId);
      setSelectedPO(poDetails);
      
      // Initialize items receipt form
      const initialized = (poDetails.items || []).map(it => ({
        po_item_id: it.id,
        description: it.description,
        brand: it.brand || '',
        unit: it.unit,
        system: (it as any).system || '',
        unit_price: Number((it as any).unit_price) || 0,
        ordered_qty: Number(it.quantity) || 0,
        qty_already_received: Number(it.qty_received) || 0,
        qty_received: 0,
        qty_rejected: 0,
        rejection_reason: null,
        notes: '',
        rejection_photos: []
      }));

      setReceiptItems(initialized);
      setConfirmOverDelivery(false);
      setHasOverDeliveryWarning(false);
    } catch (err) {
      console.error('Failed to load PO items:', err);
    }
  };

  // 4. Stepper values and inputs changes
  const handleItemValueChange = (idx: number, field: keyof ReceiptItemState, value: any) => {
    setReceiptItems(prev => {
      const next = prev.map((item, i) => {
        if (i === idx) {
          const updated = { ...item, [field]: value };
          
          // If rejected quantity is cleared or set to 0, clear rejection reason
          if (field === 'qty_rejected' && Number(value) === 0) {
            updated.rejection_reason = null;
            // Free object URLs to avoid memory leaks
            updated.rejection_photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
            updated.rejection_photos = [];
          }
          // If rejected quantity is set but no reason is selected, default to DAMAGED
          if (field === 'qty_rejected' && Number(value) > 0 && !updated.rejection_reason) {
            updated.rejection_reason = 'DAMAGED';
          }

          return updated;
        }
        return item;
      });

      // Recalculate if there is any over-delivery exceeding 2% tolerance
      const overDelivered = next.some(it => {
        const nextTotalRec = it.qty_already_received + Number(it.qty_received);
        return nextTotalRec > it.ordered_qty * 1.02;
      });
      setHasOverDeliveryWarning(overDelivered);

      return next;
    });
  };

  // 5. Receive All Shortcuts
  const receiveAllOutstanding = () => {
    setReceiptItems(prev => {
      const next = prev.map(item => {
        const outstanding = Math.max(0, item.ordered_qty - item.qty_already_received);
        return {
          ...item,
          qty_received: outstanding,
          qty_rejected: 0,
          rejection_reason: null
        };
      });

      const overDelivered = next.some(it => {
        const nextTotalRec = it.qty_already_received + Number(it.qty_received);
        return nextTotalRec > it.ordered_qty * 1.02;
      });
      setHasOverDeliveryWarning(overDelivered);

      return next;
    });
  };

  const receiveItemOutstanding = (idx: number) => {
    const item = receiptItems[idx];
    const outstanding = Math.max(0, item.ordered_qty - item.qty_already_received);
    handleItemValueChange(idx, 'qty_received', outstanding);
    handleItemValueChange(idx, 'qty_rejected', 0);
  };

  // 6. Camera Photo Selection for a specific line item
  const handleCapturePhoto = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: ItemRejectionPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      newPhotos.push({
        file,
        previewUrl: URL.createObjectURL(file)
      });
    }

    setReceiptItems(prev => prev.map((item, i) => {
      if (i === idx) {
        return {
          ...item,
          rejection_photos: [...item.rejection_photos, ...newPhotos]
        };
      }
      return item;
    }));
  };

  const removePhoto = (idx: number, photoIdx: number) => {
    setReceiptItems(prev => prev.map((item, i) => {
      if (i === idx) {
        const updatedPhotos = [...item.rejection_photos];
        // Revoke URL to prevent memory leaks
        URL.revokeObjectURL(updatedPhotos[photoIdx].previewUrl);
        updatedPhotos.splice(photoIdx, 1);
        return {
          ...item,
          rejection_photos: updatedPhotos
        };
      }
      return item;
    }));
  };

  // 7. Delivery Note upload with AI Extraction
  const handleDNFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDeliveryNoteFile(file);
    setExtractingDNRef(true);
    setDNExtractedByAI(false);

    try {
      // Extract Delivery Note Ref
      const ref = await offerExtractionService.extractDeliveryNoteRef(file);
      if (ref) {
        setDeliveryNoteRef(ref);
        setDNExtractedByAI(true);
      }
    } catch (err) {
      console.error('Failed to extract Delivery Note Ref:', err);
    } finally {
      setExtractingDNRef(false);
    }
  };

  // 8. Submit GRN
  const handleRecordGRN = async () => {
    try {
      setSaving(true);
      setErrorMessages([]);

      // Offline Validation
      if (!navigator.onLine) {
        setErrorMessages(['You are currently offline. Please wait until your connection is restored to submit to the database. Your input draft is safely saved.']);
        setSaving(false);
        return;
      }

      // Validations
      const errors = [];
      if (!poId) errors.push('Please select a Purchase Order.');
      if (!deliveryNoteRef || deliveryNoteRef.trim() === '') errors.push('Please enter the Delivery Note Ref Number.');
      if (!deliveryNoteFile && !deliveryNoteRef) errors.push('Please attach a Delivery Note file.');
      if (isStockItem && !stockLocationId) {
        errors.push('Please select a Destination Warehouse for stock routing.');
      }

      let overDeliveryExceeded = false;
      receiptItems.forEach((it, idx) => {
        const nextTotalRec = it.qty_already_received + Number(it.qty_received);
        if (nextTotalRec > it.ordered_qty * 1.02) {
          overDeliveryExceeded = true;
          if (!confirmOverDelivery) {
            errors.push(
              `Line ${idx + 1} (${it.description}) - Over-delivery Gate: Total received quantity (${nextTotalRec}) exceeds ordered quantity (${it.ordered_qty}) by more than 2% tolerance limit. Check the confirmation authorization box at the bottom to bypass.`
            );
          }
        }
      });

      if (errors.length > 0) {
        setErrorMessages(errors);
        setSaving(false);
        return;
      }

      // A. Upload delivery note document if present
      let dnDocumentId = null;
      if (deliveryNoteFile) {
        setUploadProgress(true);
        try {
          const doc = await runUploadPipeline(
            deliveryNoteFile,
            'PROJECT',
            selectedPO.project_id || undefined,
            ['GRN', 'DELIVERY_NOTE', selectedPO.po_number]
          );
          dnDocumentId = doc.id;
        } catch (uploadErr: any) {
          console.error('DMS delivery note upload failed:', uploadErr);
          setErrorMessages([`DMS file upload failed: ${uploadErr.message || 'Check storage connection'}`]);
          setSaving(false);
          setUploadProgress(false);
          return;
        }
        setUploadProgress(false);
      }

      // B. Upload rejection photos for any items
      const itemsToLog = [];
      setUploadProgress(true);
      
      for (const it of receiptItems) {
        const hasQuantities = Number(it.qty_received) > 0 || Number(it.qty_rejected) > 0;
        if (!hasQuantities) continue;

        const photoPaths: string[] = [];
        if (Number(it.qty_rejected) > 0 && it.rejection_photos.length > 0) {
          for (let pIdx = 0; pIdx < it.rejection_photos.length; pIdx++) {
            const photoFile = it.rejection_photos[pIdx].file;
            try {
              const doc = await runUploadPipeline(
                photoFile,
                'PROJECT',
                selectedPO.project_id || undefined,
                ['GRN_REJECTION_PHOTO', selectedPO.po_number, it.description]
              );
              photoPaths.push(doc.storage_path);
            } catch (err: any) {
              console.error(`Rejection photo upload failed for item ${it.description}:`, err);
              // Non-blocking but warn
            }
          }
        }

        itemsToLog.push({
          po_item_id: it.po_item_id,
          qty_received: Number(it.qty_received),
          qty_rejected: Number(it.qty_rejected),
          rejection_reason: Number(it.qty_rejected) > 0 ? it.rejection_reason : null,
          rejection_photos: photoPaths.length > 0 ? photoPaths : null,
          notes: it.notes || null
        });
      }

      setUploadProgress(false);

      if (itemsToLog.length === 0) {
        setErrorMessages(['Please enter quantities received or rejected for at least one item.']);
        setSaving(false);
        return;
      }

      // C. Save GRN transaction
      const grnHeader = {
        po_id: poId,
        delivery_note_ref: deliveryNoteRef,
        delivery_note_document_id: dnDocumentId,
        vehicle_no: vehicleNo || null,
        driver_name: driverName || null,
        location,
        notes: notes || null,
        is_stock_item: isStockItem,
        stock_location_id: isStockItem ? stockLocationId : null
      };

      await grnService.recordGRN(grnHeader as any, itemsToLog, confirmOverDelivery);
      
      // Clear draft on successful submit
      localStorage.removeItem('jeet_grn_draft');
      router.push('/procurement/grn');

    } catch (err: any) {
      console.error('Error logging GRN:', err);
      setErrorMessages([err.message || 'An error occurred while saving the goods receipt.']);
    } finally {
      setSaving(false);
      setUploadProgress(false);
    }
  };

  return (
    <div className="comp-container" style={{ paddingBottom: '5rem' }}>
      {/* Network / Connection Alert */}
      {!isOnline && (
        <div className="quote-card" style={{ borderLeft: '4px solid var(--warning)', background: 'rgba(245, 158, 11, 0.05)', padding: '0.8rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <WifiOff size={16} style={{ color: 'var(--warning)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong>Offline Mode Active:</strong> You are disconnected from the network. You can inspect materials and details will be saved to your device cache, but you cannot submit until online.
          </span>
        </div>
      )}

      {draftRestored && (
        <div className="quote-card" style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(0, 229, 160, 0.05)', padding: '0.8rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Smartphone size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Restored unsaved inspection progress from your phone's memory.
            </span>
          </div>
          <button 
            onClick={clearDraft} 
            className="quote-btn quote-btn-secondary" 
            style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem', borderColor: 'rgba(255,255,255,0.1)' }}
          >
            Clear Draft
          </button>
        </div>
      )}

      {/* Header */}
      <header className="comp-header" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/procurement/grn" className="quote-btn quote-btn-secondary" style={{ padding: '0.5rem', minWidth: '40px', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="comp-header-title">Gate Receipt (GRN) Workbench</h1>
            <p className="comp-header-subtitle">Inspect deliveries, capture photos, and verify specifications one-handed on site</p>
          </div>
        </div>
        
        <button 
          className="quote-btn quote-btn-primary" 
          onClick={handleRecordGRN}
          disabled={saving || loadingPOs}
          style={{ minHeight: '44px', padding: '0.6rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {saving ? (
            <RefreshCw size={16} className="spinner" />
          ) : (
            <Save size={16} />
          )}
          {uploadProgress ? 'Uploading Files...' : 'Log Goods Receipt'}
        </button>
      </header>

      {/* Errors */}
      {errorMessages.length > 0 && (
        <div className="quote-card" style={{ borderLeft: '4px solid var(--error)', background: 'rgba(239, 68, 68, 0.05)', padding: '1.2rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem' }}>Inspection Blocked</h4>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {errorMessages.map((err, i) => <li key={i} style={{ marginBottom: '0.2rem' }}>{err}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {loadingPOs ? (
        <div className="quote-card" style={{ padding: '4rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Loading active Purchase Orders...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Coordinates Grid */}
          <div className="quote-card quote-form-grid">
            
            {/* Left Column: PO and Delivery note reference */}
            <div className="flex flex-col gap-4">
              <h3 className="quote-card-title">Receipt Coordinates</h3>
              
              <div className="quote-form-group">
                <label>Select Purchase Order (LPO) *</label>
                <select 
                  className="quote-form-input"
                  style={{ height: '44px' }}
                  value={poId}
                  onChange={(e) => handlePOSelect(e.target.value)}
                >
                  <option value="">-- Tap to Choose Active LPO --</option>
                  {activePOs.map(po => (
                    <option key={po.id} value={po.id}>{po.po_number} - {po.supplier_name}</option>
                  ))}
                </select>
              </div>

              <div className="quote-form-group">
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Supplier Delivery Note Ref *</span>
                  {extractingDNRef && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <RefreshCw size={10} className="spinner" /> AI Extracting...
                    </span>
                  )}
                  {dnExtractedByAI && !extractingDNRef && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Sparkles size={10} /> Extracted by AI
                    </span>
                  )}
                </label>
                <input 
                  type="text" 
                  className="quote-form-input"
                  style={{ height: '44px' }}
                  placeholder="e.g. DN-92813"
                  value={deliveryNoteRef}
                  onChange={(e) => {
                    setDeliveryNoteRef(e.target.value);
                    if (dnExtractedByAI) setDNExtractedByAI(false); // User edited manually
                  }}
                />
              </div>

              <div className="quote-form-group">
                <label>Offloading Point</label>
                <div className="flex gap-6 mt-1">
                  {ALL_GRN_LOCATIONS.map(loc => (
                    <label key={loc} style={{ cursor: 'pointer' }} className="flex items-center gap-2 text-sm">
                      <input 
                        type="radio" 
                        name="location" 
                        value={loc}
                        checked={location === loc}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                        onChange={() => setLocation(loc)}
                      />
                      {GRN_LOCATION_LABELS[loc]}
                    </label>
                  ))}
                </div>
              </div>

              {/* Stock Routing Options */}
              <div className="mt-2 border-t border-white/5 pt-4">
                <label style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }} className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox"
                    checked={isStockItem}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                    onChange={(e) => {
                      setIsStockItem(e.target.checked);
                      if (e.target.checked) {
                        setLocation('STORE');
                      }
                    }}
                  />
                  Route to Store Inventory (Stock Item)
                </label>
                <p className="text-xs text-slate-400 ml-7 mt-1">
                  Check this if materials should be registered in inventory instead of expensed directly to the project.
                </p>

                {isStockItem && (
                  <div className="ml-7 mt-3 quote-form-group">
                    <label>Destination Warehouse / Stock Location *</label>
                    <select
                      className="quote-form-input"
                      style={{ height: '44px' }}
                      value={stockLocationId || ''}
                      onChange={(e) => setStockLocationId(e.target.value)}
                    >
                      <option value="">-- Choose Stock Destination --</option>
                      {stockLocations.map(loc => (
                        <option key={loc.id} value={loc.id}>
                          {loc.location_code} — {loc.name} ({loc.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Logistics and Delivery Note Capture */}
            <div className="flex flex-col gap-4">
              <h3 className="quote-card-title">Logistics & DMS Capture</h3>
              
              <div className="quote-form-grid" style={{ gap: '1rem' }}>
                <div className="quote-form-group">
                  <label>Driver Name</label>
                  <input 
                    type="text" 
                    className="quote-form-input"
                    style={{ height: '44px' }}
                    placeholder="Full Name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                  />
                </div>
                <div className="quote-form-group">
                  <label>Vehicle Plate No</label>
                  <input 
                    type="text" 
                    className="quote-form-input"
                    style={{ height: '44px' }}
                    placeholder="e.g. DXB A 2918"
                    value={vehicleNo}
                    onChange={(e) => setVehicleNo(e.target.value)}
                  />
                </div>
              </div>

              {/* Delivery note file/camera picker */}
              <div className="quote-form-group">
                <label>Upload / Scan Delivery Note (PDF / Photo) *</label>
                <div className="relative mt-1">
                  <label 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '100px',
                      border: '2px dashed var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.01)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      padding: '1rem',
                      transition: 'var(--transition-fast)'
                    }}
                    className="dn-upload-label hover:border-emerald-400 hover:bg-white/[0.02]"
                  >
                    <Upload size={24} style={{ marginBottom: '0.4rem', color: 'var(--text-muted)' }} />
                    {deliveryNoteFile ? (
                      <span className="text-emerald-400 font-semibold text-center word-break-all">
                        {deliveryNoteFile.name}
                      </span>
                    ) : (
                      <span className="text-center">Tap to take photo or choose file</span>
                    )}
                    <input 
                      type="file" 
                      style={{ display: 'none' }}
                      accept="application/pdf,image/*"
                      onChange={handleDNFileSelect}
                    />
                  </label>
                </div>
              </div>

              <div className="quote-form-group">
                <label>General Inspection Remarks</label>
                <textarea 
                  className="quote-form-textarea"
                  style={{ minHeight: '60px' }}
                  placeholder="Overall notes about shipment condition..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Line Item Inspections */}
          {selectedPO && (
            <div className="quote-card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '1.2rem' }}>
                <h3 className="quote-card-title" style={{ margin: 0 }}>Line Item Inspection Ledger</h3>
                <button
                  type="button"
                  className="quote-btn quote-btn-secondary"
                  onClick={receiveAllOutstanding}
                  style={{ minHeight: '38px', padding: '0 1rem', fontSize: '0.8rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
                >
                  Receive All Outstanding
                </button>
              </div>

              {/* 1. DESKTOP VIEW (hidden on mobile) */}
              <div className="hidden md:block quote-table-wrap">
                <table className="quote-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Line</th>
                      <th>Material Specification</th>
                      <th style={{ width: '110px' }}>System / Category</th>
                      <th style={{ width: '110px' }}>Brand</th>
                      <th style={{ width: '60px' }}>Unit</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Unit Price</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Ordered</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Prev Rec.</th>
                      <th style={{ width: '150px', textAlign: 'center' }}>Received *</th>
                      <th style={{ width: '150px', textAlign: 'center' }}>Rejected *</th>
                      <th style={{ width: '120px' }}>Shortcut</th>
                      <th>Inspection Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptItems.map((it, idx) => {
                      const outstanding = Math.max(0, it.ordered_qty - it.qty_already_received);
                      const showsRejectionOptions = Number(it.qty_rejected) > 0;
                      
                      return (
                        <Suspense key={it.po_item_id}>
                          <tr>
                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 500 }}>{it.description}</div>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{it.system || '-'}</td>
                            <td>{it.brand || '-'}</td>
                            <td>{it.unit}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{it.unit_price ? it.unit_price.toFixed(2) : '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.ordered_qty}</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{it.qty_already_received}</td>
                            
                            {/* Received Qty with Stepper */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                                <button 
                                  type="button" 
                                  onClick={() => handleItemValueChange(idx, 'qty_received', Math.max(0, Number(it.qty_received) - 1))}
                                  style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                                >
                                  <Minus size={12} />
                                </button>
                                <input 
                                  type="number" 
                                  className="quote-filter-input" 
                                  style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', height: '30px', margin: 0, padding: 0, fontFamily: 'var(--font-mono)' }}
                                  value={it.qty_received}
                                  onChange={(e) => handleItemValueChange(idx, 'qty_received', Number(e.target.value) || 0)}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => handleItemValueChange(idx, 'qty_received', Number(it.qty_received) + 1)}
                                  style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>

                            {/* Rejected Qty with Stepper */}
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px', background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                                <button 
                                  type="button" 
                                  onClick={() => handleItemValueChange(idx, 'qty_rejected', Math.max(0, Number(it.qty_rejected) - 1))}
                                  style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                                >
                                  <Minus size={12} />
                                </button>
                                <input 
                                  type="number" 
                                  className="quote-filter-input" 
                                  style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'center', height: '30px', margin: 0, padding: 0, fontFamily: 'var(--font-mono)' }}
                                  value={it.qty_rejected}
                                  onChange={(e) => handleItemValueChange(idx, 'qty_rejected', Number(e.target.value) || 0)}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => handleItemValueChange(idx, 'qty_rejected', Number(it.qty_rejected) + 1)}
                                  style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer' }}
                                >
                                  <Plus size={12} />
                                </button>
                              </div>
                            </td>

                            <td>
                              <button 
                                type="button" 
                                className="quote-btn quote-btn-secondary" 
                                style={{ padding: '0.2rem 0.5rem', width: '100%', fontSize: '0.75rem', borderColor: 'rgba(255,255,255,0.06)' }}
                                onClick={() => receiveItemOutstanding(idx)}
                              >
                                Receive {outstanding}
                              </button>
                            </td>

                            <td>
                              <input 
                                type="text" 
                                className="quote-filter-input" 
                                style={{ width: '100%', padding: '0.3rem 0.5rem' }}
                                placeholder="Specs verified / item notes..."
                                value={it.notes}
                                onChange={(e) => handleItemValueChange(idx, 'notes', e.target.value)}
                              />
                            </td>
                          </tr>

                          {/* Rejection Details Row (Desktop) */}
                          {showsRejectionOptions && (
                            <tr style={{ background: 'rgba(239, 68, 68, 0.02)' }}>
                              <td colSpan={12} style={{ padding: '1rem', borderTop: 'none', borderBottom: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
                                  
                                  <div style={{ flex: 1, minWidth: '200px' }}>
                                    <label className="quote-input-label" style={{ color: 'var(--error)' }}>Rejection Reason *</label>
                                    <select 
                                      className="quote-filter-input" 
                                      style={{ width: '100%', marginTop: '0.2rem' }}
                                      value={it.rejection_reason || 'DAMAGED'}
                                      onChange={(e) => handleItemValueChange(idx, 'rejection_reason', e.target.value)}
                                    >
                                      {ALL_GRN_REJECTION_REASONS.map(reason => (
                                        <option key={reason} value={reason}>{GRN_REJECTION_REASONS[reason]}</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div style={{ flex: 2, minWidth: '300px' }}>
                                    <label className="quote-input-label" style={{ color: 'var(--error)' }}>
                                      Rejection Evidence Photos (DMS filing)
                                    </label>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                      {/* Camera Evidence Button */}
                                      <button
                                        type="button"
                                        onClick={() => cameraInputRefs.current[`${idx}-camera`]?.click()}
                                        className="quote-btn"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                      >
                                        <Camera size={14} /> Capture Photo
                                      </button>
                                      <input 
                                        type="file"
                                        ref={el => { cameraInputRefs.current[`${idx}-camera`] = el }}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        capture="environment"
                                        multiple
                                        onChange={(e) => handleCapturePhoto(idx, e)}
                                      />

                                      {/* File Browse Evidence Button */}
                                      <button
                                        type="button"
                                        onClick={() => cameraInputRefs.current[`${idx}-file`]?.click()}
                                        className="quote-btn quote-btn-secondary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                                      >
                                        <Upload size={14} /> Choose File
                                      </button>
                                      <input 
                                        type="file"
                                        ref={el => { cameraInputRefs.current[`${idx}-file`] = el }}
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleCapturePhoto(idx, e)}
                                      />

                                      {/* Image Previews */}
                                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {it.rejection_photos.map((p, pIdx) => (
                                          <div key={pIdx} style={{ position: 'relative', width: '50px', height: '50px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <img src={p.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                                            <button 
                                              type="button" 
                                              onClick={() => removePhoto(idx, pIdx)}
                                              style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.8)', border: 'none', color: '#ef4444', padding: '0.1rem', cursor: 'pointer', borderRadius: '0 0 0 4px' }}
                                            >
                                              <Trash2 size={10} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </Suspense>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 2. MOBILE-FIRST STACKED CARDS VIEW (hidden on desktop) */}
              <div className="block md:hidden" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {receiptItems.map((it, idx) => {
                  const outstanding = Math.max(0, it.ordered_qty - it.qty_already_received);
                  const showsRejectionOptions = Number(it.qty_rejected) > 0;
                  
                  return (
                    <div 
                      key={it.po_item_id} 
                      className="quote-card" 
                      style={{ 
                        margin: 0, 
                        padding: '1.2rem', 
                        borderLeft: showsRejectionOptions ? '4px solid var(--error)' : '4px solid var(--primary)',
                        background: showsRejectionOptions ? 'rgba(239, 68, 68, 0.01)' : 'rgba(255, 255, 255, 0.01)'
                      }}
                    >
                      {/* Material Spec & Brand */}
                      <div style={{ marginBottom: '0.8rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.98rem', color: '#fff', lineHeight: '1.3' }}>{it.description}</div>
                        <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem' }}>
                          <span>Brand: <strong>{it.brand || 'N/A'}</strong></span>
                          <span>Unit: <strong>{it.unit}</strong></span>
                        </div>
                      </div>

                      {/* Quantities Info */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem' }}>
                        <div>Ordered Qty: <strong style={{ color: '#fff' }}>{it.ordered_qty}</strong></div>
                        <div>Prev Received: <strong style={{ color: 'var(--text-muted)' }}>{it.qty_already_received}</strong></div>
                      </div>

                      {/* Received Qty Stepper */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Quantity Received</span>
                          <button 
                            type="button"
                            onClick={() => receiveItemOutstanding(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Receive Outstanding ({outstanding})
                          </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button 
                            type="button" 
                            onClick={() => handleItemValueChange(idx, 'qty_received', Math.max(0, Number(it.qty_received) - 1))}
                            style={{ width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer' }}
                          >
                            <Minus size={16} />
                          </button>
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ flex: 1, height: '46px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-mono)' }}
                            value={it.qty_received}
                            onChange={(e) => handleItemValueChange(idx, 'qty_received', Number(e.target.value) || 0)}
                          />
                          <button 
                            type="button" 
                            onClick={() => handleItemValueChange(idx, 'qty_received', Number(it.qty_received) + 1)}
                            style={{ width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer' }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Rejected Qty Stepper */}
                      <div style={{ marginBottom: '1rem' }}>
                        <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Quantity Rejected</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button 
                            type="button" 
                            onClick={() => handleItemValueChange(idx, 'qty_rejected', Math.max(0, Number(it.qty_rejected) - 1))}
                            style={{ width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer' }}
                          >
                            <Minus size={16} />
                          </button>
                          <input 
                            type="number" 
                            className="quote-filter-input" 
                            style={{ flex: 1, height: '46px', textAlign: 'center', fontSize: '1.1rem', fontWeight: 700, margin: 0, color: showsRejectionOptions ? 'var(--error)' : 'inherit', fontFamily: 'var(--font-mono)' }}
                            value={it.qty_rejected}
                            onChange={(e) => handleItemValueChange(idx, 'qty_rejected', Number(e.target.value) || 0)}
                          />
                          <button 
                            type="button" 
                            onClick={() => handleItemValueChange(idx, 'qty_rejected', Number(it.qty_rejected) + 1)}
                            style={{ width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', color: '#fff', cursor: 'pointer' }}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Remarks */}
                      <div style={{ marginBottom: showsRejectionOptions ? '1rem' : 0 }}>
                        <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Inspection remarks for this item</span>
                        <input 
                          type="text" 
                          className="quote-filter-input" 
                          style={{ width: '100%', height: '40px', padding: '0 0.6rem' }}
                          placeholder="Verified specs / notes..."
                          value={it.notes}
                          onChange={(e) => handleItemValueChange(idx, 'notes', e.target.value)}
                        />
                      </div>

                      {/* Rejection Evidence Details (Mobile) */}
                      {showsRejectionOptions && (
                        <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.15)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                          <div>
                            <label className="quote-input-label" style={{ color: 'var(--error)', fontSize: '0.8rem' }}>Rejection Reason *</label>
                            <select 
                              className="quote-filter-input" 
                              style={{ width: '100%', height: '44px', marginTop: '0.2rem' }}
                              value={it.rejection_reason || 'DAMAGED'}
                              onChange={(e) => handleItemValueChange(idx, 'rejection_reason', e.target.value)}
                            >
                              {ALL_GRN_REJECTION_REASONS.map(reason => (
                                <option key={reason} value={reason}>{GRN_REJECTION_REASONS[reason]}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="quote-input-label" style={{ color: 'var(--error)', fontSize: '0.8rem' }}>Rejection Photos (Evidence)</label>
                            
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginTop: '0.4rem', alignItems: 'center' }}>
                              {/* Camera Evidence Button */}
                              <button
                                type="button"
                                onClick={() => cameraInputRefs.current[`${idx}-mobile-camera`]?.click()}
                                className="quote-btn"
                                style={{ flex: '1 0 100px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', minHeight: '44px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                              >
                                <Camera size={16} /> Take Photo
                              </button>
                              <input 
                                type="file"
                                ref={el => { cameraInputRefs.current[`${idx}-mobile-camera`] = el }}
                                style={{ display: 'none' }}
                                accept="image/*"
                                capture="environment"
                                multiple
                                onChange={(e) => handleCapturePhoto(idx, e)}
                              />

                              {/* File browse */}
                              <button
                                type="button"
                                onClick={() => cameraInputRefs.current[`${idx}-mobile-file`]?.click()}
                                className="quote-btn quote-btn-secondary"
                                style={{ flex: '1 0 100px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', minHeight: '44px' }}
                              >
                                <Upload size={16} /> Choose File
                              </button>
                              <input 
                                type="file"
                                ref={el => { cameraInputRefs.current[`${idx}-mobile-file`] = el }}
                                style={{ display: 'none' }}
                                accept="image/*"
                                multiple
                                onChange={(e) => handleCapturePhoto(idx, e)}
                              />
                            </div>

                            {/* Image Previews */}
                            {it.rejection_photos.length > 0 && (
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                                {it.rejection_photos.map((p, pIdx) => (
                                  <div key={pIdx} style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <img src={p.previewUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Preview" />
                                    <button 
                                      type="button" 
                                      onClick={() => removePhoto(idx, pIdx)}
                                      style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.85)', border: 'none', color: '#ef4444', padding: '0.2rem', cursor: 'pointer', borderRadius: '0 0 0 4px' }}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Over-delivery Bypass Checkbox */}
          {hasOverDeliveryWarning && (
            <div className="quote-card" style={{ border: '1px solid rgba(245, 158, 11, 0.35)', background: 'rgba(245, 158, 11, 0.03)', padding: '1.2rem' }}>
              <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={24} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <div>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                    Over-Delivery Tolerance Limit Exceeded (&gt; 2%)
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: '0.8rem', lineHeight: '1.4' }}>
                    One or more items exceed the ordered Purchase Order quantity by more than the allowed 2% tolerance limit. This will trigger a critical over-delivery task alert to Procurement for authorization.
                  </p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', color: '#fff', cursor: 'pointer', minHeight: '32px' }}>
                    <input 
                      type="checkbox" 
                      checked={confirmOverDelivery}
                      onChange={(e) => setConfirmOverDelivery(e.target.checked)}
                      style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                    />
                    <strong>I confirm and authorize recording this over-delivery</strong>
                  </label>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
