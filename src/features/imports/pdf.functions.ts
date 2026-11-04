import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseInterStatement } from "./pdf-inter";
import type { PdfStatementResult } from "./statement-rows";

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const MAX_PAGES = 80;

// Lê um extrato em PDF (texto), confere a cadeia de saldos e devolve os lançamentos. Nada é gravado aqui.
export const parseStatementPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ contentBase64: z.string().min(100).max(12_000_000) }).parse(d))
  .handler(async ({ data }): Promise<PdfStatementResult> => {
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(data.contentBase64), (c) => c.charCodeAt(0));
    } catch {
      throw new Error("Arquivo PDF inválido");
    }
    if (bytes.length > MAX_PDF_BYTES) throw new Error("PDF maior que 8 MB");
    if (String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new Error("O arquivo não é um PDF");

    const { getDocumentProxy, extractText } = await import("unpdf");
    let pages: string[];
    try {
      const pdf = await getDocumentProxy(bytes);
      if (pdf.numPages > MAX_PAGES) throw new Error(`PDF com mais de ${MAX_PAGES} páginas`);
      const result = await extractText(pdf, { mergePages: false });
      pages = result.text;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("PDF com mais")) throw e;
      throw new Error("Não foi possível ler o PDF (pode estar protegido por senha ou ser uma imagem escaneada)");
    }
    if (pages.join("").trim().length < 50) throw new Error("O PDF não tem texto legível (parece uma imagem escaneada)");

    const st = parseInterStatement(pages);
    if (!st.rows.length) throw new Error("Nenhum lançamento encontrado no extrato");
    const integrityOk =
      st.balanceMismatches.length === 0 && st.dayMismatches.length === 0 && st.orphanRecords === 0 && st.warnings.length === 0 && st.headerBalanceMatches !== false;
    return {
      rows: st.rows.map((r) => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        kind: r.kind,
        opType: r.opType,
        selfTransfer: r.selfTransfer,
      })),
      periodStart: st.periodStart,
      periodEnd: st.periodEnd,
      integrityOk,
      checks: {
        balanceMismatches: st.balanceMismatches.length,
        dayMismatches: st.dayMismatches.length,
        orphanRecords: st.orphanRecords,
        headerBalanceMatches: st.headerBalanceMatches,
      },
      warnings: st.warnings.slice(0, 10),
    };
  });
