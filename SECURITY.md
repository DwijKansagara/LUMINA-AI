# Security

Report suspected vulnerabilities privately to **work.dwijkansagara@gmail.com**.

LUMINA is a static, login-free browser experiment. Camera and microphone access begins only after a clear user action and browser permission. Media processing remains in the browser; the site has no passwords, JWTs, uploads to a server, database client, payments, webhooks, or arbitrary server-side URL fetching. Model paths are fixed by the application. UI output uses text-safe DOM updates.

The shared appreciation API validates exact origins and request intent, uses parameterized SQL and durable rate limiting, stores only salted identifiers, keeps database credentials server-side, and revokes public database privileges.

Any future authentication, uploads, webhooks, outbound fetches, or database clients must pass the workspace security baseline first. Production source maps, embedded secrets, default credentials, and sensitive logs are forbidden.
