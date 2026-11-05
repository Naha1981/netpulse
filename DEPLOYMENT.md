# NetPulse deployment
Cloudflare Workers runs the app through vinext. Neon is the only production database. Supabase files remain historical migration source only.

Required server secrets: DATABASE_URL (restricted netpulse_runtime role), NEXT_PUBLIC_SITE_URL, GROQ_API_KEY, AI_MODE. AI_MODE=rules keeps imports and supported database questions working without paid AI or quota retries. The UI labels rules-based results. Remove that setting only after verifying the AI service's available quota.

Build: npm ci && npm run typecheck && npm test && npm run build:vinext
Deploy: wrangler deploy --config dist/server/wrangler.json --secrets-file /private/path/secrets.json
Never commit secrets, database dumps, sessions, or uploaded files. The custom domain is routed only to the netpulse Worker in the domain-owning account.

Migration SQL is in supabase/neon-schema.sql (historical directory name). Apply to an isolated database with an administrator connection. The role netpulse_runtime must exist without neon_superuser, CREATEDB, or CREATEROLE. Set its password privately. Preserve original auth user IDs/password hashes and operational rows when importing. Runtime queries set app.user_id inside the same transaction as every data query; RLS enforces membership. New passwords use WebCrypto PBKDF2; legacy bcrypt hashes still work without resets.

Private source uploads are base64 values in raw_files, protected by tenant RLS.15MB upload and20000row import caps are enforced. Free plans have finite CPU/storage/request limits; large spreadsheets can exceed worker CPU even below the byte limit. No paid upgrade is automatic.

Account deletion is permanent, removes owned organizations and dependent imports/reports/files, then user and sessions. Confirm in the browser. Do not delete the original QA/source account as part of routine new-account testing.
