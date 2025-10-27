-- Add a function to calculate case equivalents
-- This is simpler than a complex view and avoids permission issues
CREATE OR REPLACE FUNCTION public.calculate_case_equivalent(
  total_bottles integer,
  bottles_per_case integer
)
RETURNS jsonb AS $$
DECLARE
  full_cases integer;
  remaining_bottles integer;
  result jsonb;
BEGIN
  IF total_bottles IS NULL OR bottles_per_case IS NULL OR bottles_per_case = 0 THEN
    RETURN jsonb_build_object(
      'full_cases', 0,
      'remaining_bottles', 0,
      'display_text', '0 casiers'
    );
  END IF;

  full_cases := FLOOR(total_bottles / bottles_per_case);
  remaining_bottles := MOD(total_bottles, bottles_per_case);

  IF full_cases = 0 AND remaining_bottles = 0 THEN
    result := jsonb_build_object(
      'full_cases', 0,
      'remaining_bottles', 0,
      'display_text', '0 casiers'
    );
  ELSIF full_cases > 0 AND remaining_bottles = 0 THEN
    result := jsonb_build_object(
      'full_cases', full_cases,
      'remaining_bottles', 0,
      'display_text', full_cases || ' casiers complets'
    );
  ELSIF full_cases = 0 AND remaining_bottles > 0 THEN
    result := jsonb_build_object(
      'full_cases', 0,
      'remaining_bottles', remaining_bottles,
      'display_text', remaining_bottles || ' bouteilles restantes'
    );
  ELSE
    result := jsonb_build_object(
      'full_cases', full_cases,
      'remaining_bottles', remaining_bottles,
      'display_text', full_cases || ' casiers complets + ' || remaining_bottles || ' bouteilles restantes'
    );
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION public.calculate_case_equivalent(integer, integer) TO authenticated;
