import { queryOptions } from "@tanstack/react-query";
import { getMe, listClients } from "./clients.functions";

export const meQuery = () => queryOptions({ queryKey: ["me"], queryFn: () => getMe() });
export const clientsQuery = () => queryOptions({ queryKey: ["clients"], queryFn: () => listClients() });
