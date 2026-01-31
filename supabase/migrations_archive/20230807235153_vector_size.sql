ALTER TABLE topics
DROP COLUMN embedding;

ALTER TABLE topics
ADD COLUMN embedding vector(1536);