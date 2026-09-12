# Optional Cheaply Auth migration

`https://auth.cheaply.fr` is the target central OAuth/OIDC issuer for Cheaply applications. Keep this integration optional until the new Auth service, PostgreSQL storage, Kubernetes rollout, DNS ownership, and canary checks are complete.

Browser extensions must not embed client secrets. If this extension later needs Cheaply identity, use Authorization Code with S256 PKCE from the extension/browser surface or broker through a server-side companion service.

Default production behavior must remain unchanged while `CHEAPLY_AUTH_ENABLED=false`.

Do not use implicit flow. Do not commit secrets or log tokens, authorization codes, cookies, client secrets, kubeconfig, or provider artifacts.
