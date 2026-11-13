# Content Calendar

A Nebula miniapp where the team plans, approves and tracks X and LinkedIn posts
on one shared calendar. V1 has three tabs:

- **Posts.** A week or month calendar showing who posts what and when, plus a
  drafts queue and a rich-text composer with up to 20 images (X allows 4). A
  post moves from draft to scheduled to published. It must be approved before
  anyone can mark it as posted.
- **Analytics.** Numbers per post and per account, plus one rollup across all
  accounts.
- **Assets.** A shared image library: upload images, then pick them into a
  post.

**Settings** holds the accounts that post. Each one is a person or brand with
an optional LinkedIn account and an optional X account.

The look and feel come from Peacock (the AutoLinkedin reference app). Its
design tokens, UI kit, data components and shell are copied verbatim into
`src/shared/peacock`. Each screen reuses Peacock's CSS modules.

## Posting: manual, the same way Reply Desk does it

The app never publishes anything itself. Once a person approves a post:

1. They click **Post on X** or **Post on LinkedIn**. This opens the platform's
   own composer with the text filled in (`src/lib/share-links.ts`).
2. They download the images and attach them in that composer.
3. They press Post on the platform, signed in as the account they post from.
4. Back in the app, they click **Mark as posted** and can add the live URL.

Editing a post clears its approval.

## Data

The data lives in the same hosted Supabase project as nebula-web, in new
tables prefixed `cc_`:

- `cc_profiles`
- `cc_posts`
- `cc_assets`
- `cc_post_assets`
- `cc_post_metrics`
- `cc_follower_snapshots`

Images go in a private Storage bucket, `cc-assets`.

RLS is on with no policies, following the nebula-web convention. Only the
server routes can read or write, using `SUPABASE_SECRET_KEY`.

The schema is in `supabase/migrations/0001_content_calendar.sql`. Apply it by
hand in the Supabase SQL editor, the same way as every nebula-web migration.
It is safe to re-run.

Every row is scoped to the Nebula workspace id. The app reads it once through
the miniapp proxy (`/internal/proxy/nebula/workspace`). Who made a change comes
from `/internal/proxy/nebula/me` on each write.

## Analytics sourcing

V1 numbers are entered by hand from each platform's own analytics. See
[docs/analytics-sourcing.md](docs/analytics-sourcing.md) for the options and
the recommendation:

- **Next for X:** the official X API on pay-per-use.
- **Next for LinkedIn:** an XLSX import plus a Zernio pilot.

## Run

```bash
npm install
npm run dev   # needs SUPABASE_URL + SUPABASE_SECRET_KEY, and NEBULA_PROXY_URL + token (from ~/.nebula-env on a Nebula device)
```

To develop against a local database, run PostgREST against a local Postgres
that has the migration applied, then set:

- `CC_REST_URL`, the local PostgREST URL
- `CC_REST_KEY`, a service-role JWT for it

Production on the device runs `next build && next start` under supervisor as
the `content-calendar` service.
