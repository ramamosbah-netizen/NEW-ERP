-- ============================================================
-- JEET ERP — Goods Receipt Note Transaction RPC Function
-- Handles atomic receipts, over-delivery tolerance, return triggers,
-- and integration into stock inventory when is_stock_item is true.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_grn_transaction(
  p_po_id UUID,
  p_received_by UUID,
  p_delivery_note_ref TEXT,
  p_delivery_note_document_id UUID,
  p_vehicle_no TEXT,
  p_driver_name TEXT,
  p_location TEXT,
  p_notes TEXT,
  p_items JSONB[], -- array of: {po_item_id, qty_received, qty_rejected, rejection_reason, notes}
  p_ignore_tolerance BOOLEAN DEFAULT FALSE,
  p_is_stock_item BOOLEAN DEFAULT FALSE,
  p_stock_location_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_grn_id UUID;
  v_project_id UUID;
  v_item JSONB;
  v_po_item_id UUID;
  v_qty_received NUMERIC(12,3);
  v_qty_rejected NUMERIC(12,3);
  v_rejection_reason TEXT;
  v_notes TEXT;
  
  v_grn_item_id UUID;
  v_ordered_qty NUMERIC(12,3);
  v_cur_received NUMERIC(12,3);
  v_cur_rejected NUMERIC(12,3);
  v_total_received NUMERIC(12,3);
  
  v_pricing_item_id UUID;
  v_unit_price NUMERIC(12,4);
  v_stock_item_id UUID;
  
  v_all_lines_complete BOOLEAN := true;
  v_any_lines_partial BOOLEAN := false;
  v_po_status TEXT;
  v_delivery_status TEXT;
BEGIN
  -- 1. Fetch project_id from purchase_orders
  SELECT project_id INTO v_project_id
  FROM public.purchase_orders
  WHERE id = p_po_id;
  
  -- 2. Insert GRN header (including is_stock_item and stock_location_id)
  INSERT INTO public.grns (
    po_id,
    project_id,
    received_by,
    delivery_note_ref,
    delivery_note_document_id,
    vehicle_no,
    driver_name,
    location,
    status,
    notes,
    is_stock_item,
    stock_location_id
  ) VALUES (
    p_po_id,
    v_project_id,
    p_received_by,
    p_delivery_note_ref,
    p_delivery_note_document_id,
    p_vehicle_no,
    p_driver_name,
    p_location,
    'RECEIVED',
    p_notes,
    p_is_stock_item,
    p_stock_location_id
  ) RETURNING id INTO v_grn_id;

  -- 3. Loop through items and process
  FOREACH v_item IN ARRAY p_items LOOP
    v_po_item_id := (v_item->>'po_item_id')::UUID;
    v_qty_received := (v_item->>'qty_received')::NUMERIC(12,3);
    v_qty_rejected := COALESCE((v_item->>'qty_rejected')::NUMERIC(12,3), 0.000);
    v_rejection_reason := v_item->>'rejection_reason';
    v_notes := v_item->>'notes';
    
    -- Fetch current line status
    SELECT quantity, qty_received, qty_rejected, pricing_item_id, unit_price
    INTO v_ordered_qty, v_cur_received, v_cur_rejected, v_pricing_item_id, v_unit_price
    FROM public.po_items
    WHERE id = v_po_item_id AND po_id = p_po_id;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO Item % not found under PO %', v_po_item_id, p_po_id;
    END IF;
    
    -- Tolerance Checker: 2% over-delivery limit check (ex: ordered 100, max allowed received is 102)
    IF NOT p_ignore_tolerance AND (v_cur_received + v_qty_received) > (v_ordered_qty * 1.02) THEN
      RAISE EXCEPTION 'Tolerance Gate: Received quantity (%) exceeds ordered quantity (%) by more than 2%% tolerance.', 
        (v_cur_received + v_qty_received), v_ordered_qty;
    END IF;
    
    -- Insert GRN Item
    INSERT INTO public.grn_items (
      grn_id,
      po_item_id,
      qty_received,
      qty_rejected,
      rejection_reason,
      notes
    ) VALUES (
      v_grn_id,
      v_po_item_id,
      v_qty_received,
      v_qty_rejected,
      v_rejection_reason,
      v_notes
    ) RETURNING id INTO v_grn_item_id;
    
    -- If there are rejected quantities, automatically create return ticket
    IF v_qty_rejected > 0 THEN
      INSERT INTO public.grn_returns (
        grn_item_id,
        qty,
        reason,
        status,
        expected_resolution_date
      ) VALUES (
        v_grn_item_id,
        v_qty_rejected,
        COALESCE(v_rejection_reason, 'OTHER'),
        'PENDING_COLLECTION',
        (CURRENT_DATE + INTERVAL '7 days')::DATE
      );
    END IF;

    -- Integrate into Inventory if is_stock_item is true and some quantity was received
    IF p_is_stock_item AND v_qty_received > 0 AND p_stock_location_id IS NOT NULL THEN
      -- Get or create stock_items definition for this pricing item
      SELECT id INTO v_stock_item_id 
      FROM public.stock_items 
      WHERE pricing_item_id = v_pricing_item_id;
      
      IF NOT FOUND THEN
        INSERT INTO public.stock_items (pricing_item_id, is_serialized)
        VALUES (v_pricing_item_id, FALSE)
        RETURNING id INTO v_stock_item_id;
      END IF;
      
      -- Insert stock transaction (trigger updates balance and recalculates WAC)
      INSERT INTO public.stock_transactions (
        type,
        stock_item_id,
        location_id,
        qty,
        unit_cost,
        total_value,
        source_type,
        source_id,
        project_id,
        performed_by
      ) VALUES (
        'GRN_RECEIPT',
        v_stock_item_id,
        p_stock_location_id,
        v_qty_received,
        v_unit_price,
        ROUND(v_qty_received * v_unit_price, 4),
        'GRN',
        v_grn_id,
        v_project_id,
        p_received_by
      );
    END IF;

    -- Update PO Item received progress
    v_total_received := v_cur_received + v_qty_received;
    
    UPDATE public.po_items
    SET 
      qty_received = v_total_received,
      qty_rejected = qty_rejected + v_qty_rejected,
      receipt_status = CASE 
        WHEN v_total_received >= quantity THEN 'COMPLETE'::TEXT
        WHEN v_total_received > 0 THEN 'PARTIAL'::TEXT
        ELSE 'PENDING'::TEXT
      END
    WHERE id = v_po_item_id;
    
  END LOOP;
  
  -- 4. Recompute overall PO delivery status and status
  SELECT 
    COALESCE(bool_and(receipt_status = 'COMPLETE'), true),
    COALESCE(bool_or(receipt_status IN ('PARTIAL', 'COMPLETE')), false)
  INTO v_all_lines_complete, v_any_lines_partial
  FROM public.po_items
  WHERE po_id = p_po_id;
  
  IF v_all_lines_complete THEN
    v_delivery_status := 'COMPLETE';
    v_po_status := 'DELIVERED';
  ELSIF v_any_lines_partial THEN
    v_delivery_status := 'PARTIAL';
    v_po_status := 'PARTIALLY_DELIVERED';
  ELSE
    v_delivery_status := 'NOT_DELIVERED';
    v_po_status := 'SENT'; -- or APPROVED
  END IF;
  
  UPDATE public.purchase_orders
  SET 
    delivery_status = v_delivery_status,
    status = CASE 
      WHEN status IN ('CANCELLED', 'CLOSED') THEN status -- keep closed/cancelled
      ELSE v_po_status
    END,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_po_id;
  
  RETURN v_grn_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
