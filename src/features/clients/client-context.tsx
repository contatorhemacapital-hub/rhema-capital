import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { pickDefaultClient } from "./client-selection";

type Me = { userId: string; email: string | null; isAdmin: boolean; clients: Tables<"clients">[] };
type Client = Tables<"clients">;
type ClientContextValue = {
  clientId: string | null;
  setClientId: (id: string) => void;
  client: Client | null;
  clients: Client[];
  isAdmin: boolean;
};

const STORAGE_KEY = "rhema:client";
const ClientContext = createContext<ClientContextValue | null>(null);

function storedClientId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function ClientProvider({ me, children }: { me: Me; children: ReactNode }) {
  const [clientId, setClientIdState] = useState<string | null>(() => pickDefaultClient(me.clients, storedClientId())?.id ?? null);

  useEffect(() => {
    const selected = pickDefaultClient(me.clients, storedClientId());
    setClientIdState(selected?.id ?? null);
    if (selected && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, selected.id);
      } catch {
        // A seleção em memória continua funcionando quando o armazenamento está indisponível.
      }
    }
  }, [me.clients]);

  const setClientId = (id: string) => {
    const selected = me.clients.find((client) => client.id === id);
    if (!selected) return;
    setClientIdState(selected.id);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, selected.id);
      } catch {
        // A escolha temporária continua válida quando o armazenamento do navegador está indisponível.
      }
    }
  };

  const value: ClientContextValue = {
    clientId: me.clients.some((client) => client.id === clientId) ? clientId : null,
    setClientId,
    client: me.clients.find((client) => client.id === clientId) ?? null,
    clients: me.clients,
    isAdmin: me.isAdmin,
  };

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
}

export function useClient(): ClientContextValue {
  const context = useContext(ClientContext);
  if (!context) throw new Error("useClient deve ser usado dentro de ClientProvider");
  return context;
}
