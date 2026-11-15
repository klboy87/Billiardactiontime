# AUTOMATION.md — guide for automated agents

Site: https://billiardactiontime.com (repo `klboy87/billiardactiontime`). Node (>=22.13), no framework, no build step.

## Deploy
- Deploy branch: **`main`**. Railway (Nixpacks, `railway.json`) auto-deploys every push to `main`. Start: `node server.js`, healthcheck `/api/health`.
- Workflow: `git pull --rebase origin main`, commit, `git push origin main`.
- The live service is Railway project **spectacular-vitality** (it has the billiardactiontime.com domain, env vars and the `/app/data` volume). The project **earnest-adaptation** is a duplicate with no domain, vars or data; ignore it. If pushes stop deploying, the service's GitHub source link is probably stale: reconnect the service's source to `klboy87/Billiardactiontime` branch `main`.
- Confirm a deploy is live: poll the live URL of what you added (e.g. `curl -s -o /dev/null -w '%{http_code}' https://billiardactiontime.com/blog/<slug>`) every ~30s until it returns 200, up to ~10 minutes.
- Never commit secrets (`.env`, tokens, `data/*.db`). Do not change admin credentials/auth (`ADMIN_TOKEN` env var on Railway).

## Add a blog article (one file)
- Create `content/blog/<slug>.json`. The file is picked up automatically at server start (i.e. on deploy). No index or sitemap step: `/blog/`, the article page and `sitemap.xml` are generated from the folder.
- Format:
```json
{
  "slug": "lowercase-hyphen-slug",
  "title": "Article title",
  "date": "YYYY-MM-DD",
  "description": "1-2 sentence meta description (also the Facebook preview text)",
  "body": "<p>HTML body. Use <h2> for sections, <p>, <ul>, <a href>.</p>",
  "sources": [{"title": "Source name", "url": "https://..."}],
  "image": "https://... (optional; used as the Open Graph/Facebook image)"
}
```
- Required: `slug` (a-z, 0-9, hyphens, 2-80 chars, unique), `title`, `date`, `description`, `body`. `sources` and `image` are optional (`sources` may also be plain URL strings). Invalid files are skipped with a warning in the server log, so verify the live URL.
- Live URL: `https://billiardactiontime.com/blog/<slug>`; index: `https://billiardactiontime.com/blog/` (newest first). Ads are AdSense auto ads added by the shared page layout; nothing to do per article.
- Separate from this, `content/articles/*.json` are the daily *guide* articles shown under `/guides/` (fields `slug,title,desc,date,cat,body,faq`).

## Mosconi Cup 2026 hub
- `/mosconi-cup-2026` is built by `src/mosconi.js`. Fill in daily results (Nov 27-30) in `content/mosconi-2026.json`: `{"days":[{"date":"2026-11-27","score":"USA 3 - 2 Europe","summary":"Plain-text recap"}]}`, then push. The nav/home links switch off on Dec 1 by themselves.

## Activity log
- File: `automation/activity-log.jsonl` — one JSON object per line, append only:
```json
{"time":"2026-11-12T18:00:00Z","routine":"daily-article","type":"article","summary":"Plain English, 1-2 sentences.","links":["https://billiardactiontime.com/blog/slug"],"status":"ok"}
```
- `time`: ISO 8601 UTC. `type`: one of `article, social_post, research, review, fix, error, suggestion, setup`. `status`: `ok` or `failed`. `links`: array of URLs (may be empty).
- Append with e.g. `echo '{...}' >> automation/activity-log.jsonl` (single line, valid JSON, ends with newline), then commit and push. Malformed lines are ignored by the viewer. The file is read at request time, so a deploy of the new line is all that is needed.
- Admin viewer: https://billiardactiontime.com/#/admin/activity (log in with the existing admin token at `/#/admin`). Data API `GET /api/admin/activity` returns 401 without a valid admin bearer token (403 if `ADMIN_TOKEN` is unset). It is not in the nav or sitemap and is noindex.

## Build / test
- No build step. Run locally: `npm start` (needs Node 22.13+; set `ADMIN_TOKEN`, `PORT` env vars; see `src/config.js`).
- `npm test` runs `node --test "test/*.test.js"` (tests in `test/`).
- Quick check: `node --check src/blog.js src/activity.js src/app.js`.

## Learnings
(Review 2026-11-15, from Facebook Windsor data, Nov 12-14. Reach is tiny overall: median ~5 people per post on Billiard Action Time, ~1 on Billiardaction.)
- Best reach by far: non-link media/shared posts ("How to rack 8 ball pool" 251 reach, a Chris Melling clip 71). Photos/video beat text-only posts about 10x; add an image to every post when possible.
- Best text post: the "15 DAYS TO THE MOSCONI CUP" countdown (313 reach on Billiardaction, 4 clicks, the only post with a click-through there) and the "Bar box or 9-foot?" debate (123 reach, 2 clicks).
- Debate/versus questions ("Bar box or 9-foot?", "Soft or POWER break?") out-reach tips and fun facts (3-9 reach). Use "A or B" hooks.
- Link clicks so far came from: tournament-finder CTAs, the 8/9/10-ball poll, soft-vs-power break and the countdown. Put one clear link in each post.
- Worst: pool tips, fun facts, "Tonight/This Weekend" plugs and blog-article promos (0-9 reach, 0 comments). Cut tips and fun facts to at most 1/day.
- Billiardaction page (849318714932168) gets ~0-1 reach on nearly everything. Do not duplicate text there; post unique content or lower its frequency to 2-3/day.
- Zero comments and almost zero reactions on all posts: questions at the end are not enough. Ask for a one-word answer ("USA or EUROPE?") and reply to every comment.
- Posting ~7 posts/day per Page is below the 9 target but more volume is not the problem; quality and media are. Prefer fewer, better posts with images.
- Best times seen: 17:00-18:00 UTC and 21:00-22:00 UTC; weak: 00:00-04:00 UTC overnight posts.
- Mosconi Cup content works best as countdown/pick-a-side; run it daily until Nov 30, with the hub page /mosconi-cup as the link. Do not post the same Mosconi stat three times a day.
- Aim for 2 blog articles/day (6 exist over 3 days). Favour evergreen guides; check the live URL returns 200 before posting.
- Always confirm the image URL returns 200 on the live site before posting to Facebook/Instagram.
- Owner can post real tournament photos or clips; this is the biggest reach lever (see suggestions).
