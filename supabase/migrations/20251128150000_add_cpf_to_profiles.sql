-- Add CPF column to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Add constraint to ensure CPF format (11 digits)
ALTER TABLE public.profiles
ADD CONSTRAINT cpf_format_check
CHECK (
  cpf IS NULL OR 
  (LENGTH(cpf) = 11 AND cpf ~ '^[0-9]+$') OR
  (LENGTH(cpf) = 14 AND cpf ~ '^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$')
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);