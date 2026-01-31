
-- Step 1: Drop the primary key constraint on usage_id (if not done already)
ALTER TABLE public.usage 
DROP CONSTRAINT IF EXISTS usage_pkey;

-- Step 2: Remove the usage_id column from the table
ALTER TABLE public.usage 
DROP COLUMN IF EXISTS usage_id;

-- Step 2: Optionally, you can add a new primary key on another column(s)
-- Example: Set user_id as the new primary key
ALTER TABLE public.usage
ADD CONSTRAINT usage_user_id_pkey PRIMARY KEY (user_id);