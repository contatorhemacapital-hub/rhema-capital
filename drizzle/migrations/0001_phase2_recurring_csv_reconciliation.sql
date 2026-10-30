CREATE TABLE public.recurring_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(),
 kind text NOT NULL CHECK (kind IN ('income','expense')), description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
 category_id uuid NOT NULL REFERENCES public.categories(id), account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
 amount numeric(18,2) NOT NULL CHECK (amount > 0), due_day integer NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
 start_date date NOT NULL, end_date date, installment_count integer CHECK (installment_count BETWEEN 1 AND 1200),
 frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','once','custom')), custom_dates date[] NOT NULL DEFAULT '{}',
 active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (end_date IS NULL OR end_date >= start_date), CHECK (end_date IS NULL OR installment_count IS NULL),
 CHECK (frequency <> 'custom' OR cardinality(custom_dates) > 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_items TO authenticated;
GRANT ALL ON public.recurring_items TO service_role;
ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all ON public.recurring_items FOR ALL TO authenticated USING (owner_id = auth.uid() AND public.is_owner()) WITH CHECK (owner_id = auth.uid() AND public.is_owner());
CREATE TRIGGER recurring_updated BEFORE UPDATE ON public.recurring_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TABLE public.recurring_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), recurring_id uuid NOT NULL REFERENCES public.recurring_items(id),
 effective_from date NOT NULL, previous_amount numeric(18,2) NOT NULL, new_amount numeric(18,2) NOT NULL CHECK (new_amount > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.recurring_adjustments TO authenticated;
GRANT ALL ON public.recurring_adjustments TO service_role;
ALTER TABLE public.recurring_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.recurring_adjustments FOR SELECT TO authenticated USING (owner_id = auth.uid() AND public.is_owner());
CREATE POLICY owner_insert ON public.recurring_adjustments FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND public.is_owner() AND EXISTS (SELECT 1 FROM public.recurring_items r WHERE r.id = recurring_id AND r.owner_id = auth.uid()));
CREATE TABLE public.categorization_rules (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), term text NOT NULL CHECK (char_length(btrim(term)) BETWEEN 2 AND 100),
 category_id uuid NOT NULL REFERENCES public.categories(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id, term)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorization_rules TO authenticated;
GRANT ALL ON public.categorization_rules TO service_role;
ALTER TABLE public.categorization_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all ON public.categorization_rules FOR ALL TO authenticated USING (owner_id = auth.uid() AND public.is_owner()) WITH CHECK (owner_id = auth.uid() AND public.is_owner() AND EXISTS (SELECT 1 FROM public.categories c WHERE c.id = category_id AND c.owner_id = auth.uid()));
CREATE TABLE public.csv_mappings (
 account_id uuid PRIMARY KEY REFERENCES public.financial_accounts(id), owner_id uuid NOT NULL DEFAULT auth.uid(), mapping jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.csv_mappings TO authenticated;
GRANT ALL ON public.csv_mappings TO service_role;
ALTER TABLE public.csv_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all ON public.csv_mappings FOR ALL TO authenticated USING (owner_id = auth.uid() AND public.is_owner()) WITH CHECK (owner_id = auth.uid() AND public.is_owner() AND EXISTS (SELECT 1 FROM public.financial_accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()));
ALTER TABLE public.transactions ADD COLUMN recurring_id uuid REFERENCES public.recurring_items(id), ADD COLUMN competence date, ADD COLUMN occurrence_date date;
ALTER TABLE public.import_batches ADD COLUMN account_id uuid REFERENCES public.financial_accounts(id), ADD COLUMN imported_count integer NOT NULL DEFAULT 0, ADD COLUMN skipped_count integer NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX uq_tx_recurring_occurrence ON public.transactions(owner_id, recurring_id, occurrence_date) WHERE recurring_id IS NOT NULL AND status <> 'cancelled';
CREATE INDEX idx_recurring_owner ON public.recurring_items(owner_id, active);
CREATE OR REPLACE FUNCTION public.phase2_validate_recurring() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE id=NEW.account_id AND owner_id=NEW.owner_id AND archived_at IS NULL) THEN RAISE EXCEPTION 'Conta inválida ou arquivada'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id=NEW.category_id AND owner_id=NEW.owner_id AND kind=NEW.kind AND archived_at IS NULL) THEN RAISE EXCEPTION 'Categoria inválida'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(NEW.custom_dates) d WHERE d < NEW.start_date OR (NEW.end_date IS NOT NULL AND d > NEW.end_date)) THEN RAISE EXCEPTION 'Datas avulsas fora da vigência'; END IF;
 IF TG_OP='UPDATE' AND NEW.owner_id <> OLD.owner_id THEN RAISE EXCEPTION 'Proprietário não pode mudar'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER recurring_validate BEFORE INSERT OR UPDATE ON public.recurring_items FOR EACH ROW EXECUTE FUNCTION public.phase2_validate_recurring();
CREATE OR REPLACE FUNCTION public.phase2_due_dates(r public.recurring_items, date_from date, date_to date) RETURNS SETOF date LANGUAGE sql STABLE SET search_path = public AS $$
 SELECT due FROM (
 SELECT LEAST((m + (r.due_day - 1) * interval '1 day')::date, (m + interval '1 month - 1 day')::date) due,
 (extract(year FROM age(m, date_trunc('month', r.start_date)))::integer*12 + extract(month FROM age(m, date_trunc('month', r.start_date)))::integer + 1) installment
 FROM generate_series(date_trunc('month', greatest(r.start_date,date_from)),date_trunc('month',date_to),interval '1 month') m WHERE r.frequency='monthly'
 UNION ALL SELECT r.start_date,1 WHERE r.frequency='once'
 UNION ALL SELECT d, row_number() OVER (ORDER BY d)::integer FROM (SELECT DISTINCT unnest(r.custom_dates) d) dates WHERE r.frequency='custom'
 ) x WHERE due >= r.start_date AND due BETWEEN date_from AND date_to AND (r.end_date IS NULL OR due <= r.end_date) AND (r.installment_count IS NULL OR installment <= r.installment_count)
$$;
CREATE OR REPLACE FUNCTION public.phase2_expected_amount(p_id uuid, p_due date) RETURNS numeric LANGUAGE sql STABLE SET search_path=public AS $$
 SELECT coalesce((SELECT a.new_amount FROM public.recurring_adjustments a WHERE a.recurring_id=r.id AND a.effective_from<=p_due ORDER BY a.effective_from DESC,a.created_at DESC LIMIT 1),
 (SELECT a.previous_amount FROM public.recurring_adjustments a WHERE a.recurring_id=r.id ORDER BY a.effective_from,a.created_at LIMIT 1),r.amount) FROM public.recurring_items r WHERE r.id=p_id
$$;
CREATE OR REPLACE FUNCTION public.phase2_validate_link() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE r public.recurring_items;
BEGIN
 IF NEW.recurring_id IS NOT NULL THEN
 SELECT * INTO r FROM public.recurring_items WHERE id=NEW.recurring_id AND owner_id=NEW.owner_id;
 IF r.id IS NULL OR r.account_id<>NEW.account_id OR r.category_id IS DISTINCT FROM NEW.category_id OR r.kind<>NEW.kind OR NEW.occurrence_date IS NULL OR NEW.competence IS DISTINCT FROM date_trunc('month',NEW.occurrence_date)::date OR NOT EXISTS (SELECT 1 FROM public.phase2_due_dates(r,NEW.occurrence_date,NEW.occurrence_date)) THEN RAISE EXCEPTION 'Vínculo com previsto inválido'; END IF;
 ELSIF NEW.competence IS NOT NULL OR NEW.occurrence_date IS NOT NULL THEN RAISE EXCEPTION 'Competência exige previsto'; END IF;
 IF NEW.import_batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.import_batches b WHERE b.id=NEW.import_batch_id AND b.owner_id=NEW.owner_id) THEN RAISE EXCEPTION 'Lote inválido'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tx_validate_link BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.phase2_validate_link();
CREATE OR REPLACE FUNCTION public.load_default_categories(p_groups jsonb) RETURNS integer LANGUAGE plpgsql SET search_path=public AS $$
DECLARE g jsonb; child text; parent uuid; n integer:=0;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));
 FOR g IN SELECT * FROM jsonb_array_elements(p_groups) LOOP
 SELECT id INTO parent FROM public.categories WHERE owner_id=auth.uid() AND kind=g->>'kind' AND parent_id IS NULL AND lower(btrim(name))=lower(btrim(g->>'name')) ORDER BY created_at LIMIT 1;
 IF parent IS NULL THEN INSERT INTO public.categories(owner_id,name,kind) VALUES(auth.uid(),g->>'name',g->>'kind') RETURNING id INTO parent; n:=n+1; END IF;
 FOR child IN SELECT jsonb_array_elements_text(g->'children') LOOP
 IF NOT EXISTS(SELECT 1 FROM public.categories WHERE owner_id=auth.uid() AND kind=g->>'kind' AND parent_id=parent AND lower(btrim(name))=lower(btrim(child))) THEN INSERT INTO public.categories(owner_id,name,kind,parent_id) VALUES(auth.uid(),child,g->>'kind',parent); n:=n+1; END IF;
 END LOOP;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.load_default_categories(jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.load_default_categories(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.commit_csv_import(p_account uuid,p_file text,p_mapping jsonb,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE row jsonb; batch uuid; r public.recurring_items; expected numeric; actual numeric; due date; linked uuid; inserted integer:=0; skipped integer:=0; txid uuid; action text; eff date;
BEGIN
 IF NOT public.is_owner() OR NOT EXISTS(SELECT 1 FROM public.financial_accounts WHERE id=p_account AND owner_id=auth.uid() AND archived_at IS NULL) THEN RAISE EXCEPTION 'Conta inválida'; END IF;
 IF jsonb_array_length(p_rows)>2000 THEN RAISE EXCEPTION 'Limite de 2000 linhas por arquivo'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || p_account::text));
 INSERT INTO public.import_batches(owner_id,account_id,file_name,status) VALUES(auth.uid(),p_account,p_file,'draft') RETURNING id INTO batch;
 FOR row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
 actual:=(row->>'amount')::numeric; due:=NULLIF(row->>'occurrenceDate','')::date; linked:=NULLIF(row->>'recurringId','')::uuid; action:=coalesce(row->>'action','reject');
 IF EXISTS(SELECT 1 FROM public.transactions t WHERE t.owner_id=auth.uid() AND t.account_id=p_account AND ((NULLIF(row->>'externalRef','') IS NOT NULL AND t.external_ref=row->>'externalRef') OR (t.date=(row->>'date')::date AND t.amount=actual AND t.kind=row->>'kind' AND regexp_replace(lower(btrim(t.description)), '\s+', ' ', 'g')=regexp_replace(lower(btrim(row->>'description')), '\s+', ' ', 'g')))) THEN skipped:=skipped+1; CONTINUE; END IF;
 IF action='reject' THEN linked:=NULL; due:=NULL; END IF;
 IF linked IS NOT NULL THEN
 SELECT * INTO r FROM public.recurring_items WHERE id=linked AND owner_id=auth.uid() FOR UPDATE;
 IF r.id IS NULL OR NOT r.active OR r.account_id<>p_account OR r.category_id IS DISTINCT FROM NULLIF(row->>'categoryId','')::uuid OR r.kind<>row->>'kind' OR due IS NULL OR NOT EXISTS(SELECT 1 FROM public.phase2_due_dates(r,due,due)) THEN RAISE EXCEPTION 'Previsto inválido'; END IF;
 expected:=public.phase2_expected_amount(linked,due);
 IF action='auto' AND actual<>expected THEN RAISE EXCEPTION 'Confirme a divergência de valor'; END IF;
 IF action NOT IN ('auto','month','adjust') THEN RAISE EXCEPTION 'Confirmação inválida'; END IF;
 IF EXISTS(SELECT 1 FROM public.transactions WHERE owner_id=auth.uid() AND recurring_id=linked AND occurrence_date=due AND status<>'cancelled') THEN RAISE EXCEPTION 'Ocorrência já conciliada'; END IF;
 END IF;
 INSERT INTO public.transactions(owner_id,kind,status,account_id,destination_account_id,category_id,amount,date,description,external_ref,import_batch_id,recurring_id,competence,occurrence_date)
 VALUES(auth.uid(),row->>'kind','posted',p_account,NULLIF(row->>'destinationAccountId','')::uuid,CASE WHEN row->>'kind'='transfer' THEN NULL ELSE NULLIF(row->>'categoryId','')::uuid END,actual,(row->>'date')::date,row->>'description',NULLIF(row->>'externalRef',''),batch,linked,CASE WHEN linked IS NOT NULL THEN date_trunc('month',due)::date END,due) RETURNING id INTO txid;
 IF linked IS NOT NULL AND action='adjust' AND actual<>expected THEN
 eff:=(date_trunc('month',due)+interval '1 month')::date;
 IF EXISTS(SELECT 1 FROM public.recurring_adjustments WHERE recurring_id=linked AND effective_from>eff) THEN RAISE EXCEPTION 'Há reajuste posterior; confirme só este mês'; END IF;
 INSERT INTO public.recurring_adjustments(owner_id,recurring_id,effective_from,previous_amount,new_amount) VALUES(auth.uid(),linked,eff,public.phase2_expected_amount(linked,eff),actual);
 UPDATE public.recurring_items SET amount=actual WHERE id=linked;
 END IF;
 inserted:=inserted+1;
 END LOOP;
 INSERT INTO public.csv_mappings(account_id,owner_id,mapping) VALUES(p_account,auth.uid(),p_mapping) ON CONFLICT(account_id) DO UPDATE SET mapping=excluded.mapping,updated_at=now();
 UPDATE public.import_batches SET status='imported',imported_count=inserted,skipped_count=skipped WHERE id=batch;
 RETURN jsonb_build_object('batchId',batch,'imported',inserted,'skipped',skipped);
END $$;
REVOKE ALL ON FUNCTION public.commit_csv_import(uuid,text,jsonb,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.commit_csv_import(uuid,text,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.phase2_due_dates(public.recurring_items,date,date), public.phase2_expected_amount(uuid,date) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.phase2_due_dates(public.recurring_items,date,date), public.phase2_expected_amount(uuid,date) TO authenticated;