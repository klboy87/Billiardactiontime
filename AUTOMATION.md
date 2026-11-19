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
(Review 2026-11-19. Facebook data Nov 17-18 via Windsor; Windsor lags ~1 day. Page 101659817843047 = Billiard Action Time; 849318714932168 = Billiardaction.)
- Earlier review (Nov 12-16): short credited pool video reels (Efren bank shots) reached 105,000-110,000 people and 2,300+ link clicks each. Nothing we make comes close.
- Nov 17-18: no new viral video. Best posts were Efren Reyes match commentary text (363 reach, 3 comments) and two "Day 3: 7 down, one left... YES or NO?" challenge posts (241-263 reach). Everything else was 4-49.
- Story/challenge hooks with a yes/no ask beat tips, facts and plugs by 20-50x on reach. Use 1 per day on Billiard Action Time.
- Name-driven posts about a real pro (Efren Reyes) get the most text reach and comments. Lead with a famous name plus a result.
- Our hand-drawn graphics posts get 4-11 reach and 0 reactions. Article shares get 5-10 reach, 0 clicks. Keep article shares to one Page (Billiard Action Time) plus Instagram.
- Billiardaction gets 0-1 reach on every post. Stop mirroring posts there; post only video clips and the single best item per day.
- Mosconi countdown posts did badly this week (4-10 reach). Do not post daily countdowns; save Mosconi posts for results/highlights Nov 27-30.
- Posting 10+ times/day on Billiard Action Time on Nov 18 diluted reach. 4-6 quality posts/day is enough; skip tips and fun facts entirely.
- Still the top priority: credited video clips (CC-licensed or properly credited) with a one-line amazement hook plus a question, link in first comment.
- Best times seen: 01:00-03:00 UTC (US evening) for challenge/video posts; 17:00-18:00 UTC for text. Weak: 04:00-12:00 UTC.
- Mosconi Cup Nov 27-30: post daily result recaps and update content/mosconi-2026.json each day; link /mosconi-cup-2026.
- Aim for 2 blog articles/day (only 3 published Nov 18-19 so far). Favour evergreen beginner guides; confirm the live URL returns 200 before sharing.
- Railway watch patterns skip some pushes (including code commits). After pushing an article, poll the live URL and redeploy via the Railway connector if not 200 in ~3 minutes. Log-only commits being SKIPPED is normal.
- Always confirm image URLs return 200 on the live site before posting to Facebook/Instagram.
