-- ============================================================
-- JEET ERP — Fix brittle quotation number generation
--
-- The original generate_quotation_number() blindly cast
-- SUBSTRING(quotation_number FROM 12) to integer across ALL
-- revision-0 rows of the year. Any existing quotation whose
-- number did not fit the 'JI-QT-YYYY-NNN' shape (e.g. legacy
-- 'JI-Q-068235') produced an empty string, and CAST('' AS
-- INTEGER) raised 22P02, breaking every new quotation insert
-- with the opaque error "invalid input syntax for type
-- integer: ''".
--
-- This version only considers canonical numbers for the year
-- (matched by regex) and extracts the sequence with split_part,
-- so malformed/legacy rows can never break number generation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year integer;
  next_seq integer;
BEGIN
  current_year := EXTRACT(YEAR FROM COALESCE(NEW.quotation_date, CURRENT_DATE));

  -- Serialize concurrent inserts so two quotations can't grab the same number
  LOCK TABLE public.quotations IN SHARE ROW EXCLUSIVE MODE;

  -- Only canonical 'JI-QT-<year>-<digits>' rows participate; the numeric
  -- suffix is the 4th '-' segment and is guaranteed numeric by the filter.
  SELECT COALESCE(MAX(split_part(quotation_number, '-', 4)::integer), 0) + 1
  INTO next_seq
  FROM public.quotations
  WHERE revision = 0
    AND quotation_number ~ ('^JI-QT-' || current_year::text || '-[0-9]+$');

  NEW.quotation_number := 'JI-QT-' || current_year || '-' || LPAD(next_seq::text, 3, '0');
  NEW.revision := 0;
  NEW.revision_label := 'Rev.0';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Normalize any pre-existing non-canonical revision-0 numbers so the historical
-- data is consistent and never re-triggers the original failure. Numbers are
-- reassigned per year in creation order, continuing after the highest canonical
-- sequence already present for that year.
DO $$
DECLARE
  r record;
  yr integer;
  seq integer;
BEGIN
  FOR yr IN
    SELECT DISTINCT EXTRACT(YEAR FROM quotation_date)::int AS y
    FROM public.quotations
    WHERE revision = 0
      AND quotation_number !~ '^JI-QT-[0-9]{4}-[0-9]+$'
  LOOP
    SELECT COALESCE(MAX(split_part(quotation_number, '-', 4)::integer), 0)
    INTO seq
    FROM public.quotations
    WHERE revision = 0
      AND quotation_number ~ ('^JI-QT-' || yr::text || '-[0-9]+$');

    FOR r IN
      SELECT id FROM public.quotations
      WHERE revision = 0
        AND EXTRACT(YEAR FROM quotation_date)::int = yr
        AND quotation_number !~ '^JI-QT-[0-9]{4}-[0-9]+$'
      ORDER BY created_at
    LOOP
      seq := seq + 1;
      UPDATE public.quotations
        SET quotation_number = 'JI-QT-' || yr || '-' || LPAD(seq::text, 3, '0')
        WHERE id = r.id;
    END LOOP;
  END LOOP;
END $$;
