-- ============================================================
-- JEET ERP — Goods move automatically to store on receipt
--
-- Previously the GRN RPC only posted stock when the user manually
-- toggled is_stock_item AND picked a warehouse, and it would crash
-- on lines with no catalogue link (pricing_item_id null).
--
-- This version:
--   * auto-resolves a destination location: the supplied one, else
--     the first active MAIN_STORE/SUB_STORE when the receipt is to
--     STORE (or the flag is set);
--   * posts a GRN_RECEIPT stock transaction for every received,
--     catalogue-linked line automatically;
--   * safely SKIPS lines without a pricing_item_id (manual non-
--     catalogue items) instead of failing the whole receipt.
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
  p_items JSONB[],
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
  v_effective_location UUID;   -- resolved destination store
  v_route_to_stock BOOLEAN;    -- whether to influx stock
BEGIN
  SELECT project_id INTO v_project_id FROM public.purchase_orders WHERE id = p_po_id;

  -- Resolve an effective destination store. Use the supplied one, else (when
  -- the receipt goes to STORE or the flag is set) the first active store.
  v_effective_location := p_stock_location_id;
  IF v_effective_location IS NULL AND (p_is_stock_item OR p_location = 'STORE') THEN
    SELECT id INTO v_effective_location
    FROM public.stock_locations
    WHERE is_active = true AND type IN ('MAIN_STORE', 'SUB_STORE')
    ORDER BY (type = 'MAIN_STORE') DESC, created_at
    LIMIT 1;
  END IF;
  v_route_to_stock := (p_is_stock_item OR p_location = 'STORE') AND v_effective_location IS NOT NULL;

  INSERT INTO public.grns (
    po_id, project_id, received_by, delivery_note_ref, delivery_note_document_id,
    vehicle_no, driver_name, location, status, notes, is_stock_item, stock_location_id
  ) VALUES (
    p_po_id, v_project_id, p_received_by, p_delivery_note_ref, p_delivery_note_document_id,
    p_vehicle_no, p_driver_name, p_location, 'RECEIVED', p_notes,
    v_route_to_stock, v_effective_location
  ) RETURNING id INTO v_grn_id;

  FOREACH v_item IN ARRAY p_items LOOP
    v_po_item_id := (v_item->>'po_item_id')::UUID;
    v_qty_received := (v_item->>'qty_received')::NUMERIC(12,3);
    v_qty_rejected := COALESCE((v_item->>'qty_rejected')::NUMERIC(12,3), 0.000);
    v_rejection_reason := v_item->>'rejection_reason';
    v_notes := v_item->>'notes';

    SELECT quantity, qty_received, qty_rejected, pricing_item_id, unit_price
    INTO v_ordered_qty, v_cur_received, v_cur_rejected, v_pricing_item_id, v_unit_price
    FROM public.po_items WHERE id = v_po_item_id AND po_id = p_po_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PO Item % not found under PO %', v_po_item_id, p_po_id;
    END IF;

    IF NOT p_ignore_tolerance AND (v_cur_received + v_qty_received) > (v_ordered_qty * 1.02) THEN
      RAISE EXCEPTION 'Tolerance Gate: Received quantity (%) exceeds ordered quantity (%) by more than 2%% tolerance.',
        (v_cur_received + v_qty_received), v_ordered_qty;
    END IF;

    INSERT INTO public.grn_items (grn_id, po_item_id, qty_received, qty_rejected, rejection_reason, notes)
    VALUES (v_grn_id, v_po_item_id, v_qty_received, v_qty_rejected, v_rejection_reason, v_notes)
    RETURNING id INTO v_grn_item_id;

    IF v_qty_rejected > 0 THEN
      INSERT INTO public.grn_returns (grn_item_id, qty, reason, status, expected_resolution_date)
      VALUES (v_grn_item_id, v_qty_rejected, COALESCE(v_rejection_reason, 'OTHER'),
              'PENDING_COLLECTION', (CURRENT_DATE + INTERVAL '7 days')::DATE);
    END IF;

    -- Auto stock influx: only for received, catalogue-linked lines into a store.
    -- Non-catalogue lines (pricing_item_id NULL) are skipped, not failed.
    IF v_route_to_stock AND v_qty_received > 0 AND v_pricing_item_id IS NOT NULL THEN
      SELECT id INTO v_stock_item_id FROM public.stock_items WHERE pricing_item_id = v_pricing_item_id;
      IF NOT FOUND THEN
        INSERT INTO public.stock_items (pricing_item_id, is_serialized)
        VALUES (v_pricing_item_id, FALSE) RETURNING id INTO v_stock_item_id;
      END IF;

      INSERT INTO public.stock_transactions (
        type, stock_item_id, location_id, qty, unit_cost, total_value,
        source_type, source_id, project_id, performed_by
      ) VALUES (
        'GRN_RECEIPT', v_stock_item_id, v_effective_location, v_qty_received,
        v_unit_price, ROUND(v_qty_received * v_unit_price, 4), 'GRN', v_grn_id,
        v_project_id, p_received_by
      );
    END IF;

    v_total_received := v_cur_received + v_qty_received;
    UPDATE public.po_items
    SET qty_received = v_total_received,
        qty_rejected = qty_rejected + v_qty_rejected,
        receipt_status = CASE
          WHEN v_total_received >= quantity THEN 'COMPLETE'::TEXT
          WHEN v_total_received > 0 THEN 'PARTIAL'::TEXT
          ELSE 'PENDING'::TEXT END
    WHERE id = v_po_item_id;
  END LOOP;

  SELECT COALESCE(bool_and(receipt_status = 'COMPLETE'), true),
         COALESCE(bool_or(receipt_status IN ('PARTIAL', 'COMPLETE')), false)
  INTO v_all_lines_complete, v_any_lines_partial
  FROM public.po_items WHERE po_id = p_po_id;

  IF v_all_lines_complete THEN v_delivery_status := 'COMPLETE'; v_po_status := 'DELIVERED';
  ELSIF v_any_lines_partial THEN v_delivery_status := 'PARTIAL'; v_po_status := 'PARTIALLY_DELIVERED';
  ELSE v_delivery_status := 'NOT_DELIVERED'; v_po_status := 'SENT';
  END IF;

  UPDATE public.purchase_orders
  SET delivery_status = v_delivery_status,
      status = CASE WHEN status IN ('CANCELLED', 'CLOSED') THEN status ELSE v_po_status END,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_po_id;

  RETURN v_grn_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
