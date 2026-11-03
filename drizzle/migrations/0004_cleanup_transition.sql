-- 0004: fim da transição para o modelo multi-cliente.
-- Roda DEPOIS que o código novo (que sempre envia client_id) estiver publicado.
-- (1) remove o índice temporário (owner_id, term), que impediria o mesmo termo de regra em clientes diferentes;
-- (2) remove o DEFAULT de client_id: esquecer o cliente passa a dar erro em vez de cair no cliente pessoal;
-- (3) remove a versão de 1 argumento de load_default_categories (ela usava o cliente pessoal).
BEGIN;
DROP INDEX IF EXISTS public.categorization_rules_owner_term_compat;
ALTER TABLE public.financial_accounts ALTER COLUMN client_id DROP DEFAULT;
ALTER TABLE public.categories ALTER COLUMN client_id DROP DEFAULT;
ALTER TABLE public.categorization_rules ALTER COLUMN client_id DROP DEFAULT;
ALTER TABLE public.csv_mappings ALTER COLUMN client_id DROP DEFAULT;
ALTER TABLE public.import_batches ALTER COLUMN client_id DROP DEFAULT;
ALTER TABLE public.recurring_items ALTER COLUMN client_id DROP DEFAULT;
ALTER TABLE public.recurring_adjustments ALTER COLUMN client_id DROP DEFAULT;
ALTER TABLE public.transactions ALTER COLUMN client_id DROP DEFAULT;
DROP FUNCTION IF EXISTS public.load_default_categories(jsonb);
COMMIT;
