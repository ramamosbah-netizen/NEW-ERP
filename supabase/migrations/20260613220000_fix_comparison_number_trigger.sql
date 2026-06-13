-- ============================================================
-- JEET ERP — Fix brittle comparison number generation
--
-- generate_comparison_number() used SUBSTRING(comparison_number
-- FROM 12), but 'JI-CMP-YYYY-' is 12 characters, so the substring
-- started on the dash before the sequence ('-001'). CAST('-001'
-- AS INTEGER) yields -1, so MAX(...) never advances past the
-- existing numbers and the trigger regenerated an already-used
-- number — every new comparison failed with 23505
-- (duplicate key on unique_cmp_rev).
--
-- This rewrites the function to only consider canonical
-- 'JI-CMP-<year>-<digits>' numbers (regex-filtered) and extract
-- the sequence with split_part — robust against malformed/legacy
-- rows, same approach as the quotation number fix.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_comparison_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year integer;
  next_seq integer;
BEGIN
  current_year := EXTRACT(YEAR FROM COALESCE(NEW.comparison_date, CURRENT_DATE));

  LOCK TABLE public.supplier_comparisons IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(MAX(split_part(comparison_number, '-', 4)::integer), 0) + 1
  INTO next_seq
  FROM public.supplier_comparisons
  WHERE revision = 0
    AND comparison_number ~ ('^JI-CMP-' || current_year::text || '-[0-9]+$');

  NEW.comparison_number := 'JI-CMP-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  NEW.revision := 0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
