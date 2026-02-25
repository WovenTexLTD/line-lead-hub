-- This migration was originally the chatbot_tables migration, but was moved to run later
-- due to dependency on factory_accounts table.
-- Most of the tables and policies already exist from migration 20260128113101.
-- This file only contains items that may not have been created yet.

-- Ensure vector extension is enabled (already done in extensions schema)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- The following tables and policies were already created in earlier migrations:
-- - knowledge_documents
-- - knowledge_chunks
-- - chat_conversations
-- - chat_messages
-- - chat_analytics
-- - document_ingestion_queue
-- - role_feature_access
-- - All RLS policies for these tables
-- - search_knowledge function
-- - get_user_accessible_features function

-- Nothing more to do in this migration as everything was already created.
-- Keeping this file for migration history tracking.
