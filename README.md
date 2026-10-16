
# Chat

Live app: [gpt-harness.pages.dev](https://gpt-harness.pages.dev).

Android frontend: see [android/README.md](android/README.md). Run `npm run android:build` to build an APK using the same mobile UI and Cloudflare server.

Next.js static frontend on Cloudflare Pages, with a private Cloudflare Worker API. D1 stores accounts, hashed sessions, and per-user conversations. A private R2 bucket stores uploaded files and generated images. No MongoDB, Cloudinary, or Node server is needed.

Users create an email/password account, then enter their own OpenAI API key in Settings. Keys remain in account-scoped browser storage and are forwarded to OpenAI only for requests; they are never stored in D1 or R2. Each browser/device needs its own key. GPT-6.1 Sol, GPT-6.1 Luna, GPT-6 Astra, GPT-6 Sol, GPT-6 Terra, and GPT-6 Luna always appear in the model menu. Add future IDs to `MANUAL_CHAT_MODEL_IDS` in `src/lib/models.ts`. These manual choices remain visible even if OpenAI omits them from discovery; OpenAI still determines whether a key can use a selected model and errors appear in the chat.

The app also fetches available models on startup, API-key changes, opening the model menu, and returning to the tab. Additional GPT-6 or newer text models returned for that key are merged into the menu without duplicates. Image generation continues to use the newest available GPT Image generation returned by OpenAI.

New chats default to GPT-6.1 Sol with Medium effort. Answers render formatted Markdown as they stream, with short text and interface transitions that respect reduced-motion preferences. Click empty composer space to focus it; Enter sends and Shift+Enter adds a line on desktop and mobile.

Editing a prompt replaces only its own reply and preserves every later turn. Image prompts keep their image model and size when edited, including after reopening the chat or switching to text mode. Image follow-ups include earlier instructions and up to sixteen recent image references; the browser sends private R2 URLs that the Worker resolves only for the signed-in owner. Earlier image prompts exclude later turns from their regeneration context.

## Local development

Use Node.js 22.12+ or 24+.

```bash
npm ci
npm run dev
```

This applies migrations to local D1, builds `out/`, and starts Pages with the API service binding at `http://localhost:8788`. Local D1/R2 data stays in `.wrangler/state`. No Cloudflare login is required for local development. After editing the frontend, rebuild with `npm run build`; restart `npm run preview` if needed. Worker changes reload automatically.

```bash
npm run lint
npm run check:types
npm test
npm run build
```

With the local preview running, `npm run test:smoke` also exercises registration, private history, R2, and logout through the Pages service binding. It creates disposable local accounts only.

Worker tests use Cloudflare's local runtime with actual D1/R2 bindings and mocked OpenAI responses. Frontend tests use jsdom to check composer input, incremental formatted rendering, preserved later messages, image follow-ups and editing, and closing transitions. The suites also cover sign-in, session expiry and logout, rate limits, cross-account isolation, message ordering/deletion, private uploads, and model discovery. They do not make paid OpenAI calls.

## Deploy to Cloudflare

Authenticate and create the resources once:

```bash
npx wrangler login
npx wrangler d1 create gpt-harness
npx wrangler r2 bucket create gpt-harness-files
npx wrangler pages project create gpt-harness --production-branch main
```

Copy the D1 `database_id` from the create output into `worker/wrangler.jsonc`, replacing the current value when deploying to a different database. If you change any resource names, update both Wrangler files and the deployment scripts. R2 must be enabled in the account. Keep the bucket private.

```bash
npm run deploy
```

The deployment script validates, tests, builds, applies remote D1 migrations, deploys the API Worker, then deploys Pages (including `functions/api/[[path]].ts`). Pages forwards `/api/*` to the `API` service binding; the browser uses same-origin HttpOnly session cookies. The API Worker has no public workers.dev or preview URL. The Pages deployment command prints the live URL.

If deploying through Pages Git integration, use build command `npm run build`, output directory `out`, and set the `API` service binding to `gpt-harness-api`. Deploy/migrate the Worker first. Deploy previews should use a separate Worker, database, and bucket if they must be isolated from production accounts.

## Existing data and rollback

The previous database had no account ownership. Existing data is not automatically assigned to new users. Before retiring the old services, export and back up the old conversations, messages, and files. Import requires an explicit mapping to verified user IDs and copying binaries into those users' private R2 prefixes. This repository does not connect to or delete the old services.

Keep the previous deployment and storage backups until the new deployment is verified. To roll back, restore the previous deployment and its old service configuration. New D1/R2 data remains intact; it is not automatically copied back. Do not drop the D1 tables or delete the R2 bucket during rollback. Future schema changes should use additional migrations rather than editing the applied initial migration.

Document mode has been removed from the (+) menu. Regular image, PDF, and text attachments still work. Existing document-shaped messages can still render and export through the browser print dialog.

References: [Next.js static export on Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Pages service bindings](https://developers.cloudflare.com/pages/functions/bindings/), [OpenAI model discovery](https://developers.openai.com/api/reference/resources/models/methods/list).
