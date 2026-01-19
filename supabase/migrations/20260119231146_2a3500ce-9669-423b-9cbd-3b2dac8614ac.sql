-- Fix function search_path security warning
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), 
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;