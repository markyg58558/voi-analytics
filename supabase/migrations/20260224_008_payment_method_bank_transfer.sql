-- Allow manual bank transfer payments in checkout MVP
DO $$
BEGIN
  ALTER TYPE public.payment_method_type ADD VALUE IF NOT EXISTS 'bank_transfer';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
