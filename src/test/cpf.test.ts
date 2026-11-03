import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf, maskCpf } from "@/features/clients/cpf";

describe("CPF", () => {
  it("valida CPF com e sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita sequências iguais e valores incompletos", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });

  it("formata e mascara CPF", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.***.***-25");
  });
});
