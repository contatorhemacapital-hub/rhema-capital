-- 0003: modelo multi-cliente (administrador/consultor + clientes).
-- Aditivo e transacional: os dados atuais passam para o cliente "Leonardo (pessoal)"; o dono atual vira admin.
-- owner_id passa a significar "criado por". O acesso é decidido por client_id (is_admin / can_read_client / can_write_client).
-- client_id recebe DEFAULT do cliente pessoal durante a transição, para o app antigo continuar funcionando até o novo código entrar.
BEGIN;

CREATE TABLE public.user_roles (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, role text NOT NULL CHECK (role IN ('admin','client')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.clients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120), email text, cpf text, phone text, notes text, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')), created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.client_access (client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE, user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE, access_level text NOT NULL DEFAULT 'view' CHECK (access_level IN ('view','edit')), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (client_id, user_id));
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') $$;
CREATE OR REPLACE FUNCTION public.can_read_client(p_client uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.is_admin() OR EXISTS (SELECT 1 FROM public.client_access WHERE client_id = p_client AND user_id = auth.uid()) $$;
CREATE OR REPLACE FUNCTION public.can_write_client(p_client uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.is_admin() OR EXISTS (SELECT 1 FROM public.client_access WHERE client_id = p_client AND user_id = auth.uid() AND access_level = 'edit') $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
REVOKE ALL ON FUNCTION public.can_read_client(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.can_write_client(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_client(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_client(uuid) TO authenticated;

-- O dono atual vira administrador. is_owner() e claim_ownership() continuam existindo (o app atual os usa).
INSERT INTO public.user_roles(user_id, role) SELECT user_id, 'admin' FROM public.app_owner ON CONFLICT (user_id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.is_owner() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT public.is_admin() $$;
CREATE OR REPLACE FUNCTION public.claim_ownership() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.app_owner(user_id) VALUES (auth.uid()) ON CONFLICT (singleton) DO NOTHING;
  END IF;
  RETURN public.is_admin();
END $$;

INSERT INTO public.clients(id, name, created_by) VALUES
 ('11111111-1111-4111-8111-111111111111', 'Leonardo (pessoal)', (SELECT user_id FROM public.app_owner LIMIT 1)),
 ('22222222-2222-4222-8222-222222222222', 'Cliente Teste', (SELECT user_id FROM public.app_owner LIMIT 1));
ALTER TABLE public.financial_accounts ADD COLUMN client_id uuid;
UPDATE public.financial_accounts SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.financial_accounts ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT financial_accounts_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX financial_accounts_client_idx ON public.financial_accounts(client_id);
ALTER TABLE public.categories ADD COLUMN client_id uuid;
UPDATE public.categories SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.categories ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT categories_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX categories_client_idx ON public.categories(client_id);
ALTER TABLE public.categorization_rules ADD COLUMN client_id uuid;
UPDATE public.categorization_rules SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.categorization_rules ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT categorization_rules_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX categorization_rules_client_idx ON public.categorization_rules(client_id);
ALTER TABLE public.csv_mappings ADD COLUMN client_id uuid;
UPDATE public.csv_mappings SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.csv_mappings ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT csv_mappings_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX csv_mappings_client_idx ON public.csv_mappings(client_id);
ALTER TABLE public.import_batches ADD COLUMN client_id uuid;
UPDATE public.import_batches SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.import_batches ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT import_batches_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX import_batches_client_idx ON public.import_batches(client_id);
ALTER TABLE public.recurring_items ADD COLUMN client_id uuid;
UPDATE public.recurring_items SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.recurring_items ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT recurring_items_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX recurring_items_client_idx ON public.recurring_items(client_id);
ALTER TABLE public.recurring_adjustments ADD COLUMN client_id uuid;
UPDATE public.recurring_adjustments SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.recurring_adjustments ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT recurring_adjustments_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX recurring_adjustments_client_idx ON public.recurring_adjustments(client_id);
ALTER TABLE public.transactions ADD COLUMN client_id uuid;
UPDATE public.transactions SET client_id = '11111111-1111-4111-8111-111111111111';
ALTER TABLE public.transactions ALTER COLUMN client_id SET NOT NULL, ALTER COLUMN client_id SET DEFAULT '11111111-1111-4111-8111-111111111111', ADD CONSTRAINT transactions_client_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);
CREATE INDEX transactions_client_idx ON public.transactions(client_id);

-- Integridade entre clientes: filho e pai sempre do mesmo cliente.
ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_id_client_uq UNIQUE (id, client_id);
ALTER TABLE public.categories ADD CONSTRAINT categories_id_client_uq UNIQUE (id, client_id);
ALTER TABLE public.recurring_items ADD CONSTRAINT recurring_items_id_client_uq UNIQUE (id, client_id);
ALTER TABLE public.import_batches ADD CONSTRAINT import_batches_id_client_uq UNIQUE (id, client_id);
ALTER TABLE public.categories ADD CONSTRAINT categories_parent_client_fk FOREIGN KEY (parent_id, client_id) REFERENCES public.categories(id, client_id);
ALTER TABLE public.categorization_rules ADD CONSTRAINT rules_category_client_fk FOREIGN KEY (category_id, client_id) REFERENCES public.categories(id, client_id);
ALTER TABLE public.csv_mappings ADD CONSTRAINT mappings_account_client_fk FOREIGN KEY (account_id, client_id) REFERENCES public.financial_accounts(id, client_id);
ALTER TABLE public.import_batches ADD CONSTRAINT batches_account_client_fk FOREIGN KEY (account_id, client_id) REFERENCES public.financial_accounts(id, client_id);
ALTER TABLE public.recurring_items ADD CONSTRAINT recurring_account_client_fk FOREIGN KEY (account_id, client_id) REFERENCES public.financial_accounts(id, client_id);
ALTER TABLE public.recurring_items ADD CONSTRAINT recurring_category_client_fk FOREIGN KEY (category_id, client_id) REFERENCES public.categories(id, client_id);
ALTER TABLE public.recurring_adjustments ADD CONSTRAINT adjustments_recurring_client_fk FOREIGN KEY (recurring_id, client_id) REFERENCES public.recurring_items(id, client_id);
ALTER TABLE public.transactions ADD CONSTRAINT tx_account_client_fk FOREIGN KEY (account_id, client_id) REFERENCES public.financial_accounts(id, client_id);
ALTER TABLE public.transactions ADD CONSTRAINT tx_destination_client_fk FOREIGN KEY (destination_account_id, client_id) REFERENCES public.financial_accounts(id, client_id);
ALTER TABLE public.transactions ADD CONSTRAINT tx_category_client_fk FOREIGN KEY (category_id, client_id) REFERENCES public.categories(id, client_id);
ALTER TABLE public.transactions ADD CONSTRAINT tx_recurring_client_fk FOREIGN KEY (recurring_id, client_id) REFERENCES public.recurring_items(id, client_id);
ALTER TABLE public.transactions ADD CONSTRAINT tx_batch_client_fk FOREIGN KEY (import_batch_id, client_id) REFERENCES public.import_batches(id, client_id);

-- Unicidades que dependiam de owner_id passam a depender do cliente/conta (owner_id agora é só "criado por").
ALTER TABLE public.categorization_rules DROP CONSTRAINT categorization_rules_owner_id_term_key;
CREATE UNIQUE INDEX categorization_rules_client_term_key ON public.categorization_rules(client_id, term);
DROP INDEX public.uq_tx_external_ref;
CREATE UNIQUE INDEX uq_tx_external_ref ON public.transactions(account_id, external_ref) WHERE external_ref IS NOT NULL;
DROP INDEX public.uq_tx_recurring_occurrence;
CREATE UNIQUE INDEX uq_tx_recurring_occurrence ON public.transactions(recurring_id, occurrence_date) WHERE recurring_id IS NOT NULL AND status <> 'cancelled';

-- Índices que faltavam.
CREATE INDEX transactions_client_date_idx ON public.transactions(client_id, date DESC);
CREATE INDEX transactions_category_idx ON public.transactions(category_id);
CREATE INDEX transactions_batch_idx ON public.transactions(import_batch_id);
CREATE INDEX categories_parent_idx ON public.categories(parent_id);
CREATE INDEX recurring_adjustments_rec_idx ON public.recurring_adjustments(recurring_id, effective_from DESC);

-- client_id nunca muda depois de criado.
CREATE OR REPLACE FUNCTION public.prevent_client_change() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN RAISE EXCEPTION 'O cliente de um registro não pode mudar'; END IF; RETURN NEW; END $$;
CREATE TRIGGER trg_financial_accounts_client_immutable BEFORE UPDATE ON public.financial_accounts FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();
CREATE TRIGGER trg_categories_client_immutable BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();
CREATE TRIGGER trg_categorization_rules_client_immutable BEFORE UPDATE ON public.categorization_rules FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();
CREATE TRIGGER trg_csv_mappings_client_immutable BEFORE UPDATE ON public.csv_mappings FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();
CREATE TRIGGER trg_import_batches_client_immutable BEFORE UPDATE ON public.import_batches FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();
CREATE TRIGGER trg_recurring_items_client_immutable BEFORE UPDATE ON public.recurring_items FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();
CREATE TRIGGER trg_recurring_adjustments_client_immutable BEFORE UPDATE ON public.recurring_adjustments FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();
CREATE TRIGGER trg_transactions_client_immutable BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.prevent_client_change();

-- Funções de validação e importação passam a comparar o cliente (não o usuário).
CREATE OR REPLACE FUNCTION public.validate_category()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE p record;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO p FROM public.categories WHERE id = NEW.parent_id;
    IF p IS NULL OR p.client_id <> NEW.client_id THEN RAISE EXCEPTION 'Categoria-mãe inválida'; END IF;
    IF p.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Apenas um nível de subcategoria é permitido'; END IF;
    IF p.kind <> NEW.kind THEN RAISE EXCEPTION 'Subcategoria deve ter o mesmo tipo da categoria-mãe'; END IF;
    IF NEW.parent_id = NEW.id THEN RAISE EXCEPTION 'Categoria não pode ser mãe de si mesma'; END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.kind <> OLD.kind AND EXISTS (SELECT 1 FROM public.transactions WHERE category_id = NEW.id) THEN
    RAISE EXCEPTION 'Não é possível mudar o tipo de uma categoria já usada';
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.validate_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE a record; d record; c record;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'cancelled' THEN RAISE EXCEPTION 'Lançamento cancelado não pode ser alterado'; END IF;
    IF NEW.client_id <> OLD.client_id OR NEW.kind <> OLD.kind THEN RAISE EXCEPTION 'Tipo do lançamento não pode ser alterado'; END IF;
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
  IF a IS NULL OR a.client_id <> NEW.client_id THEN RAISE EXCEPTION 'Conta inválida'; END IF;
  IF a.archived_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.account_id <> OLD.account_id) THEN RAISE EXCEPTION 'Conta arquivada não aceita lançamentos'; END IF;
  IF NEW.date < a.opening_date THEN RAISE EXCEPTION 'Data anterior à data-base da conta %', a.name; END IF;

  IF NEW.kind = 'transfer' THEN
    SELECT * INTO d FROM public.financial_accounts WHERE id = NEW.destination_account_id;
    IF d IS NULL OR d.client_id <> NEW.client_id THEN RAISE EXCEPTION 'Conta de destino inválida'; END IF;
    IF d.archived_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.destination_account_id IS DISTINCT FROM OLD.destination_account_id) THEN RAISE EXCEPTION 'Conta de destino arquivada'; END IF;
    IF NEW.date < d.opening_date THEN RAISE EXCEPTION 'Data anterior à data-base da conta %', d.name; END IF;
  ELSE
    IF NEW.category_id IS NULL THEN RAISE EXCEPTION 'Categoria obrigatória'; END IF;
    SELECT * INTO c FROM public.categories WHERE id = NEW.category_id;
    IF c IS NULL OR c.client_id <> NEW.client_id THEN RAISE EXCEPTION 'Categoria inválida'; END IF;
    IF c.kind <> NEW.kind THEN RAISE EXCEPTION 'Categoria incompatível com o tipo do lançamento'; END IF;
  END IF;
  RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.phase2_validate_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE r public.recurring_items;
BEGIN
 IF NEW.recurring_id IS NOT NULL THEN
 SELECT * INTO r FROM public.recurring_items WHERE id=NEW.recurring_id AND client_id=NEW.client_id;
 IF r.id IS NULL OR r.account_id<>NEW.account_id OR r.category_id IS DISTINCT FROM NEW.category_id OR r.kind<>NEW.kind OR NEW.occurrence_date IS NULL OR NEW.competence IS DISTINCT FROM date_trunc('month',NEW.occurrence_date)::date OR NOT EXISTS (SELECT 1 FROM public.phase2_due_dates(r,NEW.occurrence_date,NEW.occurrence_date)) THEN RAISE EXCEPTION 'Vínculo com previsto inválido'; END IF;
 ELSIF NEW.competence IS NOT NULL OR NEW.occurrence_date IS NOT NULL THEN RAISE EXCEPTION 'Competência exige previsto'; END IF;
 IF NEW.import_batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id=NEW.import_batch_id AND b.client_id=NEW.client_id) THEN RAISE EXCEPTION 'Lote inválido'; END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.phase2_validate_recurring()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE id=NEW.account_id AND client_id=NEW.client_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'Conta inválida ou arquivada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND client_id=NEW.client_id AND kind=NEW.kind AND archived_at IS NULL) THEN RAISE EXCEPTION 'Categoria inválida'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(NEW.custom_dates) d WHERE d < NEW.start_date OR (NEW.end_date IS NOT NULL AND d > NEW.end_date)) THEN RAISE EXCEPTION 'Datas avulsas fora da vigência'; END IF;
 IF TG_OP='UPDATE' AND NEW.client_id <> OLD.client_id THEN RAISE EXCEPTION 'Proprietário não pode mudar'; END IF;
 RETURN NEW;
END $function$;
CREATE OR REPLACE FUNCTION public.commit_csv_import(p_account uuid,p_file text,p_mapping jsonb,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE row jsonb; batch uuid; r public.recurring_items; expected numeric; actual numeric; due date; linked uuid; inserted integer:=0; skipped integer:=0; txid uuid; action text; eff date; cid uuid; fp text; n_exist integer; used integer; fp_used jsonb:='{}'::jsonb;
BEGIN
 SELECT client_id INTO cid FROM public.financial_accounts WHERE id=p_account AND archived_at IS NULL;
 IF cid IS NULL OR NOT public.can_write_client(cid) THEN RAISE EXCEPTION 'Conta inválida'; END IF;
 IF jsonb_array_length(p_rows)>2000 THEN RAISE EXCEPTION 'Limite de 2000 linhas por arquivo'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(cid::text || p_account::text));
 INSERT INTO public.import_batches(owner_id,client_id,account_id,file_name,status) VALUES(auth.uid(),cid,p_account,p_file,'draft') RETURNING id INTO batch;
 FOR row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
 actual:=(row->>'amount')::numeric; due:=NULLIF(row->>'occurrenceDate','')::date; linked:=NULLIF(row->>'recurringId','')::uuid; action:=coalesce(row->>'action','reject');
 IF NULLIF(row->>'externalRef','') IS NOT NULL AND EXISTS(SELECT 1 FROM public.transactions t WHERE t.client_id=cid AND t.account_id=p_account AND t.external_ref=row->>'externalRef') THEN skipped:=skipped+1; CONTINUE; END IF;
 fp:=(row->>'date')||'|'||(row->>'kind')||'|'||to_char(actual,'FM9999999999990.00')||'|'||regexp_replace(lower(btrim(row->>'description')), '\s+', ' ', 'g');
 SELECT count(*) INTO n_exist FROM public.transactions t WHERE t.client_id=cid AND t.account_id=p_account AND t.import_batch_id IS DISTINCT FROM batch AND t.date=(row->>'date')::date AND t.amount=actual AND t.kind=row->>'kind' AND regexp_replace(lower(btrim(t.description)), '\s+', ' ', 'g')=regexp_replace(lower(btrim(row->>'description')), '\s+', ' ', 'g');
 used:=coalesce((fp_used->>fp)::integer,0);
 IF used<n_exist THEN fp_used:=jsonb_set(fp_used,ARRAY[fp],to_jsonb(used+1),true); skipped:=skipped+1; CONTINUE; END IF;
 IF action='reject' THEN linked:=NULL; due:=NULL; END IF;
 IF linked IS NOT NULL THEN
 SELECT * INTO r FROM public.recurring_items WHERE id=linked AND client_id=cid FOR UPDATE;
 IF r.id IS NULL OR NOT r.active OR r.account_id<>p_account OR r.category_id IS DISTINCT FROM NULLIF(row->>'categoryId','')::uuid OR r.kind<>row->>'kind' OR due IS NULL OR NOT EXISTS(SELECT 1 FROM public.phase2_due_dates(r,due,due)) THEN RAISE EXCEPTION 'Previsto inválido'; END IF;
 expected:=public.phase2_expected_amount(linked,due);
 IF action='auto' AND actual<>expected THEN RAISE EXCEPTION 'Confirme a divergência de valor'; END IF;
 IF action NOT IN ('auto','month','adjust') THEN RAISE EXCEPTION 'Confirmação inválida'; END IF;
 IF EXISTS(SELECT 1 FROM public.transactions WHERE client_id=cid AND recurring_id=linked AND occurrence_date=due AND status<>'cancelled') THEN RAISE EXCEPTION 'Ocorrência já conciliada'; END IF;
 END IF;
 INSERT INTO public.transactions(owner_id,client_id,kind,status,account_id,destination_account_id,category_id,amount,date,description,external_ref,import_batch_id,recurring_id,competence,occurrence_date)
 VALUES(auth.uid(),cid,row->>'kind','posted',p_account,NULLIF(row->>'destinationAccountId','')::uuid,CASE WHEN row->>'kind'='transfer' THEN NULL ELSE NULLIF(row->>'categoryId','')::uuid END,actual,(row->>'date')::date,row->>'description',NULLIF(row->>'externalRef',''),batch,linked,CASE WHEN linked IS NOT NULL THEN date_trunc('month',due)::date END,due) RETURNING id INTO txid;
 IF linked IS NOT NULL AND action='adjust' AND actual<>expected THEN
 eff:=(date_trunc('month',due)+interval '1 month')::date;
 IF EXISTS(SELECT 1 FROM public.recurring_adjustments WHERE recurring_id=linked AND effective_from>eff) THEN RAISE EXCEPTION 'Há reajuste posterior; confirme só este mês'; END IF;
 INSERT INTO public.recurring_adjustments(owner_id,client_id,recurring_id,effective_from,previous_amount,new_amount) VALUES(auth.uid(),cid,linked,eff,public.phase2_expected_amount(linked,eff),actual);
 UPDATE public.recurring_items SET amount=actual WHERE id=linked;
 END IF;
 inserted:=inserted+1;
 END LOOP;
 INSERT INTO public.csv_mappings(account_id,owner_id,client_id,mapping) VALUES(p_account,auth.uid(),cid,p_mapping) ON CONFLICT(account_id) DO UPDATE SET mapping=excluded.mapping,updated_at=now();
 UPDATE public.import_batches SET status='imported',imported_count=inserted,skipped_count=skipped WHERE id=batch;
 RETURN jsonb_build_object('batchId',batch,'imported',inserted,'skipped',skipped);
END $$;
CREATE OR REPLACE FUNCTION public.load_default_categories(p_groups jsonb, p_client uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE g jsonb; child text; parent uuid; n integer:=0;
BEGIN
 IF p_client IS NULL OR NOT public.can_write_client(p_client) THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(p_client::text));
 FOR g IN SELECT * FROM jsonb_array_elements(p_groups) LOOP
 SELECT id INTO parent FROM public.categories WHERE client_id=p_client AND kind=g->>'kind' AND parent_id IS NULL AND lower(btrim(name))=lower(btrim(g->>'name')) ORDER BY created_at LIMIT 1;
 IF parent IS NULL THEN INSERT INTO public.categories(owner_id,client_id,name,kind) VALUES(auth.uid(),p_client,g->>'name',g->>'kind') RETURNING id INTO parent; n:=n+1; END IF;
 FOR child IN SELECT jsonb_array_elements_text(g->'children') LOOP
 IF NOT EXISTS(SELECT 1 FROM public.categories WHERE client_id=p_client AND kind=g->>'kind' AND parent_id=parent AND lower(btrim(name))=lower(btrim(child))) THEN INSERT INTO public.categories(owner_id,client_id,name,kind,parent_id) VALUES(auth.uid(),p_client,child,g->>'kind',parent); n:=n+1; END IF;
 END LOOP;
 END LOOP;
 RETURN n;
END $function$;
CREATE OR REPLACE FUNCTION public.load_default_categories(p_groups jsonb) RETURNS integer LANGUAGE sql SET search_path = public AS $$ SELECT public.load_default_categories(p_groups, '11111111-1111-4111-8111-111111111111'::uuid) $$;
REVOKE ALL ON FUNCTION public.commit_csv_import(uuid,text,jsonb,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.commit_csv_import(uuid,text,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.load_default_categories(jsonb) FROM public,anon;
REVOKE ALL ON FUNCTION public.load_default_categories(jsonb,uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.load_default_categories(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_default_categories(jsonb,uuid) TO authenticated;

-- Políticas de segurança (substituem as de dono único).
DROP POLICY "owner insert" ON public.categories;
DROP POLICY "owner select" ON public.categories;
DROP POLICY "owner update" ON public.categories;
DROP POLICY "owner_all" ON public.categorization_rules;
DROP POLICY "owner_all" ON public.csv_mappings;
DROP POLICY "owner insert" ON public.financial_accounts;
DROP POLICY "owner select" ON public.financial_accounts;
DROP POLICY "owner update" ON public.financial_accounts;
DROP POLICY "owner all" ON public.import_batches;
DROP POLICY "owner_insert" ON public.recurring_adjustments;
DROP POLICY "owner_read" ON public.recurring_adjustments;
DROP POLICY "owner_all" ON public.recurring_items;
DROP POLICY "owner insert" ON public.transactions;
DROP POLICY "owner select" ON public.transactions;
DROP POLICY "owner update" ON public.transactions;
CREATE POLICY client_select ON public.financial_accounts FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.financial_accounts FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));
CREATE POLICY client_update ON public.financial_accounts FOR UPDATE TO authenticated USING (public.can_write_client(client_id)) WITH CHECK (public.can_write_client(client_id));
CREATE POLICY client_select ON public.categories FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.categories FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));
CREATE POLICY client_update ON public.categories FOR UPDATE TO authenticated USING (public.can_write_client(client_id)) WITH CHECK (public.can_write_client(client_id));
CREATE POLICY client_select ON public.transactions FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.transactions FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));
CREATE POLICY client_update ON public.transactions FOR UPDATE TO authenticated USING (public.can_write_client(client_id)) WITH CHECK (public.can_write_client(client_id));
CREATE POLICY client_select ON public.categorization_rules FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.categorization_rules FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));
CREATE POLICY client_update ON public.categorization_rules FOR UPDATE TO authenticated USING (public.can_write_client(client_id)) WITH CHECK (public.can_write_client(client_id));
CREATE POLICY client_delete ON public.categorization_rules FOR DELETE TO authenticated USING (public.can_write_client(client_id));
CREATE POLICY client_select ON public.csv_mappings FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.csv_mappings FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));
CREATE POLICY client_update ON public.csv_mappings FOR UPDATE TO authenticated USING (public.can_write_client(client_id)) WITH CHECK (public.can_write_client(client_id));
CREATE POLICY client_delete ON public.csv_mappings FOR DELETE TO authenticated USING (public.can_write_client(client_id));
CREATE POLICY client_select ON public.import_batches FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.import_batches FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));
CREATE POLICY client_update ON public.import_batches FOR UPDATE TO authenticated USING (public.can_write_client(client_id)) WITH CHECK (public.can_write_client(client_id));
CREATE POLICY client_delete ON public.import_batches FOR DELETE TO authenticated USING (public.can_write_client(client_id));
CREATE POLICY client_select ON public.recurring_items FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.recurring_items FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));
CREATE POLICY client_update ON public.recurring_items FOR UPDATE TO authenticated USING (public.can_write_client(client_id)) WITH CHECK (public.can_write_client(client_id));
CREATE POLICY client_delete ON public.recurring_items FOR DELETE TO authenticated USING (public.can_write_client(client_id));
CREATE POLICY client_select ON public.recurring_adjustments FOR SELECT TO authenticated USING (public.can_read_client(client_id));
CREATE POLICY client_insert ON public.recurring_adjustments FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.can_write_client(client_id));

-- Tabelas novas: leitura conforme o papel; escrita só do administrador.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY roles_select ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (public.can_read_client(id));
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY access_select ON public.client_access FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY access_insert ON public.client_access FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY access_update ON public.client_access FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY access_delete ON public.client_access FOR DELETE TO authenticated USING (public.is_admin());
REVOKE ALL ON public.user_roles, public.clients, public.client_access FROM anon, public;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_access TO authenticated;
GRANT ALL ON public.user_roles, public.clients, public.client_access TO service_role;
-- A tabela app_owner fica como registro histórico; o acesso passa a ser decidido por user_roles.

-- View de saldos: acrescenta client_id ao final (security_invoker mantido).
CREATE OR REPLACE VIEW public.account_balances WITH (security_invoker=true) AS
SELECT a.id AS account_id,
    a.owner_id,
    a.name,
    a.type,
    a.currency,
    a.archived_at,
    a.opening_balance,
    a.opening_date,
    COALESCE(sum(
        CASE
            WHEN t.status = 'posted'::text AND t.kind = 'income'::text AND t.account_id = a.id THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric)::numeric(18,2) AS income_posted,
    COALESCE(sum(
        CASE
            WHEN t.status = 'posted'::text AND t.kind = 'expense'::text AND t.account_id = a.id THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric)::numeric(18,2) AS expense_posted,
    COALESCE(sum(
        CASE
            WHEN t.status = 'posted'::text AND t.kind = 'transfer'::text AND t.destination_account_id = a.id THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric)::numeric(18,2) AS transfer_in,
    COALESCE(sum(
        CASE
            WHEN t.status = 'posted'::text AND t.kind = 'transfer'::text AND t.account_id = a.id THEN t.amount
            ELSE NULL::numeric
        END), 0::numeric)::numeric(18,2) AS transfer_out,
    COALESCE(sum(
        CASE
            WHEN t.status = 'pending'::text AND t.kind = 'income'::text AND t.account_id = a.id THEN t.amount
            WHEN t.status = 'pending'::text AND t.kind = 'expense'::text AND t.account_id = a.id THEN - t.amount
            WHEN t.status = 'pending'::text AND t.kind = 'transfer'::text AND t.destination_account_id = a.id THEN t.amount
            WHEN t.status = 'pending'::text AND t.kind = 'transfer'::text AND t.account_id = a.id THEN - t.amount
            ELSE NULL::numeric
        END), 0::numeric)::numeric(18,2) AS pending_net,
    (a.opening_balance + COALESCE(sum(
        CASE
            WHEN t.status = 'posted'::text THEN
            CASE
                WHEN t.kind = 'income'::text AND t.account_id = a.id THEN t.amount
                WHEN t.kind = 'expense'::text AND t.account_id = a.id THEN - t.amount
                WHEN t.kind = 'transfer'::text AND t.destination_account_id = a.id THEN t.amount
                WHEN t.kind = 'transfer'::text AND t.account_id = a.id THEN - t.amount
                ELSE NULL::numeric
            END
            ELSE NULL::numeric
        END), 0::numeric))::numeric(18,2) AS balance,
    a.client_id
   FROM financial_accounts a
     LEFT JOIN transactions t ON t.account_id = a.id OR t.destination_account_id = a.id
  GROUP BY a.id;

COMMIT;
