-- ============================================================
-- JEET ERP — Fix broken pricing audit trigger
--
-- schema-pricing.sql shipped an older audit_log shape
-- (table_name, record_id, old_values, new_values, user_id) and
-- a log_pricing_change() trigger that writes those columns. The
-- live audit_log uses a different schema (entity_type, entity_id,
-- before, after, summary, module, source, actor_user_id), so the
-- trigger raised:
--   column "table_name" of relation "audit_log" does not exist
-- on EVERY insert/update/delete to the pricing tables —
-- pricing_items, pricing_suppliers, pricing_adjustment_factors,
-- pricing_templates, pricing_labour_rates. That blocked creating
-- or editing suppliers and catalogue items (e.g. auto-creating a
-- supplier while generating LPOs from a comparison).
--
-- This rewrites the function to the live audit_log schema.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_pricing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action TEXT := CASE TG_OP
    WHEN 'INSERT' THEN 'CREATE'
    WHEN 'UPDATE' THEN 'UPDATE'
    WHEN 'DELETE' THEN 'DELETE'
    ELSE TG_OP
  END;
  v_id UUID := COALESCE((to_jsonb(NEW) ->> 'id')::uuid, (to_jsonb(OLD) ->> 'id')::uuid);
  v_label TEXT := COALESCE(to_jsonb(NEW) ->> 'name', to_jsonb(OLD) ->> 'name', NULL);
BEGIN
  INSERT INTO public.audit_log (
    action, entity_type, entity_id, entity_label, summary,
    before, after, module, source, actor_user_id
  ) VALUES (
    v_action,
    upper(TG_TABLE_NAME),
    v_id,
    v_label,
    v_action || ' on ' || TG_TABLE_NAME || COALESCE(' — ' || v_label, ''),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    'INVENTORY',
    'API',
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
