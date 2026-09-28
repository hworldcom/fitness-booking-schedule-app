declare module "cloudflare:workers" {
  export const env: {
    MOVX_DATABASE?: {
      connectionString?: unknown;
    };
  };
}
