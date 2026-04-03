import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { resolveQuery, handleMutation } from "./staticData";

// ---------------------------------------------------------------------------
// Static-only build: all data comes from the in-memory store in staticData.ts.
// No server requests are made.
// ---------------------------------------------------------------------------

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  if (method.toUpperCase() !== "GET") {
    return handleMutation(url, data);
  }
  // GET via apiRequest (rare, but keep compatible)
  const result = await resolveQuery([url]);
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  (_options) =>
  async ({ queryKey }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return resolveQuery(queryKey) as any;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
