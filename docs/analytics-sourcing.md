# Analytics tab: where the numbers come from

Checked 2026-11-11. V1 of the Analytics tab reads `cc_post_metrics` and
`cc_follower_snapshots`. Every row records its `source` (`manual`, `csv`,
`x_api`, `linkedin_api`), so new sources can be added without changing the
screen.

## Recommendation

**For V1 (the next 2–4 weeks):**

1. **X: use the official X API.** X now charges per use, with no subscription:
   $0.005 per post read and $0.01 per user read.
   - **Data available:** any token can read `public_metrics`, which includes
     impressions. Link clicks and profile clicks need the author's own OAuth
     token, and only cover posts from the last 30 days.
   - **How it would work:** each teammate connects their account once through
     OAuth 2.0 PKCE with the scopes `tweet.read users.read offline.access`. A
     nightly job then finds their posts (`GET /2/users/:id/tweets`), saves the
     metrics, and records follower counts.
   - **Cost:** about **$5–20 a month** at our volume.
   - **Risk:** no terms-of-service risk.
2. **LinkedIn: manual entry plus import of LinkedIn's own analytics export.**
   This is what the app does today. You paste the post URL and enter the
   numbers from the post's analytics view. The next step is importing the
   XLSX file LinkedIn exports for personal profiles and company pages.
   - **Cost:** $0, with no terms-of-service risk.
   - **Downside:** someone has to do it by hand each time.
3. **In parallel: a two-week pilot of Zernio** (formerly Late), about $78 a
   month for 20 accounts. It already has LinkedIn's API approval, and its API
   returns impressions for personal LinkedIn posts and company-page posts.
   - **Test before relying on it:** connect two personal accounts and the
     company page, and check that it returns impressions for posts made
     outside Zernio (we only have the post URN).

**Later (1–3 months):**

- If the Zernio pilot works, get LinkedIn numbers from Zernio and stop
  importing CSVs.
- Separately, apply for LinkedIn's Community Management API Development tier
  with a new LinkedIn app owned by Agent Labs.
  - **Approval takes weeks** and isn't guaranteed. LinkedIn requires a legal
    entity, verified business email, privacy policy, and a company page
    super-admin to verify the app.
  - **Moving up to the Standard tier** needs a recorded demo and another
    review.
- Get a decision before showing everyone's personal LinkedIn numbers on one
  team dashboard. LinkedIn's restricted-use rules limit member data to people
  associated with that profile. Its storage rules also cap some member
  social-activity data at 48 hours.
- **Don't scrape.** Apify-style scrapers cost under $5 a month, but:
  - they can't see LinkedIn impressions, which LinkedIn shows only to the
    author;
  - they break LinkedIn's and X's terms;
  - logged-in scraping puts our own accounts at risk of bans.

## Options compared

| Option | Impressions? | Cost/mo at our volume | Setup | Reliability | ToS risk |
|---|---|---|---|---|---|
| X API (official, pay-per-use) | Yes. Clicks only with the author's own token, posts under 30 days old | ~$5–20 | Days: card on file plus a one-time OAuth connect per member | High | None |
| LinkedIn Community Management API | Yes, personal and company page | $0 | Weeks or more. Development tier, then a demo review for Standard | High once approved | Low (display and storage rules apply) |
| Zernio (formerly Late) | Yes, LinkedIn personal and company page | ~$78 for 20 accounts, plus X usage | Hours | Medium (vendor) | Low |
| Ayrshare | Yes, LinkedIn and X (needs our own X keys since Mar 2026) | $299 (10 profiles) to $599 (30) | Hours | Medium–high | Low |
| Metricool | Yes, LinkedIn personal and company page, plus X | ~$45–67, plus ~$5 per X account | Hours | Medium | Low |
| Scrapers (Apify etc.) | X view counts only. **No LinkedIn impressions** | <$5 | Hours | Low | **High** |
| Manual / CSV import (this V1) | Yes, whatever the native analytics show | $0 | Built | High, but by hand | None |

## Sources

- **X API:** [pricing](https://docs.x.com/x-api/getting-started/pricing), [metrics](https://docs.x.com/x-api/fundamentals/metrics), [rate limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- **LinkedIn APIs:**
  - [member post statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics)
  - [member follower statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/follower-statistics)
  - [organization share statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics)
  - [app review](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review)
  - [restricted use cases](https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases)
  - [data storage requirements](https://learn.microsoft.com/en-us/linkedin/marketing/data-storage-requirements)
- **Vendors:**
  - Zernio: [pricing](https://zernio.com/pricing), [LinkedIn post analytics](https://docs.zernio.com/analytics/get-linkedin-post-analytics)
  - Ayrshare: [post analytics](https://www.ayrshare.com/docs/apis/analytics/post)
  - Metricool: [LinkedIn personal profile metrics](https://help.metricool.com/linkedin-personal-profile-metrics-h3usk)

## Not confirmed

- How long LinkedIn's approval actually takes.
- Whether X's lower "owned read" rate applies to teammates' tokens.
- Whether Zernio and Ayrshare return analytics for posts made outside their
  platform.
- Whether X's native CSV export still exists for non-Premium accounts.
