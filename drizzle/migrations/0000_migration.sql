-- Owner (single user)
CREATE TABLE public.app_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_owner TO authenticated;
GRANT ALL ON public.app_owner TO service_role;
ALTER TABLE public.app_owner ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads own row" ON public.app_owner FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_owner WHERE user_id = auth.uid())
$$;

-- First authenticated user claims ownership; afterwards nobody else can.
CREATE OR REPLACE FUNCTION public.claim_ownership() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  INSERT INTO public.app_owner(user_id) VALUES (auth.uid()) ON CONFLICT (singleton) DO NOTHING;
  RETURN public.is_owner();
END $$;
REVOKE ALL ON FUNCTION public.claim_ownership() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_ownership() TO authenticated;
REVOKE ALL ON FUNCTION public.is_owner() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Accounts
CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  institution text CHECK (institution IS NULL OR char_length(institution) <= 80),
  type text NOT NULL CHECK (type IN ('checking','savings','investment','credit_card','cash','other')),
  currency char(3) NOT NULL DEFAULT 'BRL',
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  opening_date date NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner select" ON public.financial_accounts FOR SELECT TO authenticated USING (owner_id = auth.uid() AND public.is_owner());
CREATE POLICY "owner insert" ON public.financial_accounts FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_owner());
CREATE POLICY "owner update" ON public.financial_accounts FOR UPDATE TO authenticated USING (owner_id = auth.uid() AND public.is_owner()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.financial_accounts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  parent_id uuid REFERENCES public.categories(id),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner select" ON public.categories FOR SELECT TO authenticated USING (owner_id = auth.uid() AND public.is_owner());
CREATE POLICY "owner insert" ON public.categories FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_owner());
CREATE POLICY "owner update" ON public.categories FOR UPDATE TO authenticated USING (owner_id = auth.uid() AND public.is_owner()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.validate_category() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO p FROM public.categories WHERE id = NEW.parent_id;
    IF p IS NULL OR p.owner_id <> NEW.owner_id THEN RAISE EXCEPTION 'Categoria-mãe inválida'; END IF;
    IF p.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Apenas um nível de subcategoria é permitido'; END IF;
    IF p.kind <> NEW.kind THEN RAISE EXCEPTION 'Subcategoria deve ter o mesmo tipo da categoria-mãe'; END IF;
    IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Categoria não pode ser mãe de si mesma'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.kind <> OLD.kind AND EXISTS (SELECT 1 FROM public.transactions WHERE category_id = NEW.id) THEN
    RAISE EXCEPTION 'Não é possível mudar o tipo de uma categoria já usada';
  END IF;
  RETURN NEW;
END $$;

-- Future CSV import
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  source text NOT NULL DEFAULT 'csv',
  file_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','imported','discarded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner all" ON public.import_batches FOR ALL TO authenticated USING (owner_id = auth.uid() AND public.is_owner()) WITH CHECK (owner_id = auth.uid() AND public.is_owner());

-- Transactions (a transfer is ONE row with source + destination: no duplicated effect)
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('income','expense','transfer')),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('pending','posted','cancelled')),
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  destination_account_id uuid REFERENCES public.financial_accounts(id),
  category_id uuid REFERENCES public.categories(id),
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 1000),
  cancelled_at timestamptz,
  cancel_reason text CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 200),
  import_batch_id uuid REFERENCES public.import_batches(id),
  external_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transfer_shape CHECK (
    (kind = 'transfer' AND destination_account_id IS NOT NULL AND destination_account_id <> account_id AND category_id IS NULL)
    OR (kind <> 'transfer' AND destination_account_id IS NULL)
  ),
  CONSTRAINT cancel_shape CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX idx_tx_owner_date ON public.transactions(owner_id, date DESC);
CREATE INDEX idx_tx_account ON public.transactions(account_id);
CREATE INDEX idx_tx_dest ON public.transactions(destination_account_id);
CREATE UNIQUE INDEX uq_tx_external_ref ON public.transactions(owner_id, account_id, external_ref) WHERE external_ref IS NOT NULL;
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner select" ON public.transactions FOR SELECT TO authenticated USING (owner_id = auth.uid() AND public.is_owner());
CREATE POLICY "owner insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_owner());
CREATE POLICY "owner update" ON public.transactions FOR UPDATE TO authenticated USING (owner_id = auth.uid() AND public.is_owner()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_validate_category BEFORE INSERT OR UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.validate_category();

CREATE OR REPLACE FUNCTION public.validate_transaction() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE a record; d record; c record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'cancelled' THEN RAISE EXCEPTION 'Lançamento cancelado não pode ser alterado'; END IF;
    IF NEW.owner_id <> OLD.owner_id OR NEW.kind <> OLD.kind THEN RAISE EXCEPTION 'Tipo do lançamento não pode ser alterado'; END IF;
    IF NEW.status = 'cancelled' THEN
      -- cancelling: only status/cancel fields may change
      IF NEW.amount <> OLD.amount OR NEW.date <> OLD.date OR NEW.account_id <> OLD.account_id
         OR NEW.destination_account_id IS DISTINCT FROM OLD.destination_account_id
         OR NEW.category_id IS DISTINCT FROM OLD.category_id THEN
        RAISE EXCEPTION 'Ao cancelar, os valores do lançamento não podem mudar';
      END IF;
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.status = 'cancelled' THEN RAISE EXCEPTION 'Não é possível criar um lançamento já cancelado'; END IF;
  END IF;

  SELECT * INTO a FROM public.financial_accounts WHERE id = NEW.account_id;
  IF a IS NULL OR a.owner_id <> NEW.owner_id THEN RAISE EXCEPTION 'Conta inválida'; END IF;
  IF a.archived_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.account_id <> OLD.account_id) THEN RAISE EXCEPTION 'Conta arquivada não aceita lançamentos'; END IF;
  IF NEW.date < a.opening_date THEN RAISE EXCEPTION 'Data anterior à data-base da conta %', a.name; END IF;

  IF NEW.kind = 'transfer' THEN
    SELECT * INTO d FROM public.financial_accounts WHERE id = NEW.destination_account_id;
    IF d IS NULL OR d.owner_id <> NEW.owner_id THEN RAISE EXCEPTION 'Conta de destino inválida'; END IF;
    IF d.archived_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.destination_account_id IS DISTINCT FROM OLD.destination_account_id) THEN RAISE EXCEPTION 'Conta de destino arquivada'; END IF;
    IF NEW.date < d.opening_date THEN RAISE EXCEPTION 'Data anterior à data-base da conta %', d.name; END IF;
  ELSE
    IF NEW.category_id IS NULL THEN RAISE EXCEPTION 'Categoria obrigatória'; END IF;
    SELECT * INTO c FROM public.categories WHERE id = NEW.category_id;
    IF c IS NULL OR c.owner_id <> NEW.owner_id THEN RAISE EXCEPTION 'Categoria inválida'; END IF;
    IF c.kind <> NEW.kind THEN RAISE EXCEPTION 'Categoria incompatível com o tipo do lançamento'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_tx BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.validate_transaction();

-- Opening date cannot move past existing transactions
CREATE OR REPLACE FUNCTION public.validate_account_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.opening_date > OLD.opening_date AND EXISTS (
    SELECT 1 FROM public.transactions t WHERE (t.account_id = NEW.id OR t.destination_account_id = NEW.id)
      AND t.status <> 'cancelled' AND t.date < NEW.opening_date) THEN
    RAISE EXCEPTION 'Existem lançamentos anteriores à nova data-base';
  END IF;
  IF NEW.currency <> OLD.currency AND EXISTS (SELECT 1 FROM public.transactions t WHERE t.account_id = NEW.id OR t.destination_account_id = NEW.id) THEN
    RAISE EXCEPTION 'Moeda não pode mudar após lançamentos';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_account BEFORE UPDATE ON public.financial_accounts FOR EACH ROW EXECUTE FUNCTION public.validate_account_update();

-- Balances (security invoker: RLS applies)
CREATE VIEW public.account_balances WITH (security_invoker = true) AS
SELECT a.id AS account_id, a.owner_id, a.name, a.type, a.currency, a.archived_at,
  a.opening_balance, a.opening_date,
  COALESCE(SUM(CASE WHEN t.status='posted' AND t.kind='income' AND t.account_id=a.id THEN t.amount END),0)::numeric(18,2) AS income_posted,
  COALESCE(SUM(CASE WHEN t.status='posted' AND t.kind='expense' AND t.account_id=a.id THEN t.amount END),0)::numeric(18,2) AS expense_posted,
  COALESCE(SUM(CASE WHEN t.status='posted' AND t.kind='transfer' AND t.destination_account_id=a.id THEN t.amount END),0)::numeric(18,2) AS transfer_in,
  COALESCE(SUM(CASE WHEN t.status='posted' AND t.kind='transfer' AND t.account_id=a.id THEN t.amount END),0)::numeric(18,2) AS transfer_out,
  COALESCE(SUM(CASE WHEN t.status='pending' AND t.kind='income' AND t.account_id=a.id THEN t.amount
                    WHEN t.status='pending' AND t.kind='expense' AND t.account_id=a.id THEN -t.amount
                    WHEN t.status='pending' AND t.kind='transfer' AND t.destination_account_id=a.id THEN t.amount
                    WHEN t.status='pending' AND t.kind='transfer' AND t.account_id=a.id THEN -t.amount END),0)::numeric(18,2) AS pending_net,
  (a.opening_balance + COALESCE(SUM(CASE WHEN t.status='posted' THEN
     CASE WHEN t.kind='income' AND t.account_id=a.id THEN t.amount
          WHEN t.kind='expense' AND t.account_id=a.id THEN -t.amount
          WHEN t.kind='transfer' AND t.destination_account_id=a.id THEN t.amount
          WHEN t.kind='transfer' AND t.account_id=a.id THEN -t.amount END END),0))::numeric(18,2) AS balance
FROM public.financial_accounts a
LEFT JOIN public.transactions t ON (t.account_id = a.id OR t.destination_account_id = a.id)
GROUP BY a.id;
GRANT SELECT ON public.account_balances TO authenticated;
GRANT SELECT ON public.account_balances TO service_role;