interface Env { API: Fetcher }

// Service binding keeps all browser traffic same-origin and the API Worker private.
export const onRequest: PagesFunction<Env> = ({ request, env }) => env.API.fetch(request);
