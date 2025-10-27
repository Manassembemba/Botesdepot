
CREATE OR REPLACE FUNCTION public.get_email_from_username(p_username TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
BEGIN
  -- Find the user_id from the profiles table based on the username (full_name), case-insensitively
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE LOWER(full_name) = LOWER(p_username);

  IF v_user_id IS NOT NULL THEN
    -- Use the user_id to get the email from the auth.users table
    SELECT email INTO v_email
    FROM auth.users
    WHERE id = v_user_id;
  END IF;

  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission to the 'anon' and 'authenticated' roles
GRANT EXECUTE ON FUNCTION public.get_email_from_username(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_from_username(TEXT) TO authenticated;
