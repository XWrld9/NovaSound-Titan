-- Fix RLS policies for push_subscriptions table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;

-- Create new RLS policies
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
    FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
    FOR DELETE USING (auth.uid()::text = user_id);

-- Enable RLS on push_subscriptions if not already enabled
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
