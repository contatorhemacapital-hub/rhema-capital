import { describe, expect, it } from "vitest";
import { PERSONAL_CLIENT_ID, pickDefaultClient } from "@/features/clients/client-selection";

const personal = { id: PERSONAL_CLIENT_ID, name: "Leonardo (pessoal)" };
const other = { id: "22222222-2222-4222-8222-222222222222", name: "Cliente Teste" };

describe("pickDefaultClient", () => {
  it("mantém o cliente guardado quando ele existe", () => {
    expect(pickDefaultClient([personal, other], other.id)).toBe(other);
  });

  it("usa o cliente pessoal quando a escolha guardada não existe", () => {
    expect(pickDefaultClient([personal, other], "cliente-removido")).toBe(personal);
  });

  it("usa o primeiro cliente quando o pessoal não está na lista", () => {
    expect(pickDefaultClient([other], null)).toBe(other);
  });

  it("devolve null quando a lista está vazia", () => {
    expect(pickDefaultClient([], null)).toBeNull();
  });
});
