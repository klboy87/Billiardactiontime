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
(Review 2026-11-23. Facebook data Nov 16-22 via Windsor, 69 posts; earlier Nov 14-20 review agrees; Windsor lags ~1 day. Page 101659817843047 = Billiard Action Time; 849318714932168 = Billiardaction.)
- Only video/reel-style posts about Efren Reyes break out: three posts reached 299,000-329,000 people (52-88 comments) and one 112,000 (24 comments). Their captions were 1 short line, no hashtags, no link ("Efren Reyes is just a goat for this amazing shot"). Nothing else comes close.
- Credited video clips (The Sharkstream, CC BY) with a famous pro name plus "luck or genius?" / "would you fire this?" reached 500-1,400 each, 20-100x any other post type. Make 1-2 per day on Billiard Action Time; link goes in the first comment.
- Famous names carry reach: Efren Reyes, Joshua Filler, Jayson Shaw, Earl Strickland. Lead with the name plus a surprising result.
- "Day N: 7 down, one left... YES or NO?" challenge posts reached 400-420 (video). Repeat in series form, one per day at most.
- Long Mosconi Team USA / Europe roster text posts reached 45-118 (best of the non-video text). Short Mosconi "who wins?" polls and countdowns reached 4-11. Do not post countdowns.
- Article shares reach 8-16 people and almost never get a click. Share each article once, on Billiard Action Time + Instagram only. Articles still matter for search, not for Facebook.
- Fun facts, tips, tournament-finder plugs, weekend YES/NO and hand-drawn graphics: 5-22 reach, 0 reactions. Stop posting tips and fun facts.
- Billiardaction gets 0-2 reach per post. Do not post there except credited video clips.
- Nov 16-22 top posts: Efren one-liners 336K and 302K reach (Nov 16, Nov 20, both ~01:00-03:00 UTC); "Where's Efren Reyes going this time?" 7.4K (short, curiosity gap). Credited Sharkstream clips with a named pro: 400-1,450 reach each; Jayson Shaw/Earl Strickland 1,450 best, Filler carom 1,279. Clips of Efren/Shaw/Filler beat Gorst/SVB tricks (570-760).
- Short captions (under ~12 words, no hashtags, no link) on Efren reposts drove 100x the reach of long captions. Test short curiosity-gap captions on credited clips too.
- Article shares and Mosconi/fun-fact text posts stay at 8-20 reach, 0 clicks. Mosconi long roster posts reached 49-130 only. Keep to one article share per article.
- Stop posting to Billiardaction: 0-1 reach on every post this week (22 posts).
- Reactions are 0 almost everywhere; comments only on Efren/Shaw/Filler video. Use comment-bait questions only on video.
- (older) Reactions are ~0 on everything; comments only appear on video/Efren content. Optimise for video-style posts and comments, not link clicks.
- Best times seen: 00:00-03:00 UTC (US evening) for video; 17:00-18:00 UTC for text. Weak: 04:00-12:00 UTC.
- Post 3-5 times a day total (1-2 video clips + 1 Mosconi item + article share), not 10+.
- Mosconi Cup Nov 27-30: post daily result recaps and update content/mosconi-2026.json each day; link /mosconi-cup-2026. Highlights video of the matches is the best chance for another 100K+ post.
- Blog pace is 2 articles/day (Nov 20-21: 3 published). Favour evergreen beginner guides; confirm the live URL returns 200 before sharing.
- Railway watch patterns SKIP almost every push (articles, code, logs). After pushing, poll the live URL and redeploy via the Railway connector (project spectacular-vitality) if not 200 in ~3 minutes. Owner needs to clear the watch patterns.
- Always confirm image URLs return 200 on the live site before posting to Facebook/Instagram.
