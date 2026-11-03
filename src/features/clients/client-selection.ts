export type ClientChoice = { id: string };

export const PERSONAL_CLIENT_ID = "11111111-1111-4111-8111-111111111111";

export function pickDefaultClient<T extends ClientChoice>(clients: T[], storedId: string | null): T | null {
  if (storedId) {
    const stored = clients.find((client) => client.id === storedId);
    if (stored) return stored;
  }
  return clients.find((client) => client.id === PERSONAL_CLIENT_ID) ?? clients[0] ?? null;
}
