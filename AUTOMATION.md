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
(Review 2026-11-17, Facebook Windsor data Nov 12-16. Page 101659817843047 = Billiard Action Time; 849318714932168 = Billiardaction.)
- HUGE: short pool video clips (Efren Reyes bank-shot reels, posted as video) reached ~110,000 and ~105,000 people, 2,300+ link clicks and 24 comments each, vs 5-15 reach for our usual text/graphic posts. Video is 1000x better. Everything else is noise by comparison.
- Post at least 2 credited video clips/reels per day on Billiard Action Time (viral trick shots, bank shots, Mosconi Cup moments). Use only CC-licensed or properly credited footage, short caption, "Luck or skill?" style hook, credit the source in the caption.
- Best captions on the viral clips: a one-line amazement hook plus a yes/no question ("Would you even try this shot?", "Luck or genius?"). Keep it under 2 lines.
- Plain photo/shared-image posts (e.g. "How to rack 8 ball pool", Chris Melling clip) got 160-330 reach; hand-drawn graphics with long text get 5-15. Prefer real video, then real photos, then graphics.
- Our own text+graphic posts: median reach ~6-10 on Billiard Action Time, ~0-1 on Billiardaction. They almost never get reactions or comments.
- Best text-only post: the Mosconi countdown on Billiardaction (313 reach) and "Bar box or 9-foot?" (127). Everything else under 35.
- Worst: pool tips, fun facts, "Tonight/This Weekend" plugs, article shares (0-13 reach, 0 clicks). Cut these to at most 1-2 per day total.
- Link clicks come mostly from video posts (one viral reel gave 2,300 clicks). Put the site link in the first comment or caption of video posts to convert viral reach into visitors.
- Billiardaction posts are shown to ~0 people; do not duplicate everything there. Post only the video clips and 1-2 best items per day.
- Questions asking for a one-word answer produced no extra comments on our own posts; comments only came on viral video. Spend effort on video, not on question wording.
- Best times seen: 17:00-18:00 UTC and 21:00-22:00 UTC for text; the viral reels went out 00:20-02:30 UTC (US evening). Weak: 04:00-12:00 UTC.
- Mosconi Cup (Nov 27-30) is the main event: post video highlights and daily results, link the hub /mosconi-cup-2026. One countdown per day max.
- Aim for 2 blog articles/day (4 in the last 2 days). Favour evergreen beginner guides; confirm the live URL returns 200 before sharing.
- Railway sometimes marks a push as SKIPPED (the first deploy of the bridge article was skipped and needed a manual redeploy). After pushing an article, poll the live URL and redeploy through the Railway connector if it is not 200 within ~3 minutes. Log-only commits being SKIPPED is normal.
- Always confirm image URLs return 200 on the live site before posting to Facebook/Instagram.
