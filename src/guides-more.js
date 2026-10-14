// More guide articles (glossary, practice drills, chip tournaments, banks, cues, breaking). Plain data,
// merged into GUIDES in guides.js. Table diagrams are drawn here as inline SVG so they need no images.

// A pool table seen from above, 8 diamonds long and 4 wide. Positions are in diamonds from the
// top-left corner pocket: x 0–8 (long side), y 0–4. Balls: {x, y, n} (n = number, 0 = cue ball,
// 'g' = ghost ball). Paths: [[x1,y1],[x2,y2],...] drawn as dashed arrows.
const U = 50, R = 22;                                          // pixels per diamond, rail width
const px = v => R + v * U;
const BALL = { 0: '#fff', 1: '#f2c400', 2: '#1f4fd1', 3: '#d63a40', 4: '#6b2fb3', 5: '#f07800', 6: '#13804a', 7: '#7a2a1a', 8: '#111', 9: '#f2c400', 10: '#1f4fd1' };
function table({ balls = [], paths = [], labels = [] } = {}, caption = '') {
  const W = 8 * U + 2 * R, H = 4 * U + 2 * R;
  const pockets = [[0, 0], [4, 0], [8, 0], [0, 4], [4, 4], [8, 4]].map(([x, y]) => `<circle cx="${px(x)}" cy="${px(y)}" r="11" fill="#111"/>`).join('');
  const diamonds = [];
  for (let i = 1; i < 8; i++) if (i !== 4) { diamonds.push([px(i), R / 2], [px(i), H - R / 2]); }
  for (let j = 1; j < 4; j++) diamonds.push([R / 2, px(j)], [W - R / 2, px(j)]);
  const dia = diamonds.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#f4e7c4"/>`).join('');
  const lines = paths.map(pts => `<polyline points="${pts.map(([x, y]) => `${px(x)},${px(y)}`).join(' ')}" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#arr)" opacity=".9"/>`).join('');
  const b = balls.map(({ x, y, n }) => {
    if (n === 'g') return `<circle cx="${px(x)}" cy="${px(y)}" r="7.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="3 2"/>`;
    const stripe = typeof n === 'number' && n >= 9 && n <= 15;
    const fill = BALL[n] ?? '#ddd';
    return `<g><circle cx="${px(x)}" cy="${px(y)}" r="7.5" fill="${stripe ? '#fff' : fill}" stroke="#222" stroke-width=".8"/>${stripe ? `<rect x="${px(x) - 7.5}" y="${px(y) - 3.5}" width="15" height="7" fill="${fill}"/>` : ''}${n ? `<text x="${px(x)}" y="${px(y) + 3}" font-size="8" text-anchor="middle" font-family="Arial" font-weight="bold" fill="${n === 8 || n === 2 || n === 4 || n === 6 || n === 7 ? '#fff' : '#111'}">${n}</text>` : ''}</g>`;
  }).join('');
  const lab = labels.map(([x, y, t]) => `<text x="${px(x)}" y="${px(y)}" font-size="11" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${t}</text>`).join('');
  return `<figure class="diagram"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${caption.replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#fff"/></marker></defs>
<rect x="0" y="0" width="${W}" height="${H}" rx="14" fill="#5a3518"/><rect x="${R}" y="${R}" width="${8 * U}" height="${4 * U}" fill="#1f7a4a"/>
<line x1="${px(2)}" y1="${R}" x2="${px(2)}" y2="${H - R}" stroke="#fff" stroke-opacity=".25"/><circle cx="${px(6)}" cy="${px(2)}" r="2" fill="#fff" fill-opacity=".6"/>
${pockets}${dia}${lines}${b}${lab}</svg>${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
}


// ---------- Fargo chart (same math as the race calculator in public/tools.js) ----------
const gameP = d => 1 / (1 + Math.pow(2, -d / 100));
const matchP = (p, a, b) => { let total = 0, c = 1; for (let k = 0; k < b; k++) { if (k > 0) c = c * (a - 1 + k) / k; total += c * p ** a * (1 - p) ** k; } return total; };
const pct = x => x >= 0.995 ? '>99%' : Math.round(x * 100) + '%';
const fairRace = (d, base) => { let best = base, gap = 2; for (let r = base; r <= base + 40; r++) { const g = Math.abs(matchP(gameP(d), r, base) - 0.5); if (g < gap) { gap = g; best = r; } } return best; };
const fargoRows = () => [0, 25, 50, 75, 100, 125, 150, 200, 250, 300].map(d => `<tr><td><b>${d}</b></td><td>${pct(gameP(d))}</td><td>${pct(matchP(gameP(d), 5, 5))}</td><td>${pct(matchP(gameP(d), 7, 7))}</td><td>${pct(matchP(gameP(d), 9, 9))}</td></tr>`).join('');
const raceRows = () => [25, 50, 75, 100, 125, 150, 200].map(d => `<tr><td><b>${d}</b></td><td>${fairRace(d, 3)} to 3</td><td>${fairRace(d, 4)} to 4</td><td>${fairRace(d, 5)} to 5</td></tr>`).join('');

// ---------- glossary ----------
const TERMS = [
  ['Action', 'Betting on pool, or the money being played for. "Looking for action" means looking for a money game.'],
  ['Angle', 'The cut angle of a shot. Also used for having a good angle on the next ball to get position.'],
  ['APA, BCA, VNEA', 'The best-known amateur pool leagues and rule-making groups in North America. Each has its own rules and handicaps.'],
  ['Bank shot', 'A shot where the object ball hits one or more cushions before it goes in the pocket.'],
  ['Bar box', 'A 7-foot table, usually coin-operated, as found in most bars.'],
  ['Break', 'The opening shot of a rack, where the cue ball is driven into the racked balls.'],
  ['Break and run', 'Breaking and then running every ball to win without the opponent shooting.'],
  ['Bridge', 'The hand that supports the front of the cue. Also the mechanical "rake" used for long reaches.'],
  ['Bye', 'A free pass to the next round of a bracket when there are not enough players to fill it.'],
  ['Calcutta', 'An auction before a tournament where people bid on players, and the pot is paid to whoever "owns" the winners. See our <a href="/guides/calcutta-auction-explained">Calcutta guide</a>.'],
  ['Call shot', 'A rule that you must name the ball and pocket before shooting. Obvious shots usually do not need to be said out loud.'],
  ['Carom', 'When the cue ball or an object ball glances off one ball into another. A "carom shot" uses a ball to redirect another into a pocket.'],
  ['Chalk', 'The cube rubbed on the cue tip so it grips the cue ball and does not miscue.'],
  ['Cheat the pocket', 'Aiming at one side of the pocket instead of the center to change the cue ball path.'],
  ['Chip tournament', 'A format where each player starts with chips, loses one with each loss, and is out when the chips are gone. See our <a href="/guides/chip-tournaments">chip tournament guide</a>.'],
  ['Cling', 'Extra friction between two balls (often from bad chalk marks) that makes the object ball go thicker than expected. Also called "skid."'],
  ['Cluster', 'Two or more balls touching or close together, which usually need to be broken apart.'],
  ['Combination', 'A shot where the cue ball hits one object ball into another, which then goes in.'],
  ['Cut shot', 'A shot where the object ball is hit at an angle, off center.'],
  ['Dead ball', 'A shot or combination that cannot miss if hit correctly.'],
  ['Deflection (squirt)', 'The cue ball pushing off the aiming line when you hit it with side spin. Low-deflection shafts reduce it.'],
  ['Diamond', 'The markers on the rails, used for aiming kicks and banks and for describing positions.'],
  ['Double elimination', 'A bracket where a player is out only after two losses. See our <a href="/guides/double-elimination-brackets">bracket guide</a>.'],
  ['Double hit', 'A foul where the cue tip touches the cue ball twice on one stroke, common when the cue ball is very close to an object ball.'],
  ['Draw', 'Backspin. Hitting the cue ball below center so it comes back after contact.'],
  ['Dry break', 'A break that does not make a ball.'],
  ['English', 'Side spin, from hitting the cue ball left or right of center.'],
  ['FargoRate', 'A rating system for pool players. A 100-point gap means the stronger player wins about two games for every one. See our <a href="/guides/fargo-ratings-handicaps">Fargo guide</a>.'],
  ['Follow', 'Topspin. Hitting the cue ball above center so it rolls forward after contact.'],
  ['Foot spot', 'The spot where the front ball of the rack sits, two diamonds from the foot rail.'],
  ['Foul', 'A rule break such as scratching, hitting the wrong ball first, or no rail after contact. It usually gives the opponent ball in hand.'],
  ['Frozen', 'A ball touching another ball or a cushion.'],
  ['Ghost ball', 'The imaginary ball where the cue ball needs to be at contact to pocket the object ball. Also a practice game: "playing the ghost."'],
  ['Greens fee', 'Money from each entry kept by the room for table time, separate from the prize fund.'],
  ['Hanger', 'A ball sitting in the jaws of a pocket, easy to make.'],
  ['Head string', 'The imaginary line two diamonds from the head rail. The cue ball is placed behind it for the break.'],
  ['Hill', 'Needing one more game to win the match. "Hill-hill" means both players need one game.'],
  ['House cue', 'A cue that belongs to the room, usually on the wall rack.'],
  ['Jump shot', 'Hitting down on the cue ball so it hops over a blocking ball. Usually done with a short jump cue.'],
  ['Kick shot', 'A shot where the cue ball hits a cushion before the object ball.'],
  ['Kiss', 'When a ball touches another ball on its way, often changing its path.'],
  ['Lag', 'Both players shoot a ball up and back the length of the table; the one closest to the head rail chooses who breaks.'],
  ['Masse', 'A shot with an elevated cue and heavy spin that curves the cue ball around a blocker.'],
  ['Miscue', 'When the tip slips off the cue ball, often from too little chalk or hitting too far from center.'],
  ['Nine-ball', 'A rotation game where the lowest-numbered ball must be hit first and the 9 wins. See our <a href="/guides/9-ball-rules">9-Ball rules</a>.'],
  ['Nit', 'A player who will only play when they are sure to have the advantage.'],
  ['Object ball', 'Any ball other than the cue ball.'],
  ['One Pocket', 'A game where each player has one pocket and needs eight balls. See our <a href="/guides/one-pocket">One Pocket guide</a>.'],
  ['Open table', 'In 8-Ball, the time after the break before groups are chosen.'],
  ['Position', 'Where the cue ball ends up for the next shot. "Playing position" means controlling it.'],
  ['Push out', 'In 9-Ball and 10-Ball, a special shot right after the break where the shooter can move the cue ball without hitting the lowest ball. The opponent picks who shoots next.'],
  ['Race', 'The number of games needed to win a match, as in "race to 5." Handicaps change the race for each player.'],
  ['Rack', 'The triangle or template used to set up the balls, and the set of balls in one game.'],
  ['Rail', 'The cushion around the edge of the table. "Rail first" means hitting the cushion before a ball.'],
  ['Rail bird', 'A spectator, especially one who watches money games.'],
  ['Rotation', 'Any game where balls must be hit in number order, such as 9-Ball and 10-Ball.'],
  ['Run out', 'Making all the remaining balls in one turn to win the game.'],
  ['Safety', 'A defensive shot meant to leave the opponent with no good shot.'],
  ['Scotch doubles', 'A team game where two partners take turns shooting. See our <a href="/guides/scotch-doubles">Scotch Doubles guide</a>.'],
  ['Scratch', 'When the cue ball goes in a pocket or off the table. It is a foul.'],
  ['Shark', 'Distracting an opponent on purpose, or a strong player who hides their skill.'],
  ['Slop', 'Balls that go in by accident. Some games count them, others do not.'],
  ['Snooker (snookered)', 'Being left with no direct path from the cue ball to the ball you must hit.'],
  ['Speed', 'How hard a player hits the ball, and also slang for how good a player really is ("I don\'t know his speed").'],
  ['Spot', 'A handicap. In money games, a stronger player "gives a spot," such as the 8-ball or extra games.'],
  ['Stake', 'Money put up to back a player in a match or tournament in return for a share of winnings.'],
  ['Stop shot', 'Hitting the cue ball so it stops dead where it hits a straight-in object ball.'],
  ['Stroke', 'The motion of the cue. "A good stroke" means a smooth, straight delivery.'],
  ['Ten-ball', 'A call-shot rotation game with 10 balls. See our <a href="/guides/10-ball-rules">10-Ball rules</a>.'],
  ['Three-foul rule', 'In many games, three fouls in a row by the same player lose the game.'],
  ['Throw', 'The object ball being pushed slightly off line by friction at contact, especially on cut shots and with side spin.'],
  ['Tip', 'The leather piece on the end of the cue that hits the cue ball.'],
  ['True double', 'A double-elimination final where the losers-side player must win twice. See our <a href="/guides/double-elimination-brackets">bracket guide</a>.'],
  ['Wing ball', 'The balls at the side corners of the rack. In 9-Ball, a wing ball often goes in on a good break.'],
];
const glossaryBody = () => {
  const letters = [...new Set(TERMS.map(([t]) => t[0].toUpperCase()))];
  const groups = letters.map(L => `<h3 id="letter-${L.toLowerCase()}">${L}</h3><dl>${TERMS.filter(([t]) => t[0].toUpperCase() === L).map(([t, d]) => `<dt id="${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')}">${t}</dt><dd>${d}</dd>`).join('')}</dl>`).join('');
  return `
<p>Pool has its own language, and you will hear most of it at your first tournament. Here are ${TERMS.length} common pool and billiards terms, in plain English.</p>
<p class="glossary-az">${letters.map(L => `<a href="#letter-${L.toLowerCase()}">${L}</a>`).join('')}</p>
${groups}
<p style="margin-top:20px">Know the words, now learn the games: <a href="/guides/8-ball-rules">8-Ball</a>, <a href="/guides/9-ball-rules">9-Ball</a> and <a href="/guides/10-ball-rules">10-Ball</a> rules, or read <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`;
};

export const MORE_GUIDES = [
  {
    slug: 'fargo-rating-chart', title: 'Fargo Rating Chart: Win Odds by Rating Difference',
    desc: 'How often does a higher-rated player win? A chart of game and match win chances by Fargo rating difference, plus fair handicap races and what ratings mean.',
    body: `
<p>FargoRate is built on one simple rule: <b>a 100-point rating gap means the stronger player wins about two games for every one</b> the weaker player wins. From that rule you can work out how often the better player wins a game, a race to 5 or a race to 9. Here are the numbers.</p>
<h2>Win chances by rating difference</h2>
<p>"Gap" is the higher rating minus the lower rating. Percentages are the stronger player's chance to win, in even races with no handicap.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Gap</th><th>One game</th><th>Race to 5</th><th>Race to 7</th><th>Race to 9</th></tr></thead><tbody>${fargoRows()}</tbody></table></div>
<p>Notice how fast the odds grow in longer races. A 100-point favorite wins two out of three single games, but most of the time over a race to 9. That is why short races are kinder to underdogs, and why handicapped events give the weaker player fewer games to win.</p>
<h2>Fair handicap races</h2>
<p>To make a match roughly even, the stronger player has to win more games. These are the races that come closest to 50/50 for each rating gap, given how many games the lower-rated player needs.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Gap</th><th>Lower player to 3</th><th>Lower player to 4</th><th>Lower player to 5</th></tr></thead><tbody>${raceRows()}</tbody></table></div>
<p>Read "6 to 3" as: the stronger player races to 6, the weaker player races to 3. For any two exact ratings, use the <a href="/tools/fargo-race-calculator">Fargo race calculator</a>.</p>
<h2>What do Fargo ratings mean?</h2>
<p>These are rough descriptions that many players use. A rating only measures results, so treat them as a guide, not a label.</p>
<ul>
<li><b>Below 400:</b> newer players still learning to make balls and avoid scratches.</li>
<li><b>400 to 500:</b> typical league players who can run a few balls and play some safeties.</li>
<li><b>500 to 600:</b> strong league players who can run out an open 8-ball rack.</li>
<li><b>600 to 700:</b> top local players, regular winners at weekly tournaments.</li>
<li><b>700 to 750:</b> regional stars who contend at bigger events.</li>
<li><b>Above 750:</b> touring professionals; the very best in the world are around 800 and up.</li>
</ul>
<h2>Why the chart is only a starting point</h2>
<ul>
<li><b>Ratings move.</b> A rating is based on past games, and newer players' ratings carry less certainty.</li>
<li><b>The game matters.</b> Some players are much stronger at 8-Ball than 9-Ball, or on a bar box than a 9-foot table.</li>
<li><b>Breaks and formats matter.</b> Winner breaks favor the stronger player more than alternate breaks.</li>
</ul>
<p>More on how handicaps work in our <a href="/guides/fargo-ratings-handicaps">Fargo and handicaps guide</a>. FargoRate is a trademark of its owners; this chart is independent and not affiliated with FargoRate.</p>`
  },
  {
    slug: 'major-pool-events-calendar', title: 'Major Pool Events 2026–2027: The Big Tournaments Every Player Should Know',
    desc: 'The biggest pool events of the 2026–27 season: Mosconi Cup, Derby City Classic, league national championships in Las Vegas, Super Billiards Expo, US Open and more, with dates and who can play.',
    body: `
<p>Most of the pool calendar is weekly tournaments at your local room. But a handful of big events each year bring the whole pool world together, and many of them are open to amateurs. Here is the season ahead, in date order.</p>
<p class="tip"><b>Dates last checked October 2026.</b> Organizers sometimes move events, so confirm on the official site before you book travel. Looking for big events closer to home? See <a href="/big-tournaments/">the biggest upcoming tournaments</a> on our listings.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Dates</th><th>Event</th><th>Where</th><th>Who plays</th></tr></thead><tbody>
<tr><td>Nov 27–30, 2026</td><td>Mosconi Cup</td><td>Orlando, FL</td><td>Team USA vs. Team Europe (pros, by invitation)</td></tr>
<tr><td>Jan 22–31, 2027</td><td>Derby City Classic</td><td>Elizabeth, IN</td><td>Open entry: banks, one pocket, 9-ball</td></tr>
<tr><td>Feb 23 – Mar 6, 2027</td><td>USA Pool League (formerly BCA Pool League) National Championships</td><td>Las Vegas, NV</td><td>League players, plus open events</td></tr>
<tr><td>Apr 15–18, 2027</td><td>Super Billiards Expo</td><td>Oaks, PA (near Philadelphia)</td><td>Amateur and pro events, trade show</td></tr>
<tr><td>Apr 25 – May 1, 2027</td><td>APA Poolplayer Championships</td><td>Las Vegas, NV</td><td>APA league members (qualifiers)</td></tr>
<tr><td>Late spring 2027 (TBA)</td><td>VNEA World Pool Championships</td><td>Las Vegas, NV</td><td>VNEA league players, on bar-box tables</td></tr>
<tr><td>Summer 2027 (TBA)</td><td>APA World Pool Championships</td><td>Las Vegas, NV</td><td>APA teams that qualify locally</td></tr>
<tr><td>Late summer 2027 (TBA)</td><td>US Open Pool Championship</td><td>TBA (2026: Frisco, TX)</td><td>Pros and top amateurs</td></tr>
</tbody></table></div>
<h2>Mosconi Cup</h2>
<p>Pool's version of golf's Ryder Cup: a team of American pros against a team of European pros over four days, in a loud, party-like arena. The 2026 Mosconi Cup is set for <b>November 27–30 at the Caribe Royale in Orlando</b>. You can't enter, but it is the most fun event of the year to watch in person or on TV.</p>
<h2>Derby City Classic</h2>
<p>Held every January near Louisville, Kentucky, the Derby City Classic is a ten-day festival of <a href="/guides/bank-pool-rules">bank pool</a>, <a href="/guides/one-pocket">one pocket</a> and <a href="/guides/9-ball-rules">9-ball</a>. Anyone can enter, so amateurs regularly play the biggest names in the game. Just as famous is the action: money games run around the clock. The 2027 event is <b>January 22–31 at Caesars Southern Indiana</b> in Elizabeth, Indiana.</p>
<h2>League national championships in Las Vegas</h2>
<p>Every big league ends its season in Las Vegas, with hundreds of tables in one ballroom. To play, you usually qualify through your local league during the season.</p>
<ul>
<li><b>USA Pool League National Championships</b> (the former BCA Pool League nationals): <b>February 23 – March 6, 2027</b> at the Westgate Las Vegas. Along with league divisions, there are open events.</li>
<li><b>APA Poolplayer Championships</b>: the APA's individual championships, listed for <b>April 25 – May 1, 2027</b> at the Westgate (dates subject to change).</li>
<li><b>VNEA World Pool Championships</b>: VNEA's week-long event, played on bar-box tables. It is usually in late May; 2027 dates are not yet published.</li>
<li><b>APA World Pool Championships</b>: the APA team championships, usually in August; 2027 dates are listed as to be announced.</li>
</ul>
<p>Not in a league yet? League night is the easiest way into tournament pool. Read <a href="/guides/find-pool-tournaments-near-you">how to find tournaments near you</a>.</p>
<h2>Super Billiards Expo</h2>
<p>A huge show near Philadelphia with a trade floor full of cues, cases and tables, plus amateur and pro tournaments running at the same time. It is one of the friendliest big events for amateurs. The 2027 Expo is <b>April 15–18 at the Greater Philadelphia Expo Center</b> in Oaks, Pennsylvania.</p>
<h2>US Open Pool Championship</h2>
<p>The oldest name in American 9-ball. The 2026 US Open was held August 25–30 in Frisco, Texas, with a $500,000 prize fund. The 2027 dates and venue have not been announced yet.</p>
<h2>Regional tours and opens</h2>
<p>Between the big ones, regional tours run stops nearly every weekend, often with added money and a second-chance event for amateurs. Events like the Turning Stone Classic in Verona, New York, which has run twice a year, draw players from across the Northeast. Our <a href="/big-tournaments/">big tournaments page</a> and <a href="/calendar">calendar</a> track added-money events near you, updated every day.</p>
<h2>Going to a big event?</h2>
<ul>
<li><b>Book rooms early.</b> Event hotels sell out, especially in Las Vegas.</li>
<li><b>Read the rules ahead of time.</b> Big events often use a break box, a shot clock or different 8-ball rules than your league.</li>
<li><b>Bring a backup.</b> A spare tip or shaft, chalk and a glove if you use one.</li>
<li><b>Budget for more than entry fees.</b> Practice table time, food and the Calcutta (read our <a href="/guides/calcutta-auction-explained">Calcutta guide</a>) all add up.</li>
</ul>`
  },
  {
    slug: 'pool-terms-glossary', title: `Pool Terms Glossary: ${TERMS.length} Billiards Words Explained`,
    desc: 'A plain-English glossary of pool and billiards terms: from action, bar box and break and run to throw, true double and wing ball.',
    body: glossaryBody()
  },
  {
    slug: 'pool-practice-drills', title: '7 Pool Practice Drills That Actually Make You Better (With Diagrams)',
    desc: 'Seven pool practice drills with table diagrams: stop shots, the line-up drill, the circle drill, position ladders, kicking and playing the ghost.',
    body: `
<p>Hitting balls around without a plan feels like practice, but it rarely makes you better. These seven drills each train one skill, take 10 to 20 minutes, and give you a score you can try to beat next time. Do two or three in a session and keep a note of your scores.</p>
<p class="tip"><b>Tip:</b> Practice on the same size table you play tournaments on. If your weekly event is on a bar box, practice on a bar box.</p>
<h2>1. The stop-shot ladder</h2>
<p>Put an object ball one diamond from a corner pocket and the cue ball straight behind it, one diamond back. Shoot a stop shot: the cue ball should stop dead where it hit the object ball. Each time you make it with a clean stop, move the cue ball back half a diamond. Miss or let the cue ball roll, and you start again.</p>
${table({ balls: [{ x: 7, y: 1, n: 1 }, { x: 6, y: 2, n: 0 }, { x: 5, y: 3, n: 'g' }], paths: [[[6, 2], [7.85, 0.15]]], labels: [[4.6, 3.55, 'move back']] }, 'Stop-shot ladder: start close, then move the cue ball back after each clean stop.')}
<p><b>Score:</b> how far back you get. Good players can stop the ball from three diamonds or more.</p>
<p>Then do the same thing with <b>draw</b> (bring the cue ball back a diamond) and <b>follow</b> (follow the object ball half a diamond). Clean, straight shots build the stroke everything else depends on.</p>
<h2>2. The line-up drill</h2>
<p>Place 15 balls in a straight line down the long string of the table (the middle of the table, from the head spot to the foot spot). Take ball in hand and run them in any order. You may not touch another ball with the cue ball. If you miss or bump a ball, count how many you made and start over.</p>
${table({ balls: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, i) => ({ x: 1.6 + i * 0.52, y: 2, n })) .concat([{ x: 3, y: 3.2, n: 0 }]) }, 'Line-up drill: balls on the middle line of the table. Run them without bumping the others.')}
<p><b>Score:</b> balls in a row. This is a classic drill because it makes you think two or three balls ahead and play gentle position. Beginners can start with 7 balls.</p>
<h2>3. The circle drill</h2>
<p>Set 8 to 10 balls in a circle about one diamond across around the center spot of the table, with the cue ball in the middle. Pocket every ball without the cue ball touching any other ball and without it leaving the circle area more than you need.</p>
${table({ balls: Array.from({ length: 9 }, (_, i) => ({ x: 4 + 0.95 * Math.cos(i * 2 * Math.PI / 9), y: 2 + 0.95 * Math.sin(i * 2 * Math.PI / 9), n: i + 1 })).concat([{ x: 4, y: 2, n: 0 }]) }, 'Circle drill: run the balls without the cue ball touching the others.')}
<p>This drill teaches soft speed and short-range position, which is exactly what you need in crowded 8-Ball racks.</p>
<h2>4. Position ladder: three balls</h2>
<p>Throw three balls on the table at random and take ball in hand. Run the three in order (lowest number first). If you do it, add a fourth ball next time. If you miss, go back to three.</p>
<p><b>Score:</b> the most balls you run in order. This is a mini 9-Ball rack and teaches you to plan the route, not just the next shot.</p>
<h2>5. The kick drill</h2>
<p>Place an object ball near a corner pocket, frozen on the rail. Put the cue ball where you cannot hit the ball directly (behind another ball or across the table). Kick at it off one rail. Count how many out of ten you hit, and how many you make.</p>
${table({ balls: [{ x: 7.4, y: 0.16, n: 9 }, { x: 2, y: 1, n: 0 }, { x: 4.6, y: 0.62, n: 8 }], paths: [[[2, 1], [4.75, 3.97], [7.3, 0.35]]] }, 'Kick drill: one rail into a ball near the corner. Use the diamonds to find your aim point.')}
<p>Kicks decide a lot of tournament matches, and most players never practice them. Use the diamonds: shooting from a diamond to a diamond on the opposite rail gives you a starting point you can adjust.</p>
<h2>6. Long straight-in shots</h2>
<p>Put an object ball one diamond off the foot rail in line with a corner pocket, and the cue ball on the opposite end, so the shot is the full length of the table. Shoot ten. Then try it with a stop and with draw.</p>
<p><b>Score:</b> out of ten. If you make fewer than six, your stroke is going off line. Slow down, keep your head still, and finish the stroke.</p>
<h2>7. Play the ghost</h2>
<p>Rack 9 balls, break, take ball in hand, and try to run the rack. If you miss anywhere, the "ghost" wins that rack. Play a race to 5 against the ghost. When you can beat the ghost often, play it in 8-Ball or with no ball in hand after the break.</p>
<p>Playing the ghost is honest: it shows exactly how often you can run out. Keep your score from week to week.</p>
<h2>A simple practice plan</h2>
<ul>
<li><b>10 minutes:</b> stop-shot ladder (warm-up and stroke).</li>
<li><b>15 minutes:</b> line-up or circle drill (position).</li>
<li><b>10 minutes:</b> kick drill.</li>
<li><b>15 minutes:</b> play the ghost.</li>
</ul>
<p>Then test it where it counts: <a href="/this-weekend/">find a tournament this weekend</a>, or use the <a href="/tools/fargo-race-calculator">Fargo race calculator</a> to set a fair race with a practice partner.</p>`
  },
  {
    slug: 'chip-tournaments', title: 'Chip Tournaments in Pool: How They Work and How to Run One',
    desc: 'How a pool chip tournament works: chips by skill level, single-game matches, the draw, payouts, and tips for running one at your room.',
    body: `
<p>A chip tournament is a fun, fast format that many pool rooms run as a weekly event. Instead of a bracket, every player gets a number of chips, loses a chip each time they lose a game, and is out when their chips are gone. The last player with chips wins.</p>
<h2>How it works</h2>
<ol>
<li><b>Chips by skill.</b> Each player gets chips based on their skill level. A common setup is 2 chips for the strongest players and 3, 4 or 5 for weaker ones. Some rooms use FargoRate or league ratings to decide; others use the director's judgment.</li>
<li><b>The draw.</b> Names are drawn in a random order, often written on a board or called from a list. The first two names play a single game.</li>
<li><b>One game at a time.</b> Matches are usually one game of 8-Ball or 9-Ball. The loser gives up a chip. The winner goes back to the end of the list and plays again when their name comes up.</li>
<li><b>Out of chips, out of the event.</b> When a player has no chips left, they are eliminated.</li>
<li><b>The end.</b> Play goes on until only a few players are left with chips. Those players finish in the money.</li>
</ol>
<h2>Why players like it</h2>
<ul>
<li><b>Everyone has a chance.</b> Extra chips give newer players more lives, so the field feels more even than a scratch bracket.</li>
<li><b>Lots of games.</b> Short, single-game matches mean you play more often and wait less between turns.</li>
<li><b>Easy to follow.</b> A board with names and chip counts shows exactly where everyone stands.</li>
</ul>
<h2>Running a chip tournament</h2>
<ul>
<li><b>Set chip levels before sign-up.</b> Post them so nobody argues later. Keep it simple: three levels are plenty for a weekly event.</li>
<li><b>Use a board.</b> List names in draw order with chip counts. Cross off chips as they are lost.</li>
<li><b>Several tables.</b> Send the next two names to each open table. With 24 players and 3 tables, a chip tournament usually takes two to three hours.</li>
<li><b>Decide the finish.</b> Many rooms stop when two or three players are left and pay those places, or let the last two play a short race for first.</li>
<li><b>Ball-in-hand and break rules.</b> Single-game formats make the break important. Many rooms use winner breaks or alternate breaks; announce it before you start.</li>
</ul>
<h2>Payouts</h2>
<p>Chip tournaments usually pay fewer places than brackets because the field shrinks one player at a time. Paying the last two or three is common. Use our <a href="/tools/payout-calculator">payout calculator</a> and choose the number of places, and read our <a href="/guides/pool-tournament-payouts">payout guide</a> for typical splits.</p>
<h2>Chip tournament or bracket?</h2>
<p>A <a href="/guides/double-elimination-brackets">double-elimination bracket</a> is better when you want longer races and a clear schedule. A chip tournament is better for mixed-skill fields, a lively room and an event that runs without a lot of paperwork. Need a bracket instead? Print a <a href="/tools/brackets/">free double-elimination bracket</a>.</p>
<p>Running one? <a href="/post">Post your chip tournament free</a> so local players can find it.</p>`
  },
  {
    slug: 'bank-pool-rules', title: 'Bank Pool Rules: How 9-Ball Banks and 15-Ball Banks Are Played',
    desc: 'How bank pool works: what counts as a bank, calling shots, kisses and crossovers, fouls, and the race in 9-ball banks and 15-ball banks.',
    body: `
<p>Bank pool is a game where every ball has to be <b>banked</b>: the called ball must hit at least one cushion before it goes in the pocket. It is a favorite of gamblers and old-school players, and it is one of the best ways to learn how balls come off the rails.</p>
<h2>The basics</h2>
<ul>
<li>Any ball can be shot at, in any order.</li>
<li>Each shot must be a bank: the called ball hits one or more cushions, then goes in the called pocket.</li>
<li>Call the ball and the pocket on every shot. Most players also expect you to call the number of rails if it is not obvious.</li>
<li>Make a called bank and you keep shooting. Miss, and it is your opponent's turn.</li>
</ul>
<h2>Kisses and "clean" banks</h2>
<p>In most bank pool, the called ball has to go in <b>cleanly</b>. If it touches another ball on the way to the pocket (a kiss), or if the cue ball touches it again, the shot does not count. Balls that fall by accident do not count either and are usually spotted. Rules on this vary, so agree before you start.</p>
<p>A <b>crossover</b> or "cross-side" bank is when the cue ball crosses the path of the object ball near the cushion. Many players treat it as a legal shot; some rule sets do not. Ask.</p>
<h2>9-Ball Banks and 15-Ball Banks</h2>
<div class="t-wrap"><table class="t"><thead><tr><th>Game</th><th>Balls</th><th>To win a game</th></tr></thead><tbody>
<tr><td>9-Ball Banks (the most common)</td><td>9 balls racked in a diamond</td><td>Bank 5 balls</td></tr>
<tr><td>15-Ball Banks</td><td>15 balls racked in a triangle</td><td>Bank 8 balls</td></tr>
</tbody></table></div>
<p>Because you need more than half the balls, nobody can win until they have more than the opponent can get. A match is a race of games, often short, such as race to 3 or 5.</p>
<h2>Fouls</h2>
<p>Common fouls are scratching, not hitting a ball, or no cushion after contact. In most bank pool, a foul costs a ball: you spot one of the balls you have banked (or owe one if you have none). Many players do not play ball in hand in banks; the incoming player shoots from where the cue ball is, or from behind the head string after a scratch.</p>
<h2>Strategy</h2>
<ul>
<li><b>Defense matters.</b> If you do not have a good bank, play safe and leave your opponent a hard one.</li>
<li><b>Learn the natural angles.</b> A cross-corner bank and a cross-side bank are the shots you will use most.</li>
<li><b>Speed changes the angle.</b> Hit a bank harder and it comes off the cushion shorter; softer and it runs longer.</li>
</ul>
<p>Bank pool and <a href="/guides/one-pocket">One Pocket</a> are often played together at big events. Look for <a href="/tournaments/banks">bank pool tournaments</a> and check the <a href="/big-tournaments/">biggest upcoming events</a>.</p>`
  },
  {
    slug: 'how-to-choose-a-pool-cue', title: 'How to Choose a Pool Cue: Weight, Tip, Shaft and Price',
    desc: 'A practical guide to buying your first or next pool cue: weight, tip size, shaft taper, low-deflection shafts, wraps, break and jump cues, and what to spend.',
    body: `
<p>You don't need an expensive cue to play well, but a straight cue that feels the same every time makes a real difference. Here is what matters, and what doesn't, when you buy one.</p>
<h2>Weight</h2>
<p>Most playing cues weigh <b>18 to 21 ounces</b>, and 19 ounces is the most common. A lighter cue tends to feel quicker and easier to control on soft shots; a heavier cue can feel more solid. If a house cue around 19 ounces feels good to you, start there.</p>
<h2>Length</h2>
<p>A standard cue is <b>58 inches</b>. Taller players or players with long arms sometimes like 59 to 61 inches. Shorter cues (48 to 52 inches) are made for kids and very tight rooms.</p>
<h2>Tip size and hardness</h2>
<p>Tips are usually <b>12 to 13 millimeters</b> across. 13 mm is the most common and forgiving; a smaller tip can feel more precise. Tips come soft, medium and hard: soft tips grip well but wear faster and need more care; hard tips last longer and are less likely to mushroom. Medium is a good first choice. A good tip, kept shaped and chalked, matters more than the brand.</p>
<h2>Shaft</h2>
<ul>
<li><b>Maple shafts</b> are the classic choice and are affordable.</li>
<li><b>Low-deflection shafts</b> push the cue ball off line less when you use side spin, so English is more predictable. Many good players use them, but they cost more.</li>
<li><b>Carbon fiber shafts</b> are a newer low-deflection option. They are stiff, don't warp, and are easy to clean, but they are the most expensive and some players don't like the feel.</li>
<li><b>Taper</b> is how the shaft narrows toward the tip. A "pro taper" stays thin for longer and feels smooth through a bridge.</li>
</ul>
<h2>Wrap</h2>
<p>The grip area can be Irish linen (classic, absorbs sweat), leather (soft and grippy), rubber, or no wrap at all (smooth wood). It is mostly personal taste. If your hands sweat, linen or leather helps.</p>
<h2>Joint</h2>
<p>The joint is where the cue screws together. Different pins (such as 3/8-10, 5/16-14 and radial pins) change the feel slightly and decide which extra shafts fit your butt. It matters mostly if you plan to buy more shafts later.</p>
<h2>Break and jump cues</h2>
<p>Serious players often carry a second cue to break with, so the playing tip doesn't get crushed. Break cues usually have a very hard tip. Jump cues are short and light for jump shots, and many "break-jump" cues do both. Check your tournament's rules on jump cues before you use one.</p>
<h2>How much to spend</h2>
<ul>
<li><b>Under $100:</b> fine to start, if it's straight and the tip is good.</li>
<li><b>$100 to $300:</b> where most players get a solid, good-hitting cue that lasts for years.</li>
<li><b>$300 and up:</b> low-deflection or carbon shafts, custom work and inlays. Better materials, but they won't make you a better player on their own.</li>
</ul>
<h2>Checking a cue</h2>
<ul>
<li><b>Roll it</b> on a flat table: it should roll smoothly without wobbling.</li>
<li><b>Look down the shaft</b> like a rifle while turning it. A warp shows as a wobble.</li>
<li><b>Hit some balls</b> if you can, and see how the tip feels on soft shots and draw shots.</li>
</ul>
<p>Keep your cue in a case, out of hot cars and damp basements, and wipe the shaft after you play. Then put it to use: <a href="/tournaments/">find a pool tournament near you</a>.</p>`
  },
  {
    slug: 'how-to-break-in-pool', title: 'How to Break in Pool: 8-Ball, 9-Ball and 10-Ball Breaks',
    desc: 'How to break better in pool: stance, speed and cue ball control, plus where to place the cue ball and what to hit for 8-Ball, 9-Ball and 10-Ball.',
    body: `
<p>A good break can win games before your opponent picks up a cue. The goal is not just power: it is a solid hit that spreads the balls, makes a ball, and leaves the cue ball near the middle of the table.</p>
<h2>The basics of every break</h2>
<ul>
<li><b>Hit the cue ball in the center, or just below.</b> A center hit sends the most energy into the rack. Hitting slightly low helps the cue ball stop or come back instead of following into a pocket.</li>
<li><b>Solid, square contact beats raw speed.</b> A controlled break at 80% of your power usually spreads the balls better than a wild swing that hits the head ball off center.</li>
<li><b>Stay down and keep the bridge firm.</b> Use a slightly longer bridge, and don't jump up before the cue ball hits the rack.</li>
<li><b>Watch the cue ball.</b> A great break leaves the cue ball near the center of the table. If it flies around, you are hitting it off center or too hard.</li>
</ul>
<h2>8-Ball break</h2>
${table({ balls: [{ x: 6, y: 2, n: 1 }, { x: 6.22, y: 1.87, n: 9 }, { x: 6.22, y: 2.13, n: 2 }, { x: 6.44, y: 1.74, n: 10 }, { x: 6.44, y: 2, n: 8 }, { x: 6.44, y: 2.26, n: 3 }, { x: 1.6, y: 2, n: 0 }], paths: [[[1.6, 2], [5.8, 2]]] }, '8-Ball: break from the middle of the head string and hit the head ball square.')}
<p>Most players break from <b>near the middle</b> of the head string and hit the head ball as full as they can. Some prefer the cue ball a diamond or so off center for a slightly better chance at making a ball in the corner. If the rules in your event say the 8 on the break wins, you will hear players talk about which breaks make it most often; for most players, a solid, square hit is the best plan.</p>
<p>Under most rules, the break must pocket a ball or drive a certain number of balls to the rails. Check the rules in your event and read our <a href="/guides/8-ball-rules">8-Ball rules guide</a>.</p>
<h2>9-Ball break</h2>
${table({ balls: [{ x: 6, y: 2, n: 1 }, { x: 0.6, y: 3.6, n: 0 }], paths: [[[0.6, 3.6], [5.82, 2.05]]] }, '9-Ball: many players break from near the side rail and hit the 1-ball as full as possible.')}
<p>In 9-Ball, many players break from <b>near the side rail</b> (the "cut break"), aiming to hit the 1-ball full. A good 9-Ball break often makes a <b>wing ball</b> in a corner pocket and sends the 1-ball toward a side pocket. A softer, controlled break is common in tournaments, because keeping the cue ball in the middle gives you a shot at the 1.</p>
<p>Some events use a "break box," a rule that balls must pass the head string, or a template rack, all of which change the best break. Read our <a href="/guides/9-ball-rules">9-Ball rules guide</a>.</p>
<h2>10-Ball break</h2>
<p>10-Ball is harder to break and run because the rack is bigger and, in most rules, you must call your shots. Players often break from near the side rail like in 9-Ball, with a firm, controlled hit. Making a ball and having a shot at the 1 matters more than power. See our <a href="/guides/10-ball-rules">10-Ball rules guide</a>.</p>
<h2>Rack quality matters</h2>
<p>A loose rack spreads poorly no matter how well you hit it. Make sure the balls are frozen together. In many tournaments, the opponent racks; if you are allowed to look, check the rack before you break.</p>
<h2>Practice your break</h2>
<p>Break 20 racks and keep track of: balls made, where the cue ball ended up, and whether you had a shot after the break. Change one thing at a time (cue ball position, speed, or where you hit the cue ball) and compare. Add it to the <a href="/guides/pool-practice-drills">practice drills</a> you already do.</p>`
  }
];
