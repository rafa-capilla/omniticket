
/**
 * Wrapper sobre fetch() que verifica response.ok y lanza errores descriptivos.
 * - 401: lanza Error("401") para que App.tsx dispare el flujo de re-autenticación
 * - 429: lanza error con mensaje de rate limit
 * - otros errores HTTP: extrae el mensaje de error del body JSON de Google APIs
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    if (res.status === 401) throw new Error("401");
    if (res.status === 429) throw new Error("Rate limit alcanzado. Espera unos segundos e inténtalo de nuevo.");
    const body: Record<string, unknown> = await res.json().catch(() => ({}));
    const error = body.error as Record<string, unknown> | undefined;
    const msg = (typeof error?.message === 'string' ? error.message : null) ?? `Error HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res;
}
