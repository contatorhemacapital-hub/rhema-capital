-- 0002: correções da Fase 2.
-- (1) phase2_due_dates: a parcela 1 passa a ser o primeiro vencimento válido (>= start_date); a numeração das parcelas não depende da janela consultada.
-- (2) commit_csv_import: lançamentos idênticos só são pulados até a quantidade que já existia ANTES desta importação (comparação por contagem); referência externa repetida continua sendo duplicada.
-- Idempotente (CREATE OR REPLACE). Mesmas assinaturas, mesmos atributos e mesmas permissões.

CREATE OR REPLACE FUNCTION public.phase2_due_dates(r public.recurring_items, date_from date, date_to date) RETURNS SETOF date LANGUAGE sql STABLE SET search_path = public AS $$
 WITH base AS (
 SELECT CASE WHEN LEAST((date_trunc('month', r.start_date) + (r.due_day - 1) * interval '1 day')::date, (date_trunc('month', r.start_date) + interval '1 month - 1 day')::date) < r.start_date
 THEN date_trunc('month', r.start_date) + interval '1 month' ELSE date_trunc('month', r.start_date) END AS first_month
 )
 SELECT due FROM (
 SELECT LEAST((m + (r.due_day - 1) * interval '1 day')::date, (m + interval '1 month - 1 day')::date) due,
 (extract(year FROM age(m, b.first_month))::integer*12 + extract(month FROM age(m, b.first_month))::integer + 1) installment
 FROM base b, generate_series(greatest(b.first_month, date_trunc('month', date_from)), date_trunc('month', date_to), interval '1 month') m WHERE r.frequency='monthly'
 UNION ALL SELECT r.start_date,1 WHERE r.frequency='once'
 UNION ALL SELECT d, row_number() OVER (ORDER BY d)::integer FROM (SELECT DISTINCT unnest(r.custom_dates) d) dates WHERE r.frequency='custom'
 ) x WHERE due >= r.start_date AND due BETWEEN date_from AND date_to AND (r.end_date IS NULL OR due <= r.end_date) AND (r.installment_count IS NULL OR installment <= r.installment_count)
$$;
CREATE OR REPLACE FUNCTION public.commit_csv_import(p_account uuid,p_file text,p_mapping jsonb,p_rows jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE row jsonb; batch uuid; r public.recurring_items; expected numeric; actual numeric; due date; linked uuid; inserted integer:=0; skipped integer:=0; txid uuid; action text; eff date; fp text; n_exist integer; used integer; fp_used jsonb:='{}'::jsonb;
BEGIN
 IF NOT public.is_owner() OR NOT EXISTS(SELECT 1 FROM public.financial_accounts WHERE id=p_account AND owner_id=auth.uid() AND archived_at IS NULL) THEN RAISE EXCEPTION 'Conta inválida'; END IF;
 IF jsonb_array_length(p_rows)>2000 THEN RAISE EXCEPTION 'Limite de 2000 linhas por arquivo'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || p_account::text));
 INSERT INTO public.import_batches(owner_id,account_id,file_name,status) VALUES(auth.uid(),p_account,p_file,'draft') RETURNING id INTO batch;
 FOR row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
 actual:=(row->>'amount')::numeric; due:=NULLIF(row->>'occurrenceDate','')::date; linked:=NULLIF(row->>'recurringId','')::uuid; action:=coalesce(row->>'action','reject');
 IF NULLIF(row->>'externalRef','') IS NOT NULL AND EXISTS(SELECT 1 FROM public.transactions t WHERE t.owner_id=auth.uid() AND t.account_id=p_account AND t.external_ref=row->>'externalRef') THEN skipped:=skipped+1; CONTINUE; END IF;
 fp:=(row->>'date')||'|'||(row->>'kind')||'|'||to_char(actual,'FM9999999999990.00')||'|'||regexp_replace(lower(btrim(row->>'description')), '\s+', ' ', 'g');
 SELECT count(*) INTO n_exist FROM public.transactions t WHERE t.owner_id=auth.uid() AND t.account_id=p_account AND t.import_batch_id IS DISTINCT FROM batch AND t.date=(row->>'date')::date AND t.amount=actual AND t.kind=row->>'kind' AND regexp_replace(lower(btrim(t.description)), '\s+', ' ', 'g')=regexp_replace(lower(btrim(row->>'description')), '\s+', ' ', 'g');
 used:=coalesce((fp_used->>fp)::integer,0);
 IF used<n_exist THEN fp_used:=jsonb_set(fp_used,ARRAY[fp],to_jsonb(used+1),true); skipped:=skipped+1; CONTINUE; END IF;
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
