-- Supabase AI is experimental and may produce incorrect answers
-- Always verify the output before executing

ALTER TABLE public.custom_prompts
ALTER COLUMN title_prompt
DROP NOT NULL,
ALTER COLUMN body_prompt
DROP NOT NULL,
ALTER COLUMN photo_prompt
DROP NOT NULL,
ALTER COLUMN ocr_prompt
DROP NOT NULL,
ALTER COLUMN reminder_prompt
DROP NOT NULL,
ALTER COLUMN extra_prompt
DROP NOT NULL,
ALTER COLUMN extra_prompt_1
DROP NOT NULL,
ALTER COLUMN extra_prompt_2
DROP NOT NULL,
ALTER COLUMN extra_prompt_3
DROP NOT NULL,
ALTER COLUMN updated_at
DROP NOT NULL;