# AUTOMATION.md — guide for automated agents

Site: https://billiardactiontime.com (repo `klboy87/billiardactiontime`). Node (>=22.13), no framework, no build step.

## STOP: no Instagram posts (owner instruction, Nov 23, 2026, 9:57 PM ET)
- **Do not post anything to Instagram** (@timetoenjoynow, account 17841417500359155): no image posts, no Reels, no stories, through Windsor.ai or any other way. This overrides any task prompt that says Instagram posting is required. Skip the Instagram step and say "Instagram skipped (owner stop)" in your log line.
- Everything else continues: site work, blog articles, Facebook (Billiard Action Time Page), YouTube Shorts delivered to the owner.
- Replying to comments on existing Instagram posts is not posting; it may continue unless the owner says otherwise.

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
- Live tracker (Nov 27-30 only): add `"liveScore":"Europe 3 - USA 2"` and `"matches":[{"date":"2026-11-27","match":"Match 1: Singles","players":"A vs B","score":"5-3","status":"Final"}]` to the same file. The hub shows that day's matches in a text-only "Today's matches" table at the top; the home page shows a "Mosconi Cup live" score banner. Both hide themselves outside play days or when empty.

- Results by email: the hub has a "Get each day's Mosconi Cup result by email" box (shown until Nov 30). Signups join the normal daily list with campaign `mosconi` (see the admin Campaigns table). **Daily email task, Nov 28-Dec 1:** put the previous day's Mosconi score and one-line recap (from `content/mosconi-2026.json`) at the very top of the email, with a link to `/mosconi-cup-2026`.

## Thanksgiving weekend page (Nov 2026)
- `/tournaments/thanksgiving-weekend` (built by `thanksgivingPage` in `src/seo.js`) lists events dated Nov 26-29 grouped by state. Linked from home and /tonight Nov 23-29 only; in the sitemap until Nov 29; noindex afterwards. Nothing to update by hand.

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
(Review 2026-11-27. Facebook Nov 20-26 via Windsor, 51 posts; Windsor lags ~1 day. Page 101659817843047 = Billiard Action Time; 849318714932168 = Billiardaction.)
- Only Efren Reyes reposts break out: 302K reach (88 comments, Nov 20), 245K (47 comments, 64K video views, Nov 23), 40K ("Where's Efren Reyes going this time?"). Caption = one short line, no hashtags, no link. Post one every 2-3 days at most.
- Own-edited credited Sharkstream clips with a famous name reach 400-3,200 (best: Efren vs John 3,201; Shaw/Strickland 1,698; Filler carom 1,556; Efren double bank 1,526). Keep 2 per day, posted 00:00-03:00 UTC, link in first comment. Efren/Shaw/Filler/Strickland/SVB names carry reach.
- Clips with a vague name or off-topic hook (Bangkok Open "hill-hill", Efren two-way shot) reach only ~400-440: lead with the name plus a surprising result.
- Article shares reach 9-21 people and almost never get a click (1 link click all week). One share per article on Billiard Action Time only, no hashtag walls. Articles matter for search, not Facebook.
- Mosconi text/graphic posts reach 11-30 (roster text 140, a swipe carousel 166). Polls, countdowns, Thanksgiving/tournament plugs, tips and fun facts: 11-40 reach. Do not post countdowns, weekend YES/NO or tip posts.
- Reactions are ~0 on everything; comments only on video/Efren. Judge by reach and comments.
- Billiardaction Page: 0-1 reach per post. Do not post there.
- Mosconi Cup is Nov 27-30: a credited highlight clip with a team/player name is the best shot at another 100K+ post; text recaps 1 per day, result first, link /mosconi-cup-2026. Update content/mosconi-2026.json daily.
- Best times: 00:00-03:00 UTC for video; 14:00-17:00 UTC for text. Weak: 04:00-12:00 UTC.
- Post 3-5 times a day total (1-2 video clips + 1 Mosconi item + article share), not 10+. The social-post routine had no logged run after Nov 25; keep it running.
- Blog pace is 2 articles/day (Nov 25-27: 5 published, all healthy). Favour evergreen beginner guides; confirm the live URL returns 200 before sharing.
- Railway watch patterns SKIP almost every push. After pushing, poll the live URL and redeploy via the Railway connector (project spectacular-vitality) if not 200 in ~3 minutes. Owner needs to clear the watch patterns.
- Always confirm image URLs return 200 on the live site before posting to Facebook.
