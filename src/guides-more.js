// More guide articles (glossary, practice drills, chip tournaments, banks, cues, breaking). Plain data,
// merged into GUIDES in guides.js. Table diagrams are drawn here as inline SVG so they need no images.

// A pool table seen from above, 8 diamonds long and 4 wide. Positions are in diamonds from the
// top-left corner pocket: x 0–8 (long side), y 0–4. Balls: {x, y, n} (n = number, 0 = cue ball,
// 'g' = ghost ball). Paths: [[x1,y1],[x2,y2],...] drawn as dashed arrows.
const U = 50, R = 22;                                          // pixels per diamond, rail width
const px = v => R + v * U;
const BALL = { 0: '#fff', 1: '#f2c400', 2: '#1f4fd1', 3: '#d63a40', 4: '#6b2fb3', 5: '#f07800', 6: '#13804a', 7: '#7a2a1a', 8: '#111', 9: '#f2c400', 10: '#1f4fd1', 11: '#d63a40', 12: '#6b2fb3', 13: '#f07800', 14: '#13804a', 15: '#7a2a1a' };
export function table({ balls = [], paths = [], labels = [] } = {}, caption = '') {
  const W = 8 * U + 2 * R, H = 4 * U + 2 * R;
  const pockets = [[0, 0], [4, 0], [8, 0], [0, 4], [4, 4], [8, 4]].map(([x, y]) => `<circle cx="${px(x)}" cy="${px(y)}" r="11" fill="#111"/>`).join('');
  const diamonds = [];
  for (let i = 1; i < 8; i++) if (i !== 4) { diamonds.push([px(i), R / 2], [px(i), H - R / 2]); }
  for (let j = 1; j < 4; j++) diamonds.push([R / 2, px(j)], [W - R / 2, px(j)]);
  const dia = diamonds.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#f4e7c4"/>`).join('');
  // A path is [[x,y],...] (white, cue ball) or {pts, color, curve} (curve: smooth quadratic through the middle point).
  const lines = paths.map(p => {
    const pts = Array.isArray(p) ? p : p.pts, color = (!Array.isArray(p) && p.color) || '#fff', mk = color === '#fff' ? 'arr' : 'arrY';
    const d = !Array.isArray(p) && p.curve && pts.length === 3
      ? `M${px(pts[0][0])} ${px(pts[0][1])} Q${px(pts[1][0])} ${px(pts[1][1])} ${px(pts[2][0])} ${px(pts[2][1])}`
      : 'M' + pts.map(([x, y]) => `${px(x)} ${px(y)}`).join(' L');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="5 4" marker-end="url(#${mk})" opacity=".95"/>`;
  }).join('');
  const b = balls.map(({ x, y, n }) => {
    if (n === 'g') return `<circle cx="${px(x)}" cy="${px(y)}" r="7.5" fill="none" stroke="#fff" stroke-width="1.4" stroke-dasharray="3 2"/>`;
    const stripe = typeof n === 'number' && n >= 9 && n <= 15;
    const fill = BALL[n] ?? '#ddd';
    return `<g><circle cx="${px(x)}" cy="${px(y)}" r="7.5" fill="${stripe ? '#fff' : fill}" stroke="#222" stroke-width=".8"/>${stripe ? `<rect x="${px(x) - 7.5}" y="${px(y) - 3.5}" width="15" height="7" fill="${fill}"/>` : ''}${n ? `<text x="${px(x)}" y="${px(y) + 3}" font-size="8" text-anchor="middle" font-family="Arial" font-weight="bold" fill="${[2, 4, 6, 7, 8, 10, 12, 14, 15].includes(n) ? '#fff' : '#111'}">${n}</text>` : ''}</g>`;
  }).join('');
  const lab = labels.map(([x, y, t]) => `<text x="${px(x)}" y="${px(y)}" font-size="11" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${t}</text>`).join('');
  return `<figure class="diagram"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${caption.replace(/"/g, '')}" xmlns="http://www.w3.org/2000/svg">
<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#fff"/></marker><marker id="arrY" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ffd54a"/></marker></defs>
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


// Rack layouts for the racking guide: rows of ball numbers, apex on the foot spot, rows going toward the foot rail.
const rack = (rows) => { const out = []; rows.forEach((row, r) => row.forEach((n, i) => out.push({ x: +(6 + r * 0.26).toFixed(3), y: +(2 + (i - (row.length - 1) / 2) * 0.3).toFixed(3), n }))); return out; };

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

// Pool rules Q&A: each answer is plain text so it can also feed the FAQPage structured data.
const RULES_QA = [
  ['What happens if you scratch on the 8-ball?', 'If you pocket the 8 and the cue ball also goes in, you lose the game under almost every rule set. If you scratch while shooting at the 8 but the 8 does not go in, it is a normal foul under tournament (WPA, BCA, APA) rules: your opponent gets ball in hand. Many bars play that any scratch on the 8 loses, so agree before you play.'],
  ['What happens if you scratch on the break in 8-Ball?', 'It is a foul. Balls pocketed on the break stay down and the table stays open. Under WPA rules the incoming player gets the cue ball in hand behind the head string; many leagues and bars give ball in hand anywhere. Check your league or event rules.'],
  ['What happens if you make the 8-ball on the break?', 'It depends on the rules. In APA it is a win, unless the cue ball also scratches, which is a loss. Under WPA rules the breaker chooses to re-spot the 8 and keep shooting, or to re-rack and break again; it is not a win or a loss. Bar rules vary, so ask first.'],
  ['Do you have to call your shots in 8-Ball?', 'In most tournament and league play, yes: you call the ball and the pocket, except on obvious shots. You never have to call kisses, banks or caroms. The 8-ball must always be called. In casual bar pool, slop often counts, so agree before the game.'],
  ['Can you hit the 8-ball first?', 'Not while you still have balls of your group on the table. Hitting the 8 first is a foul, and on an open table most rules also make it a foul. Once your group is cleared, the 8 becomes your legal ball.'],
  ['What is ball in hand?', 'After a foul, the incoming player may place the cue ball anywhere on the table and shoot. Some rules limit it to behind the head string after certain fouls, like a scratch on the break.'],
  ['What counts as a legal break in 8-Ball?', 'Under WPA and most tournament rules, the breaker must pocket a ball or drive at least four object balls to the rails. If not, it is an illegal break, and the opponent can accept the table, re-rack and break, or have the breaker break again.'],
  ['Does a ball have to hit a rail after contact?', 'Yes. On every shot, after the cue ball hits a legal ball, either a ball must be pocketed or the cue ball or any object ball must touch a rail. If nothing reaches a rail, it is a foul.'],
  ['Is a jump shot legal?', 'In tournament play, yes, if you strike down on the cue ball and make it jump off the cloth. Scooping under the cue ball with the tip is a foul. Many bars ban jump shots and jump cues, so ask first.'],
  ['What is a push out in 9-Ball?', 'On the shot right after the break, the shooter may announce a push out: they can shoot the cue ball anywhere without hitting the lowest ball or a rail. The opponent then chooses to shoot from there or make the pusher shoot again.'],
  ['What is the three-foul rule in 9-Ball?', 'Under WPA rules, a player who fouls on three shots in a row in the same rack loses the game, but only after being warned after the second foul. Many leagues and bars do not use it.'],
  ['What happens if you make the 9-ball on the break?', 'In 9-Ball it is a win as long as the break is legal and you do not scratch. If you scratch, the 9 is spotted and your opponent gets ball in hand. Some events re-spot the 9 instead; 10-Ball always re-spots the 10 on the break.'],
  ['Is it a foul to double hit the cue ball?', 'Yes. Hitting the cue ball twice on one stroke, or pushing it with the tip, is a foul. It most often happens when the cue ball is very close to the object ball.'],
  ['Is it a foul to touch a ball with your hand or clothes?', 'Touching the cue ball is always a foul in tournament play. Touching an object ball depends on the event: some use cue-ball fouls only, and others treat any moved ball as a foul. Ask at the players meeting.'],
  ['Do you need a foot on the floor?', 'Yes. Under tournament rules you must have at least one foot touching the floor when you strike the cue ball. Use the mechanical bridge or a long bridge on hard reaches.']
];

export const MORE_GUIDES = [
  {
    slug: 'how-to-read-a-tournament-flyer', title: 'How to Read a Pool Tournament Flyer: Every Term Explained',
    desc: 'Decode a pool tournament flyer: added money, entry and greens fees, races, double elimination, the hot seat, true double, player caps, Fargo limits, Calcuttas and more.',
    body: `
<p>Tournament flyers pack a lot into a few lines, and most of it is shorthand. Here's how to read one, line by line, so you know exactly what you're signing up for.</p>
<h2>A sample flyer</h2>
<div class="tip"><b>FALL 9-BALL OPEN · $500 ADDED</b><br>Sat Nov 7 · Sign-ups 11 am, play 12 noon<br>$40 entry ($10 greens) · 64 player cap<br>Double elimination · Race to 5 / 4 on the one-loss side · True double final<br>Fargo 650 & under · Calcutta at 11:30 · Break box in effect</div>
<h2>The money</h2>
<ul>
<li><b>$500 added:</b> the room or a sponsor puts $500 into the prize fund on top of the entry fees. More added money usually means a stronger field.</li>
<li><b>$40 entry ($10 greens):</b> you pay $40. $10 goes to the room for table time (the greens fee) and $30 goes into the prize fund. See our <a href="/guides/pool-tournament-payouts">payout guide</a> or try the <a href="/tools/payout-calculator">payout calculator</a>.</li>
<li><b>Calcutta at 11:30:</b> an auction where people bid on players before the event; the pot is paid to whoever "owns" the winners. Read <a href="/guides/calcutta-auction-explained">Calcutta auctions explained</a>.</li>
</ul>
<h2>The schedule</h2>
<ul>
<li><b>Sign-ups 11 am, play 12 noon:</b> be there before sign-ups close. Many events close the bracket on time and start the draw.</li>
<li><b>64 player cap:</b> the bracket is limited. Big events can fill up, so call ahead or pre-register if the flyer offers it.</li>
</ul>
<h2>The format</h2>
<ul>
<li><b>Double elimination:</b> you're out after two losses. See <a href="/guides/double-elimination-brackets">double-elimination brackets</a>.</li>
<li><b>Race to 5 / 4 on the one-loss side:</b> winners-side matches are first to 5 games; once you've lost once, matches are first to 4, which keeps the event moving.</li>
<li><b>Hot seat:</b> the match between the last two undefeated players. The winner waits in the "hot seat" for the final.</li>
<li><b>True double final:</b> the undefeated player has to be beaten twice, so the losers-side player may need two sets to win.</li>
<li><b>Single race final / one set:</b> the final is one set no matter what, which saves time.</li>
<li><b>Modified single:</b> double elimination early, then single elimination. See <a href="/guides/tournament-formats">tournament formats</a>.</li>
</ul>
<h2>Who can play</h2>
<ul>
<li><b>Fargo 650 & under:</b> only players with a FargoRate rating of 650 or lower may enter. See the <a href="/guides/fargo-rating-chart">Fargo rating chart</a>.</li>
<li><b>Handicapped / rated:</b> races change based on your rating or skill level, so stronger players race to more games.</li>
<li><b>Open:</b> anyone can enter, from beginners to pros.</li>
<li><b>Amateur / no pros:</b> professional players are not allowed. The flyer or director decides who counts as a pro.</li>
<li><b>Ladies / juniors / seniors:</b> divisions limited to those players.</li>
<li><b>Scotch doubles / Jack & Jill:</b> two-player teams taking turns; Jack & Jill means one man and one woman. See <a href="/guides/scotch-doubles">Scotch doubles</a>.</li>
</ul>
<h2>Table and rules</h2>
<ul>
<li><b>Bar box / 7-foot or 9-foot:</b> the table size. See <a href="/guides/pool-table-sizes">pool table sizes</a>.</li>
<li><b>Break box:</b> on the break, the cue ball must start inside a marked area, usually near the side rail.</li>
<li><b>Winner breaks / alternate breaks:</b> who breaks each rack. Alternate breaks give both players an equal chance.</li>
<li><b>Ball in hand / call pocket / BCA or WPA rules:</b> which rule set is used. See <a href="/guides/bar-rules-vs-tournament-rules">bar rules vs. tournament rules</a>.</li>
<li><b>Shot clock:</b> a time limit per shot, mostly at bigger events and streamed matches.</li>
</ul>
<h2>Before you go</h2>
<p>Call the room to confirm. Flyers get printed weeks in advance, and details change. Then take a photo of the flyer and <a href="/scan">post it on Billiard Action Time</a> so other players can find it, or <a href="/tonight/">find a tournament tonight</a>. New words? Check the <a href="/guides/pool-terms-glossary">pool glossary</a>.</p>`
  },
  {
    slug: 'pool-leagues-explained', title: 'Pool Leagues Explained: APA, USA Pool League (BCA) and VNEA',
    desc: 'How pool leagues work: teams, weekly matches, handicaps and skill levels, sessions, and the road to the national championships in Las Vegas. Plus how to join one.',
    body: `
<p>A pool league is the easiest way to play regularly, meet the local players and get better fast. Most leagues play one night a week at a local bar or pool room, as a team, with a handicap system so newer players can win too.</p>
<h2>How a league night works</h2>
<ul>
<li><b>Teams</b> of about five to eight players meet another team at one of their home rooms.</li>
<li>Each night is a set of <b>individual matches</b> between players from the two teams, and the team with more wins takes the night.</li>
<li>Results count toward <b>standings</b> over a session (often 12 to 16 weeks), followed by playoffs.</li>
<li>Most leagues play <b>8-Ball</b>; many also have 9-Ball divisions.</li>
</ul>
<h2>The big leagues</h2>
<div class="t-wrap"><table class="t"><thead><tr><th>League</th><th>Handicap</th><th>Known for</th></tr></thead><tbody>
<tr><td>APA (American Poolplayers Association)</td><td>Skill levels; races change with each player's level</td><td>The largest amateur league, very beginner-friendly</td></tr>
<tr><td>USA Pool League (formerly BCA Pool League)</td><td>Rating-based handicaps</td><td>Standard tournament rules, strong competitive divisions</td></tr>
<tr><td>VNEA</td><td>Varies by local charter</td><td>Bar-box 8-Ball, big team events</td></tr>
</tbody></table></div>
<p>There are also many local and independent leagues, often Fargo-rated, run by a pool room or a group of directors.</p>
<h2>How handicaps work</h2>
<p>Each player has a skill rating that moves with their results. The handicap changes the race, so a newer player might need 2 games while a strong player needs 5. In APA, teams also have a cap on the total of their players' skill levels in a night, so a team can't stack its best players. In rating-based leagues, races come from the gap between ratings, much like our <a href="/tools/fargo-race-calculator">Fargo race calculator</a>.</p>
<h2>The road to Las Vegas</h2>
<p>Most big leagues end their year with national or world championships in Las Vegas. Teams and players qualify through their local playoffs and regional events. See the dates in our <a href="/guides/major-pool-events-calendar">major pool events calendar</a>.</p>
<h2>How to join</h2>
<ol>
<li>Ask at your local pool room or bar: the person behind the counter knows which leagues play there. Find rooms near you in our <a href="/pool-halls/">pool hall directory</a>.</li>
<li>Search for your city plus the league name. Each league has a local operator who places new players on teams.</li>
<li>Join a team that needs a player, or start one with friends.</li>
</ol>
<h2>League rules vs. tournament rules</h2>
<p>League rules can differ from the rules at open tournaments, especially on fouls and calling shots. Before your first open event, read <a href="/guides/bar-rules-vs-tournament-rules">bar rules vs. tournament rules</a> and <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>. Then <a href="/tonight/">find a tournament tonight</a>.</p>`
  },
  {
    slug: 'pool-tips', title: '15 Pool Tips That Improve Your Game Fast',
    desc: 'Fifteen practical pool tips for beginners and league players: stroke, aim, speed, position, safeties, the mental game and how to practice.',
    body: `
<p>You don't need to change everything to play better. These fifteen tips fix the most common problems we see at weekly tournaments. Pick two or three and work on them this week.</p>
<h2>Stroke</h2>
<ol>
<li><b>Stay down.</b> Keep your head still until the object ball is on its way. Jumping up is the number one reason for missed easy shots.</li>
<li><b>Loosen your grip.</b> A tight grip steers the cue. Hold it like a bird: firm enough not to let go, loose enough not to hurt it.</li>
<li><b>Follow through.</b> Let the cue travel a few inches past where the cue ball was. A short, jabbing stroke is hard to repeat.</li>
<li><b>Pause at the back.</b> A short pause before the final stroke stops you from rushing. See <a href="/guides/pool-basics-for-beginners">pool basics</a>.</li>
</ol>
<h2>Aim and speed</h2>
<ol start="5">
<li><b>Aim at the ghost ball, not the object ball.</b> Find where the cue ball has to be at contact. Train it with the <a href="/play/aim-trainer">aim trainer</a> and read <a href="/guides/how-to-aim-in-pool">how to aim</a>.</li>
<li><b>Use the least spin you can.</b> Center ball and the right speed get you most places. Spin adds errors. See <a href="/guides/english-in-pool">English explained</a>.</li>
<li><b>Most misses are speed misses.</b> Hitting too hard makes balls rattle and sends the cue ball far from where you want it. Practice your lag with the <a href="/play/lag-challenge">lag challenge</a>.</li>
</ol>
<h2>Thinking</h2>
<ol start="8">
<li><b>Plan before you shoot.</b> Look at the next two balls, not just the one in front of you. In 8-Ball, read the whole table first. See <a href="/guides/8-ball-patterns">8-Ball strategy</a>.</li>
<li><b>Stay on the right side of the ball.</b> Leave yourself a small angle on the next shot, not a straight-in; angles let you move the cue ball.</li>
<li><b>Break up clusters early</b>, while you still have other balls to shoot.</li>
<li><b>Play safe when the shot is bad.</b> A good safety beats a hopeful miss. Learn three easy ones in <a href="/guides/safety-play-in-pool">safety play</a>.</li>
<li><b>Know the rules.</b> Fouls you don't know about cost games. Take the <a href="/tools/pool-rules-quiz">rules quiz</a>.</li>
</ol>
<h2>Practice and the mental game</h2>
<ol start="13">
<li><b>Practice with a purpose.</b> Twenty minutes of a drill with a score beats an hour of hitting balls. Try the <a href="/guides/pool-practice-drills">7 drills</a> and track them in the <a href="/play/practice-log">practice log</a>.</li>
<li><b>Use the same pre-shot routine every time</b>, so it holds up under pressure. See <a href="/guides/pool-tournament-nerves">beating tournament nerves</a>.</li>
<li><b>Play better players, and play tournaments.</b> You learn more losing to someone better than beating someone worse. <a href="/this-weekend/">Find a tournament this weekend</a>.</li>
</ol>`
  },
  {
    slug: 'bar-pool-etiquette', title: 'Playing Pool at a Bar: Quarters, the Chalkboard and Winner Stays',
    desc: 'How to get a game on a bar pool table: putting quarters up, writing your name on the board, winner stays, and the unwritten rules regulars expect.',
    body: `
<p>Walk into a bar with one pool table on a busy night and you'll find a whole system for who plays next. It's simple once you know it, and following it is the quickest way to make friends at the table.</p>
<h2>How to get next game</h2>
<ul>
<li><b>Quarters on the rail:</b> in many bars you line up your quarters (or the coins the table takes) on the rail. The order of the coins is the order of play.</li>
<li><b>The chalkboard:</b> other bars use a board on the wall. Write your name under the last one.</li>
<li>If you're not sure, ask the people playing: "Who's got next?" They'll tell you how it works here.</li>
</ul>
<h2>Winner stays</h2>
<p>Most bar tables play <b>winner stays</b>: the winner keeps the table and plays the next person in line, who usually pays for the game. Some bars cap it (for example, three wins in a row and you have to step off) so everyone gets to play.</p>
<h2>House rules</h2>
<p>Bar 8-Ball rules vary from place to place: what happens after a scratch, whether you call every shot, whether slop counts, and what happens if the 8 goes in on the break. <b>Agree before the break.</b> Saying "what are we playing?" is normal and nobody minds. See <a href="/guides/bar-rules-vs-tournament-rules">bar rules vs. tournament rules</a>.</p>
<h2>The unwritten rules</h2>
<ul>
<li>Don't put drinks on the rail or the table. Ever.</li>
<li>Keep an eye on the cue rack: put house cues back where you got them, and don't take someone's personal cue.</li>
<li>Stay out of the shooter's way and line of sight.</li>
<li>Don't coach strangers unless they ask.</li>
<li>If you're playing for something (a drink, a few dollars), settle it up right away. See <a href="/guides/money-game-spots">money game etiquette</a>.</li>
<li>When you're done, give the table up. A bar table is shared.</li>
</ul>
<h2>From bar table to tournament</h2>
<p>If you're winning at the bar, you're ready for the bar's weekly tournament. Most bars with a table run one, and they are a great way to play more and meet the local players. <a href="/tournaments/">Find pool tournaments near you</a> and read <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`
  },
  {
    slug: 'tournament-formats', title: 'Pool Tournament Formats Explained: Double Elimination, Round Robin, Chip and More',
    desc: 'Compare pool tournament formats: single and double elimination, modified single, round robin, chip tournaments and Swiss, with how long each takes and when to use it.',
    body: `
<p>The format decides how long your event runs, how many matches each player gets and how fair the result feels. Here are the formats you will see most, side by side.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Format</th><th>Matches for N players</th><th>Fewest matches per player</th><th>Best for</th></tr></thead><tbody>
<tr><td>Single elimination</td><td>N − 1</td><td>1</td><td>Big fields, short on time</td></tr>
<tr><td>Double elimination</td><td>2N − 2 (or 2N − 1)</td><td>2</td><td>Most weekly and weekend events</td></tr>
<tr><td>Modified single</td><td>About 1.5N</td><td>2</td><td>Large fields that want a second chance</td></tr>
<tr><td>Round robin</td><td>N × (N − 1) ÷ 2</td><td>N − 1</td><td>Small fields, leagues, group stages</td></tr>
<tr><td>Chip tournament</td><td>Varies</td><td>Depends on chips</td><td>Mixed-skill weekly events</td></tr>
</tbody></table></div>
<h2>Single elimination</h2>
<p>Lose once and you're out. It is the fastest format and easy to run, but one bad rack sends a player home, which players who drove an hour don't love. Good for the final stage of a big event or when time is short.</p>
<h2>Double elimination</h2>
<p>The standard for local tournaments. Lose once and you drop to the losers side; lose twice and you're out. Everyone plays at least two matches. Read <a href="/guides/double-elimination-brackets">how double-elimination brackets work</a> and print a <a href="/tools/brackets/">free bracket with your players' names</a>.</p>
<h2>Modified single elimination</h2>
<p>A hybrid used at many large events: double elimination for the first couple of rounds, then single elimination once the field is smaller. Players get a second chance early without the event running all night.</p>
<h2>Round robin</h2>
<p>Everyone plays everyone. It is the fairest format and great for small fields, leagues and the group stage of bigger events, but the number of matches grows fast: 8 players means 28 matches. Make the schedule with our <a href="/tools/round-robin-generator">round robin generator</a>.</p>
<h2>Chip tournaments</h2>
<p>Players get chips based on skill, lose a chip per loss and play single games until few players are left. Lively and fair for mixed fields. See <a href="/guides/chip-tournaments">how chip tournaments work</a>.</p>
<h2>Swiss</h2>
<p>Used more in other games than in pool, but some events try it: players are paired each round against others with the same record, for a fixed number of rounds. Everyone plays every round, and the field sorts itself out without anyone being eliminated.</p>
<h2>Picking a format</h2>
<ul>
<li><b>Under 8 players:</b> round robin, or a chip tournament.</li>
<li><b>8 to 64 players, one day:</b> double elimination.</li>
<li><b>Over 64, or tight on time:</b> modified single, or shorter races.</li>
</ul>
<p>Then set the payouts with the <a href="/tools/payout-calculator">payout calculator</a> and read <a href="/guides/how-to-run-a-pool-tournament">how to run a pool tournament</a>.</p>`
  },
  {
    slug: 'start-a-weekly-pool-tournament', title: 'How to Start a Weekly Pool Tournament at Your Bar or Pool Room',
    desc: 'A practical plan for bar owners and directors: picking the night, format, entry fee and greens fee, getting players to show up, and keeping them coming back.',
    body: `
<p>A weekly tournament can fill tables on a slow night, bring in regulars and build a local pool scene. The rooms that do it well keep it simple, start on time and treat players fairly. Here's a plan that works.</p>
<h2>1. Pick the night and the time</h2>
<ul>
<li>Choose a night that is slow for your room but isn't the same night as a big event nearby. Check what's already running in your area on our <a href="/tournaments/">tournament listings</a>.</li>
<li>Start early enough to finish before closing. A 7 pm start with sign-ups closing at 7:15 works for most bars.</li>
<li>Keep the same night every week. Players plan around a routine.</li>
</ul>
<h2>2. Choose the game and format</h2>
<ul>
<li><b>8-Ball</b> draws the widest crowd in bars; <b>9-Ball</b> appeals to stronger players in pool rooms.</li>
<li><b>Double elimination</b> is what most players expect. With 12–24 players and a few tables, short races (race to 2 or 3) keep the night on schedule. See <a href="/guides/tournament-formats">tournament formats</a>.</li>
<li>Consider a <b>handicap</b> or a <a href="/guides/chip-tournaments">chip format</a> so newer players have a real chance. They'll come back.</li>
</ul>
<h2>3. Set the money</h2>
<ul>
<li>A common weekly setup is a $10 to $20 entry, with a few dollars per player kept as a <b>greens fee</b> for table time.</li>
<li><b>Added money</b>, even a small amount, makes your event stand out. Many rooms add money from the bar.</li>
<li>Pay out about one place for every eight players. The <a href="/tools/payout-calculator">payout calculator</a> does the math.</li>
<li>Post the payout before the first match.</li>
</ul>
<h2>4. Run it smoothly</h2>
<ul>
<li>Print a <a href="/tools/brackets/">bracket</a> and fill it in with a random draw. Post it where everyone can see.</li>
<li>Have one person in charge who knows the rules and makes the calls.</li>
<li>Post the rules on the wall: which rule set, the race, 8 on the break, who racks. See <a href="/guides/bar-rules-vs-tournament-rules">bar rules vs. tournament rules</a>.</li>
<li>Keep matches moving: send players to tables as soon as they're open.</li>
</ul>
<h2>5. Get players to show up</h2>
<ul>
<li><a href="/post">Post your tournament on Billiard Action Time</a>, free. It gets its own page and share graphic, shows up on your city and state pages, and players can get alerts for it.</li>
<li>Post a flyer in local pool Facebook groups every week, the day before.</li>
<li>Put a flyer by the register and on the tables.</li>
<li>Talk to the local league players. One league team can fill half a bracket.</li>
</ul>
<h2>6. Keep them coming back</h2>
<ul>
<li>Start on time, every time.</li>
<li>Pay out right away and correctly.</li>
<li>Run a drink or food special for players.</li>
<li>Try a monthly bigger event: a scotch doubles night, a ladies' event, or extra added money.</li>
</ul>
<p>More detail in <a href="/guides/how-to-run-a-pool-tournament">how to run a pool tournament</a> and <a href="/guides/pool-tournament-payouts">pool tournament payouts</a>.</p>`
  },
  {
    slug: '9-ball-strategy', title: '9-Ball Strategy: Runouts, Push Outs and When to Play Safe',
    desc: 'How to win more 9-Ball games: plan three balls ahead, use the push out well, take combinations on the 9, and play safe when the run isn\'t there.',
    body: `
<p>9-Ball looks simple: hit the lowest ball, and whoever makes the 9 wins. But because you can't choose which ball to shoot, every game is about the path from one ball to the next. These habits win more racks than extra shot-making.</p>
<h2>Plan three balls ahead</h2>
<p>Before each shot, look at the ball you are shooting, the next ball and the one after. Pick where you want the cue ball to land so the next shot has an angle that sends you toward the third ball. Straight-in shots are easy to make but hard to move the cue ball from, so a small angle is usually better.</p>
<h2>Know where the "problem" is</h2>
<p>Most racks have one tough spot: a ball on a rail, two balls close together, or a long trip across the table. Find it before your first shot after the break. If there is a problem you can't solve, plan your <a href="/guides/safety-play-in-pool">safety</a> early, while you still have choices.</p>
<h2>Using the push out</h2>
<p>On the shot right after the break, the incoming player may push out: move the cue ball anywhere without having to hit the lowest ball. The opponent then chooses who shoots. Good push outs leave a shot that is <b>hard to judge</b>: too risky to take for sure, but too tempting to give away. If your opponent takes it and misses, you're in. If they give it back, you get a shot you planned for.</p>
<h2>Look for the 9</h2>
<ul>
<li><b>Combinations on the 9:</b> any legal shot that makes the 9 wins. If the lowest ball and the 9 line up with a pocket, it may be your best shot. See the <a href="/trick-shots/dead-combination">dead combination</a>.</li>
<li><b>Caroms and kisses:</b> sometimes the 9 can be knocked in off the lowest ball. Check before you play a hard shot on the lowest ball.</li>
<li><b>Don't leave the 9 hanging</b> for your opponent on a safety. If it sits near a pocket, your safety needs to be very good.</li>
</ul>
<h2>The break</h2>
<p>A controlled break that leaves the cue ball near the middle of the table, with a shot at the 1, is worth more than raw power. Many players break from near the side rail. Read <a href="/guides/how-to-break-in-pool">how to break</a> for the details, and check your event's break rules.</p>
<h2>When to play safe</h2>
<ul>
<li>The shot is low-percentage and a miss leaves an easy run.</li>
<li>You can make the ball but can't get to the next one.</li>
<li>The lowest ball is blocked and a kick is unlikely to make it, but likely to leave your opponent safe.</li>
</ul>
<p>In 9-Ball, three fouls in a row lose the game (after a warning), so a good safety that leaves your opponent kicking can win the rack on its own.</p>
<h2>Practice</h2>
<ul>
<li>Play the ghost: break and try to run out with ball in hand after the break. Keep score. See the <a href="/guides/pool-practice-drills">practice drills</a>.</li>
<li>Throw three balls out and run them in order, then add a ball at a time.</li>
<li>Train your aim with the <a href="/play/aim-trainer">aim trainer</a> and your speed with the <a href="/play/lag-challenge">lag challenge</a>.</li>
</ul>
<p>Brush up on the <a href="/guides/9-ball-rules">9-Ball rules</a> and set fair races with the <a href="/tools/fargo-race-calculator">Fargo race calculator</a>.</p>`
  },
  {
    slug: 'pool-cue-care', title: 'Pool Cue Care: Tips, Chalk, Shafts and Cases',
    desc: 'Keep your cue playing like new: shaping and scuffing the tip, chalking the right way, cleaning the shaft, avoiding warps, and when to replace a tip.',
    body: `
<p>A cue that is cared for plays the same every time. Most cue problems come from a worn tip, a dirty shaft or a cue left somewhere hot or damp. A few minutes of care now and then fixes nearly all of them.</p>
<h2>The tip</h2>
<ul>
<li><b>Shape:</b> a tip should be rounded, about the curve of a nickel or a dime. A flat tip miscues more on off-center hits. Use a tip shaper and work it lightly from the edges toward the middle.</li>
<li><b>Scuff:</b> a tip that has gone shiny and hard won't hold chalk. Roughen the surface lightly with a tip tool. Don't overdo it; scuffing wears the tip down.</li>
<li><b>Mushrooming:</b> when the tip spreads wider than the ferrule, trim the edges with a sharp blade or a tip trimmer, or have a cue repair shop do it.</li>
<li><b>Replace it</b> when it gets thin (a few millimeters), cracks, separates from the ferrule, or won't hold a shape. Many pool rooms and cue shops replace tips for a small fee.</li>
</ul>
<h2>Chalk</h2>
<ul>
<li>Chalk before nearly every shot, and always before shots with spin or draw.</li>
<li><b>Brush the chalk on</b> with light strokes, turning the cube. Don't screw the tip into the chalk; that leaves a bare spot in the middle.</li>
<li>Check the tip: it should be evenly covered with a thin layer, with no bare patches.</li>
<li>Don't put chalk face-down on the rail where it will smear the cloth.</li>
</ul>
<h2>The shaft</h2>
<ul>
<li>Wipe the shaft with a clean, dry cloth after you play to remove chalk and hand oils.</li>
<li>For a deeper clean, a slightly damp cloth (not wet), then dry it right away. Wood swells with water.</li>
<li>A shaft burnisher or a piece of leather can smooth the wood. Avoid sandpaper unless you know what you are doing; it removes wood and changes the taper.</li>
<li>If your hand sticks to the shaft, wipe it clean or use a glove rather than powder, which ends up everywhere.</li>
</ul>
<h2>Storage and travel</h2>
<ul>
<li><b>Use a case.</b> Even a simple soft case protects against dings.</li>
<li><b>Never leave a cue in a hot car</b> or a damp basement. Heat and humidity are the main causes of warping.</li>
<li>Store it upright in a rack or flat in a case, not leaning in a corner.</li>
<li>Screw the joint together by hand, snug but not forced. Keep the joint and pin clean.</li>
</ul>
<h2>Is my cue warped?</h2>
<p>Roll the assembled cue on a flat table, or look down it like a rifle while you turn it. A small wobble in the shaft is common and often doesn't matter; a big one does. A cue repair shop can tell you whether it can be straightened.</p>
<p>Shopping for a new one? Read <a href="/guides/how-to-choose-a-pool-cue">how to choose a pool cue</a>.</p>`
  },
  {
    slug: 'money-game-spots', title: 'Spots in Pool Money Games: The Breaks, the 8, Games on the Wire',
    desc: 'How handicaps work in pool money games: giving the breaks, the 8-ball or the 7, games on the wire, races and sets, and how to make a fair game.',
    body: `
<p>When two players of different skill play for money, the stronger player usually gives a <b>spot</b>, a handicap that makes the game closer to even. Knowing the common spots helps you agree to a fair game, and keeps you from accepting a bad one.</p>
<h2>Common spots</h2>
<ul>
<li><b>The breaks:</b> the weaker player breaks every rack instead of alternating or winner breaking. In 9-Ball and 10-Ball, that is a big spot.</li>
<li><b>The 8-ball (in 9-Ball):</b> the weaker player also wins the game by legally making the 8. "The 7 and 8" or "the 7-8-9" give even more ways to win.</li>
<li><b>Games on the wire:</b> the weaker player starts with games already counted. "Race to 7, two on the wire" means they only need 5 more.</li>
<li><b>A shorter race:</b> "7 to 5" means the stronger player needs 7 games and the weaker player needs 5.</li>
<li><b>In One Pocket:</b> a ball count spot, such as 8 to 6, where the weaker player needs fewer balls to win.</li>
<li><b>In 8-Ball:</b> sometimes the weaker player gets ball in hand after the break, or the "last two" (the stronger player must run the last two balls and the 8 in one turn).</li>
</ul>
<h2>Races and sets</h2>
<p>Money games are usually played as a race (first to a number of games) or by sets, such as "race to 5 for $50, best of three sets." Agree on the format, the spot, who breaks the first rack and the rules before anyone puts money up. Short races favor the underdog; long races favor the stronger player.</p>
<h2>Finding a fair spot</h2>
<p>Ratings make it easier. With two FargoRate ratings you can work out a fair race in seconds with our <a href="/tools/fargo-race-calculator">Fargo race calculator</a>, or see the whole <a href="/guides/fargo-rating-chart">Fargo rating chart</a>. Without ratings, ask around: in most rooms, everyone knows everyone's "speed."</p>
<h2>Etiquette for money games</h2>
<ul>
<li>Agree on everything before the first break, and say it out loud.</li>
<li>Many players put the money up with a trusted third person, or on the light over the table, so there's no question after the match.</li>
<li>Pay right away when you lose. Your reputation is worth more than any one game.</li>
<li>Play within your budget. A game you can't afford to lose is a game you'll play badly.</li>
</ul>
<p>Looking for a game? See the <a href="/money-matches/">money matches</a> board and the <a href="/matches">match finder</a>, and learn the lingo in the <a href="/guides/pool-terms-glossary">pool glossary</a>.</p>`
  },
  {
    slug: 'how-to-rack-pool-balls', title: 'How to Rack Pool Balls: 8-Ball, 9-Ball and 10-Ball (With Diagrams)',
    desc: 'How to rack for 8-Ball, 9-Ball and 10-Ball: where each ball goes, how to get a tight rack, and the racking rules used in most tournaments.',
    body: `
<p>A good rack is tight, in the right place and set up correctly for the game. A loose rack spreads badly no matter how hard the breaker hits it. Here is how to rack each of the common games.</p>
<h2>Where the rack goes</h2>
<p>The front ball (the "apex" or "head ball") sits on the <b>foot spot</b>: the spot two diamonds from the foot rail, in the middle of the table. The rest of the rack points toward the foot rail, square to the table.</p>
<h2>8-Ball</h2>
${table({ balls: rack([[1], [9, 2], [3, 8, 10], [11, 4, 12, 5], [6, 13, 7, 14, 15]]) }, '8-Ball: the 8 in the middle of the third row, a solid and a stripe in the two back corners.')}
<ul>
<li>Use the triangle with all 15 balls.</li>
<li>The <b>8-ball goes in the center</b> of the third row.</li>
<li>The two <b>back corners</b> hold one solid and one stripe.</li>
<li>Mix the rest; many rules ask that solids and stripes alternate around the outside as much as possible.</li>
</ul>
<h2>9-Ball</h2>
${table({ balls: rack([[1], [2, 3], [4, 9, 5], [6, 7], [8]]) }, '9-Ball: a diamond with the 1 in front and the 9 in the middle.')}
<ul>
<li>Use 9 balls in a <b>diamond shape</b> (use the triangle and leave it empty at the back, or use a diamond rack).</li>
<li>The <b>1-ball goes in front</b> on the foot spot, and the <b>9-ball goes in the middle</b>.</li>
<li>The other balls can go anywhere.</li>
</ul>
<h2>10-Ball</h2>
${table({ balls: rack([[1], [2, 3], [4, 10, 5], [6, 7, 8, 9]]) }, '10-Ball: the 1 in front and the 10 in the middle of the third row.')}
<ul>
<li>Use the triangle with 10 balls (the first four rows).</li>
<li>The <b>1-ball goes in front</b> on the foot spot, and the <b>10-ball goes in the middle</b> of the third row.</li>
<li>The other balls can go anywhere.</li>
</ul>
<h2>How to get a tight rack</h2>
<ol>
<li>Put the balls in the triangle and slide it so the front ball sits on the foot spot.</li>
<li>Push the balls forward toward the front of the triangle with your fingers, so the front balls press together.</li>
<li>Hold the balls in place and lift the triangle straight up slowly, without bumping them.</li>
<li>Look from the side and the front: every ball should touch its neighbors. If you see gaps, rack again.</li>
</ol>
<p>On worn tables, balls sit in little dents around the spot and won't freeze together. Rolling the rack slightly back and forth or tapping the balls in place can help. Many tournaments now use a thin <b>template rack</b> (a plastic sheet with holes) that holds the balls frozen and stays under them for the break.</p>
<h2>Who racks?</h2>
<p>It depends on the event: in some, the loser of the last game racks; in others, players rack their own or the opponent always racks. Some events use "rack your own" with a template. If you rack for your opponent, rack well. It is part of <a href="/guides/pool-tournament-etiquette">tournament etiquette</a>, and a fair rack is something every opponent can ask to see.</p>
<p>Now break it: read <a href="/guides/how-to-break-in-pool">how to break in 8-Ball, 9-Ball and 10-Ball</a>.</p>`
  },
  {
    slug: 'pool-basics-for-beginners', title: 'Pool for Beginners: Stance, Bridge, Grip and Stroke',
    desc: 'Start playing pool the right way: how to stand, how to make a bridge, how to hold the cue, and how to make a smooth, straight stroke. Plus a simple first practice plan.',
    body: `
<p>Most of what makes a good pool player is a simple, repeatable set of basics. Getting them right early saves months of bad habits. Here is the whole foundation, in plain English.</p>
<h2>Stance</h2>
<ul>
<li>Stand behind the shot and step into it along the line, so your body is lined up before you bend down.</li>
<li>For a right-handed player, the right foot is roughly on the line of the shot and the left foot is forward and to the left. Feet about shoulder-width apart.</li>
<li>Bend at the waist and bring your chin down close to the cue, over the line. How low is up to you; lower makes aiming easier, but stay comfortable.</li>
<li>Stay balanced: you should be able to hold your stance without leaning on the table.</li>
</ul>
<h2>Bridge</h2>
<p>The bridge is your front hand. It has to hold the cue steady and let it slide straight. (More detail in <a href="/guides/how-to-hold-a-pool-cue">how to hold a pool cue</a>.)</p>
<ul>
<li><b>Open bridge:</b> lay your hand flat on the cloth, raise the knuckles slightly and rest the cue in the V between your thumb and the base of your first finger. Easy and stable; good for beginners.</li>
<li><b>Closed bridge:</b> curl your first finger over the cue to make a loop. More control on firm shots.</li>
<li>Keep the bridge about 6 to 9 inches from the cue ball on normal shots.</li>
<li>Rail bridge: when the cue ball is near the cushion, rest the cue on the rail and guide it with your fingers.</li>
</ul>
<h2>Grip</h2>
<p>Hold the cue loosely with your back hand, near the balance point or a little behind it, with your thumb and first two fingers doing most of the work. A tight grip makes the cue steer off line. At the moment of contact, your forearm should hang about straight down from the elbow.</p>
<h2>Stroke</h2>
<ul>
<li>Only your forearm should move, swinging from the elbow like a pendulum. Keep your shoulder and head still.</li>
<li>Take a few smooth practice strokes, pause briefly at the back, then stroke through.</li>
<li><b>Follow through</b> past where the cue ball was, and <b>stay down</b> until the ball is well on its way. Jumping up is the most common reason beginners miss.</li>
</ul>
<h2>Where to look</h2>
<p>During your practice strokes, your eyes go back and forth between the cue ball and the spot you are aiming at on the object ball. On the final stroke, most players look at the object ball. Learn how to pick the aim point in <a href="/guides/how-to-aim-in-pool">how to aim in pool</a>.</p>
<h2>Your first practice plan</h2>
<ol>
<li><b>Straight-in shots</b> (10 minutes): an object ball a diamond from a corner pocket and the cue ball straight behind it. Make ten in a row.</li>
<li><b>Stop shots</b> (10 minutes): same shot, but make the cue ball stop dead. See the <a href="/guides/pool-practice-drills">stop-shot ladder</a>.</li>
<li><b>Easy cuts</b> (10 minutes): move the cue ball off to the side for gentle cut shots.</li>
<li><b>Play a rack</b>: 8-Ball against a friend or the "ghost."</li>
</ol>
<p>Practice your eye between sessions with the <a href="/play/aim-trainer">aim trainer game</a>, learn the <a href="/guides/pool-terms-glossary">pool terms</a>, and when you are ready, read <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`
  },
  {
    slug: 'cutthroat-pool-rules', title: 'Cutthroat Pool Rules: The Best Game for Three Players',
    desc: 'How to play cutthroat pool with three players: choosing groups, the goal of sinking your opponents\' balls, fouls, and how to win.',
    body: `
<p>Cutthroat is the classic pool game for three players (it also works for five). Instead of making your own balls, you try to <b>sink everyone else's</b>. The last player with a ball left on the table wins. It is fast, a little ruthless, and great for a group.</p>
<h2>The groups</h2>
<ul>
<li>Use all 15 balls, racked in the triangle with the 1-ball at the front.</li>
<li>Three groups: <b>1 to 5</b>, <b>6 to 10</b> and <b>11 to 15</b>.</li>
<li>With five players, use five groups of three: 1–3, 4–6, 7–9, 10–12 and 13–15.</li>
</ul>
<h2>How groups are chosen</h2>
<p>Many players use this simple rule: the first player to legally pocket a ball after the break picks their group, or gets that ball's group, and the others follow in turn. Other games assign groups by shooting order before the break. Agree on it before you start.</p>
<h2>How to play</h2>
<ul>
<li>Players shoot in a fixed order. You keep shooting as long as you legally pocket an opponent's ball.</li>
<li>If you pocket one of your <b>own</b> balls, it stays down and your turn ends (in most house rules).</li>
<li>When all of a player's balls are pocketed, that player is out.</li>
<li>The last player with any ball left on the table wins.</li>
</ul>
<h2>Fouls</h2>
<p>A common rule: when you scratch or foul, <b>each opponent gets one of their pocketed balls back</b> on the table (spotted on the foot spot). That rewards the players who are behind. Some groups also give the next player ball in hand. Again, agree before the break.</p>
<h2>Strategy</h2>
<ul>
<li><b>Pick on the leader.</b> Sink the balls of the player with the most left, so the others don't gang up on you.</li>
<li><b>Hide your own balls.</b> Leave them near rails and away from pockets, and use safeties to protect them.</li>
<li><b>Count before you shoot.</b> Making the last ball of a player who is almost out can turn the game into a duel you might not want.</li>
</ul>
<p>Cutthroat is a fun way to practice runouts and safeties. When you are ready for something more serious, learn <a href="/guides/9-ball-rules">9-Ball</a> or <a href="/guides/one-pocket">One Pocket</a>.</p>`
  },
  {
    slug: 'bar-rules-vs-tournament-rules', title: 'Bar Rules vs. Tournament Rules: What Changes in 8-Ball',
    desc: 'The most common differences between bar (house) 8-Ball rules and tournament rules: scratches, calling shots, the 8 on the break, slop and more.',
    body: `
<p>If you learned 8-Ball in a bar or at home, some tournament rules will surprise you. Neither one is "wrong": bar rules are local custom, and tournament rules are written down so everyone plays the same game. Here are the differences that come up most.</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Situation</th><th>Common bar rules</th><th>Most tournament rules</th></tr></thead><tbody>
<tr><td>Cue ball scratch</td><td>Behind the head string ("in the kitchen")</td><td>Ball in hand anywhere on the table</td></tr>
<tr><td>Calling shots</td><td>Often only the 8 is called</td><td>Call ball and pocket on every non-obvious shot</td></tr>
<tr><td>Balls made by luck ("slop")</td><td>Often count</td><td>Only count if the called ball went in the called pocket</td></tr>
<tr><td>8-ball on the break</td><td>Often a win</td><td>Depends on the event: a win, a re-rack or spotted; check</td></tr>
<tr><td>Scratch on the 8</td><td>Loss</td><td>Loss</td></tr>
<tr><td>Calling the 8-ball pocket</td><td>Sometimes "mark the pocket" with chalk or a coaster</td><td>Call it out loud or mark it, as the event says</td></tr>
<tr><td>Hitting the wrong group first</td><td>Sometimes just loss of turn</td><td>Foul, ball in hand</td></tr>
<tr><td>No rail after contact</td><td>Often not called</td><td>Foul, ball in hand</td></tr>
</tbody></table></div>
<h2>Why tournaments use ball in hand anywhere</h2>
<p>Ball in hand anywhere makes every foul costly, which rewards careful play and safeties. It also removes arguments about what was and wasn't a foul in the kitchen.</p>
<h2>Before your first tournament</h2>
<ul>
<li>Ask which rule set the event uses. Many weekly events post their rules on the wall or on the flyer.</li>
<li>Ask about the 8 on the break, and whether you must call the 8 pocket out loud.</li>
<li>If something is unclear during a match, stop and ask the director before the shot, not after.</li>
</ul>
<p>Read the full <a href="/guides/8-ball-rules">8-Ball rules guide</a>, test yourself with the <a href="/tools/pool-rules-quiz">rules quiz</a>, and see <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`
  },
  {
    slug: 'how-to-aim-in-pool', title: 'How to Aim in Pool: Ghost Ball, Contact Points and Cut Angles',
    desc: 'Learn to aim pool shots: the ghost ball method, fractional aiming (full, 3/4, 1/2, 1/4 ball), why thin cuts are hard, and how to fix missing thick or thin.',
    body: `
<p>Aiming is the first thing every player struggles with, and there is no magic trick. But there is a simple picture that makes every cut shot make sense, and a few reference angles that make it faster. Learn these, then train your eye with our <a href="/play/aim-trainer">aim trainer game</a>.</p>
<h2>The ghost ball</h2>
<p>Draw an imaginary line from the center of the pocket through the center of the object ball and out the other side. The spot on that line, one ball-width behind the object ball, is where the <b>center of the cue ball</b> needs to be at the moment of contact. Players call the imaginary ball sitting there the ghost ball.</p>
${table({ balls: [{ x: 6.2, y: 1.3, n: 1 }, { x: 5.96, y: 1.48, n: 'g' }, { x: 3.2, y: 2.6, n: 0 }], paths: [[[3.2, 2.6], [5.85, 1.52]], { pts: [[6.2, 1.3], [7.86, 0.12]], color: '#ffd54a' }] }, 'Aim the cue ball at the ghost ball (dashed circle), not at the object ball.')}
<p>So you aim the cue ball at the ghost ball, not at the object ball. On a straight-in shot the ghost ball is right behind the object ball, and you aim at its center. The more the shot is cut, the farther your aim moves away from the object ball.</p>
<h2>Contact point</h2>
<p>Another way to see the same thing: the <b>contact point</b> is the spot on the object ball farthest from the pocket. The cue ball has to touch exactly there. Some players find it easier to look at the contact point; others see the ghost ball. Both give the same aim. Use whichever one your eye trusts.</p>
<h2>Fractional aiming: four reference shots</h2>
<p>Many players learn a few fixed "overlaps" between the cue ball and object ball, and the cut angle each one makes:</p>
<div class="t-wrap"><table class="t"><thead><tr><th>Aim (cue ball center at…)</th><th>Hit</th><th>Cut angle</th></tr></thead><tbody>
<tr><td>Center of the object ball</td><td>Full ball</td><td>0° (straight in)</td></tr>
<tr><td>Halfway between center and edge</td><td>3/4 ball</td><td>about 15°</td></tr>
<tr><td>The edge of the object ball</td><td>1/2 ball</td><td>30°</td></tr>
<tr><td>Halfway outside the edge</td><td>1/4 ball</td><td>about 49°</td></tr>
<tr><td>Just grazing the edge</td><td>Very thin</td><td>close to 90°</td></tr>
</tbody></table></div>
<p>The half-ball hit is the most useful one to memorize: aim the center of the cue ball at the edge of the object ball and the object ball leaves at 30 degrees. Shots between the references are "a bit fuller than half ball" and so on.</p>
<h2>Why thin cuts are so hard</h2>
<p>On a straight-in shot, a small aiming error barely changes where the object ball goes. On a thin cut, the same error is multiplied several times. That is why good players avoid leaving themselves thin cuts, and why the <a href="/play/aim-trainer">aim trainer</a> gets harder as the angle grows.</p>
<h2>Fixing "thick" and "thin" misses</h2>
<ul>
<li><b>Missing thick</b> means you hit the object ball too full, so it didn't cut enough. Aim farther outside the object ball.</li>
<li><b>Missing thin</b> means you over-cut it, so it went past the pocket on the other side. Aim a touch fuller.</li>
<li><b>Slow cut shots go a little thicker</b> than the geometry says because of friction between the balls, called throw. On slow, thin cuts, aim a hair thinner. See the <a href="/trick-shots/throw-shot">throw shot</a>.</li>
<li><b>Side spin moves the cue ball off line.</b> Learn to aim with a center hit first. See <a href="/guides/english-in-pool">English explained</a>.</li>
</ul>
<h2>A simple routine that helps</h2>
<ol>
<li>Stand behind the shot and find the line from the pocket through the object ball.</li>
<li>Pick the ghost ball (or contact point) while you are standing, not once you are down.</li>
<li>Walk into the shot along the aiming line and get down on it.</li>
<li>Take a couple of smooth practice strokes, pause, and stroke through.</li>
</ol>
<p>Practice it: <a href="/play/aim-trainer">play the aim trainer</a>, then take the <a href="/guides/pool-practice-drills">practice drills</a> to the table.</p>`
  },
  {
    slug: 'english-in-pool', title: 'English in Pool Explained: Follow, Draw, Stun and Side Spin',
    desc: 'How cue ball spin works: follow, draw and stun, side spin off the rails, and why English makes the cue ball squirt and swerve. Plus when not to use it.',
    body: `
<p>"English" is side spin, but most players use the word for any spin on the cue ball. Spin is how good players control where the cue ball goes after the shot. It also causes a lot of misses, so it helps to know what it really does.</p>
<h2>The cue ball's face</h2>
<p>Picture the cue ball as a clock face. Hitting above center (12 o'clock) puts on <b>follow</b>. Below center (6 o'clock) puts on <b>draw</b>. Left and right (9 and 3 o'clock) put on <b>side spin</b>. Most shots only need about one tip of offset from center; more than that risks a miscue.</p>
<h2>Follow, draw and stun</h2>
<ul>
<li><b>Follow (topspin):</b> after hitting the object ball, the cue ball keeps rolling forward. On a straight-in shot, it follows the object ball toward the pocket.</li>
<li><b>Draw (backspin):</b> the cue ball comes back toward you after contact. The farther the cue ball has to travel to the object ball, the more draw you need, because the cloth wears the backspin off. Step-by-step help: <a href="/guides/how-to-draw-the-cue-ball">how to draw the cue ball</a>.</li>
<li><b>Stun (stop):</b> a center or slightly-low hit that makes the cue ball slide, with no spin, at contact. On a straight-in shot it stops dead. On a cut, it leaves at 90 degrees to the object ball's path (see the <a href="/trick-shots/ninety-degree-carom">90-degree carom</a>).</li>
</ul>
<p>On cut shots, follow bends the cue ball forward of the 90-degree line, and draw bends it back. That is the main tool for position play.</p>
<h2>Side spin off the rails</h2>
<p>Side spin mostly matters when the cue ball hits a cushion. <b>Running English</b> (spin in the direction the ball is going along the rail) makes the cue ball come off the rail longer and faster. <b>Reverse English</b> (the other side) makes it come off shorter and slower, or even straight back. Players use side spin to open up angles off the rail that a center hit can't reach.</p>
<h2>The catch: squirt and swerve</h2>
<p>Side spin changes the cue ball's path even before it hits anything:</p>
<ul>
<li><b>Squirt (deflection):</b> hit the right side and the cue ball pushes slightly to the left of where you aimed. Low-deflection shafts reduce this.</li>
<li><b>Swerve:</b> because the cue is never perfectly level, side spin makes the cue ball curve back the other way as it travels. It grows with distance and slower speed.</li>
<li><b>Throw:</b> side spin can also push the object ball a little off line at contact.</li>
</ul>
<p>Squirt and swerve partly cancel at some speeds and distances, which is why players learn to "feel" English rather than calculate it.</p>
<h2>When not to use English</h2>
<p>If you can get position with a center-ball hit and the right speed, do that. Side spin adds risk to every shot. The best players use the least spin they can.</p>
<h2>Practice</h2>
<ul>
<li>Stop shots from straight-in, at growing distance (the <a href="/guides/pool-practice-drills">stop-shot ladder</a>).</li>
<li>Draw and follow on the same shot to see how far each one sends the cue ball.</li>
<li>One-rail kicks with left, center and right spin to see how much the angle changes.</li>
</ul>
<p>Then try the <a href="/trick-shots/power-draw">power draw</a> and, if your room allows it, the <a href="/trick-shots/masse-curve">massé</a>.</p>`
  },
  {
    slug: 'safety-play-in-pool', title: 'Safety Play in Pool: How to Win Without Making a Ball',
    desc: 'Pool safety basics: when to play safe, the main types of safeties, two-way shots, the rules every safety must follow, and simple safeties anyone can learn.',
    body: `
<p>A safety is a shot where your goal is not to make a ball, but to leave your opponent with no good shot. Strong players often win more games with safeties than with runouts. You don't need to be a great shot-maker to play good safeties; you need to know a few patterns.</p>
<h2>The rules every safety must follow</h2>
<p>A safety is still a normal shot. In most games you must hit the correct ball first, and then a ball must go in a pocket or <b>some ball must hit a rail</b> after contact. If you just roll the cue ball up behind a ball and nothing hits a rail, it is a foul. In 8-Ball and 10-Ball you may also need to call "safety" before the shot; ask how your event plays it.</p>
<h2>When to play safe</h2>
<ul>
<li>The shot you have is hard <b>and</b> a miss would leave your opponent an easy out.</li>
<li>You can't get from the ball you are shooting to the next one.</li>
<li>Your opponent is a much stronger shot-maker than you.</li>
<li>In 8-Ball, your opponent has trouble balls and you have a chance to lock them up.</li>
</ul>
<h2>The main kinds of safety</h2>
<ul>
<li><b>Hide the cue ball.</b> Put the cue ball behind another ball so your opponent can't see the ball they need to hit (a "snooker").</li>
<li><b>Distance.</b> Leave the cue ball and the object ball at opposite ends of the table, ideally with one of them on a rail. Long shots are hard to make, and harder to make with position.</li>
<li><b>Freeze to a rail.</b> A cue ball frozen on the rail is hard to cue and hard to control.</li>
<li><b>Two-way shot.</b> Try the shot, but with a speed that leaves your opponent safe if you miss. This is the best option when it is available.</li>
</ul>
<h2>Three safeties anyone can learn</h2>
<ol>
<li><b>Thin cut to the far rail.</b> Barely clip the object ball so it goes to a rail, and send the cue ball the length of the table.</li>
<li><b>Stop behind a ball.</b> When a blocker is near the object ball, hit the object ball softly to a rail and stop the cue ball behind the blocker.</li>
<li><b>Roll up in 8-Ball.</b> Push the cue ball gently behind one of your balls so it blocks your opponent's shot, while a ball still reaches a rail.</li>
</ol>
<h2>Kicking out of safeties</h2>
<p>Once you start playing safeties, your opponent will too. Learn one-rail kicks using the diamonds: they are the best answer to a good safety. Read <a href="/guides/how-to-kick-in-pool">how to kick in pool</a>, then try the <a href="/guides/pool-practice-drills">kick drill</a> and the <a href="/play/kick-trainer">kick shot trainer</a>.</p>
<p>Next: learn to plan your runs with <a href="/guides/8-ball-patterns">8-Ball pattern play</a>, or try a <a href="/guides/one-pocket">game of One Pocket</a>, where almost every shot is part offense, part safety.</p>`
  },
  {
    slug: '8-ball-patterns', title: '8-Ball Strategy: How to Plan a Runout',
    desc: 'How to run out in 8-Ball: read the table first, pick the right group, find your key ball, break up clusters early and keep insurance balls near pockets.',
    body: `
<p>Most 8-Ball games are lost by players who could make the balls but didn't plan. The good news: a little planning before your first shot wins more games than any amount of extra shot-making.</p>
<h2>Step 1: Read the whole table before you shoot</h2>
<p>When the table is open, look at both groups before you choose. Ask for each group: are any balls stuck in clusters or on rails with no pocket? Are any balls blocked from every pocket? Choose the group with the fewest problems, not the one with the easiest first shot.</p>
<h2>Step 2: Work backward from the 8</h2>
<p>Look at where the 8-ball is and which pocket it can go in. Then pick the <b>key ball</b>: the last ball of your group, the one that will give you an easy angle on the 8. Then pick the ball before that. Planning the last two or three balls first keeps you from finishing in a bad spot.</p>
<h2>Step 3: Fix problems early</h2>
<ul>
<li><b>Break out clusters while you still have other balls to shoot.</b> If you wait, you may have to break them up with your last ball and nothing to shoot after.</li>
<li><b>Use a ball near the cluster as a "break-out" ball.</b> Shoot it and let the cue ball carry into the cluster at a soft speed.</li>
<li><b>Move problem balls off the rail</b> with a carom or a soft hit if you can't pocket them yet.</li>
</ul>
<h2>Step 4: Keep insurance balls</h2>
<p>A ball sitting near a pocket is an <b>insurance ball</b>: you can make it from almost anywhere. Don't shoot it early just because it's easy. Save it for when you get out of line.</p>
<h2>Step 5: Use the simplest position</h2>
<p>Choose shots that need the least cue ball movement. Stay on the same side of the table when you can. Plan to land on the correct side of each next ball, so you are never forced to go across it.</p>
<h2>When there is no runout</h2>
<p>If you can't see a way out, don't just shoot and hope. Make the balls you can while you improve your layout, then play a <a href="/guides/safety-play-in-pool">safety</a>. In 8-Ball, leaving your opponent's balls blocked by yours is often worth more than pocketing one more ball.</p>
<h2>A quick checklist</h2>
<ol>
<li>Which group has fewer problems?</li>
<li>Where does the 8 go, and what is my key ball?</li>
<li>Which clusters do I need to break, and with what?</li>
<li>Which ball is my insurance?</li>
<li>If I can't run out, where is my safety?</li>
</ol>
<p>Brush up on the <a href="/guides/8-ball-rules">8-Ball rules</a>, test yourself with the <a href="/tools/pool-rules-quiz">rules quiz</a>, and practice runouts with the <a href="/guides/pool-practice-drills">play-the-ghost drill</a>.</p>`
  },
  {
    slug: 'pool-tournament-nerves', title: 'Beating Tournament Nerves: The Mental Game of Pool',
    desc: 'Why you play worse in tournaments than in practice, and what to do about it: a pre-shot routine, breathing, staying in the present, and handling a bad rack.',
    body: `
<p>Almost every player shoots worse in a tournament than on a practice table. Your arm tightens, you rush, and easy shots look hard. That's normal, and it gets better with a few simple habits.</p>
<h2>Why nerves hurt your game</h2>
<p>Under pressure, your body speeds up: faster breathing, tighter muscles, quicker decisions. In pool that turns into a shorter, jerky stroke and getting up off the shot too soon. The fix is not to "not be nervous." It is to have a routine that works even when you are.</p>
<h2>Build a pre-shot routine</h2>
<ol>
<li>Stand behind the shot. Decide the shot, the spin and the speed while standing.</li>
<li>Commit. If you're unsure, stand up and start again. Never shoot with a doubt.</li>
<li>Step in along the line and get down.</li>
<li>Take the same number of practice strokes every time.</li>
<li>Pause at the back, then stroke through and stay down.</li>
</ol>
<p>Practice the routine on every shot at home, so in a match it runs on its own.</p>
<h2>Breathe out before you shoot</h2>
<p>A slow breath out as you settle into your stance relaxes your grip and shoulder. Many players breathe out during the last practice stroke. It's simple and it works.</p>
<h2>Play the shot in front of you</h2>
<p>Don't think about the score, the payout or who's watching. Think about the next shot: the line, the speed, where the cue ball goes. If your mind jumps ahead, go back to your routine.</p>
<h2>After a bad rack</h2>
<ul>
<li>Sit down, take a drink, and let it go. The next rack doesn't know you just missed.</li>
<li>Look at what went wrong once (wrong plan, bad stroke, bad luck), then move on.</li>
<li>Don't change your whole game mid-match. Trust the stroke you practiced.</li>
</ul>
<h2>Dealing with distractions</h2>
<p>Noise, slow players and the occasional shark are part of tournament pool. If something bothers you, stand up and restart your routine. If an opponent is breaking the rules or sharking on purpose, calmly ask the director. See our guide to <a href="/guides/pool-tournament-etiquette">tournament etiquette</a>.</p>
<h2>Between matches</h2>
<ul>
<li>Stay warm: hit a few balls if there's a practice table, or at least stretch your arm and shoulder.</li>
<li>Eat something light and drink water. Long days add up.</li>
<li>Watch your next opponent if you can, but don't over-think it.</li>
</ul>
<p>The best cure for nerves is experience. <a href="/this-weekend/">Find a tournament this weekend</a> and play as many as you can. Your first ones are covered in <a href="/guides/first-pool-tournament">what to expect at your first tournament</a>.</p>`
  },
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
<p>Kicks decide a lot of tournament matches, and most players never practice them. Use the diamonds: shooting from a diamond to a diamond on the opposite rail gives you a starting point you can adjust. Warm up your eye first with the free <a href="/play/kick-trainer">kick shot trainer</a>.</p>
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
<p class="tip"><b>Track your progress:</b> log your scores after every session in the free <a href="/play/practice-log">practice log</a> and watch your personal bests climb.</p>
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
  },
  {
    slug: 'how-to-draw-the-cue-ball', title: 'How to Draw the Cue Ball: Backspin Made Simple',
    desc: 'How to draw the cue ball in pool: where to hit, how to stroke through, why draw dies on long shots, and four drills to build a reliable draw shot.',
    body: `
<p>A draw shot makes the cue ball come back toward you after it hits the object ball. It is the first "real" cue ball control most players learn, and it is the shot that turns a straight-in ball into position for the next one. The good news: draw is about a smooth, accurate stroke, not strength.</p>
<h2>What makes the cue ball come back</h2>
<p>When you hit the cue ball below center, it leaves the tip spinning backward. On the way to the object ball, the cloth slowly wears that backspin away. If some backspin is still there when the cue ball hits the object ball, the cue ball stops for an instant and then the spin pulls it back. More backspin at contact means more draw.</p>
${table({ balls: [{ x: 5, y: 2, n: 3 }, { x: 3, y: 2, n: 0 }], paths: [[[3, 2], [4.78, 2]], [[4.78, 2], [2.2, 2]]], labels: [[2.2, 1.6, 'draws back']] }, 'Straight-in draw: hit low, the object ball goes in, the cue ball comes straight back.')}
<h2>Five keys to a good draw shot</h2>
<ul>
<li><b>Hit low, but not too low.</b> Aim about one tip-width below center to start, then go lower as your stroke gets straighter. The very bottom of the ball invites a miscue.</li>
<li><b>Level cue.</b> Keep the butt of the cue as low as the rail allows. Jacking up turns draw into a swerve.</li>
<li><b>Loose grip.</b> A tight grip kills the cue's speed through the ball. Hold it like you'd hold a small bird.</li>
<li><b>Follow through.</b> Let the tip go six inches or more past where the cue ball was. Most failed draw shots are stabs that stop at the ball.</li>
<li><b>Chalk every shot.</b> A low hit with a dry tip is a miscue waiting to happen.</li>
</ul>
<h2>Why your draw dies on long shots</h2>
<p>The farther the cue ball travels, the more backspin the cloth rubs off. On a long shot, a soft stroke may arrive with no spin left, and the cue ball just stops (a stop shot) or even rolls forward. Two fixes: hit a little lower, and add speed so the ball gets there before the spin wears off. A smooth stroke with more speed beats a hard jab every time.</p>
<h2>Draw on a cut shot</h2>
<p>On a cut, draw doesn't send the cue ball straight back. It pulls it backward from the normal "tangent line" path, so it comes off the object ball at a sharper angle toward you. That is how good players open up position on the next ball without going rail to rail.</p>
${table({ balls: [{ x: 6, y: 1.2, n: 5 }, { x: 3.4, y: 2.4, n: 0 }], paths: [[[3.4, 2.4], [5.8, 1.3]], [[5.8, 1.3], [4.6, 3.6]]] }, 'Cut shot with draw: the cue ball comes back off the tangent line, toward the shooter.')}
<h2>Four drills that build a reliable draw</h2>
<ol>
<li><b>Short draw.</b> Object ball one diamond from a corner pocket, cue ball one diamond behind it, straight in. Draw the cue ball back one diamond. Ten in a row.</li>
<li><b>Draw to the line.</b> Same setup, but pick a diamond to draw back to: one, two, then three diamonds. Speed control is the whole game.</li>
<li><b>Longer distance.</b> Move the cue ball back one diamond at a time. Find the distance where your draw stops working, and practice right there.</li>
<li><b>Stop shot.</b> Before you can draw well, you should be able to stop the cue ball dead. Try the <a href="/guides/pool-practice-drills#1-the-stop-shot-ladder">stop-shot ladder</a>.</li>
</ol>
<p>Log your scores in the <a href="/play/practice-log">practice log</a> and watch them climb. For side spin, read <a href="/guides/english-in-pool">English in pool</a>. For aiming the shot itself, read <a href="/guides/how-to-aim-in-pool">how to aim in pool</a>, or warm up with the <a href="/play/aim-trainer">aim trainer</a>.</p>
<h2>Common mistakes</h2>
<ul>
<li><b>Lifting up on the shot.</b> Stay down until the cue ball has hit the object ball.</li>
<li><b>Too much speed on short shots.</b> Close to the object ball, a gentle stroke draws plenty. Hard hits make the cue ball jump.</li>
<li><b>Aiming low but hitting center.</b> Ask a friend to watch where your tip lands, or use a striped ball as the cue ball: the stripe shows the spin.</li>
</ul>
<p>Once your draw is reliable, put it to work: <a href="/tonight/">find a tournament tonight</a>.</p>`
  },
  {
    slug: 'how-to-kick-in-pool', title: 'How to Kick in Pool: Escape Any Snooker with One Rail',
    desc: 'How to aim kick shots in pool: the mirror method, the half-ball-width rule, speed and spin, plus the rules on legal hits and fouls when you are snookered.',
    body: `
<p>A kick shot is when you send the cue ball into a rail before it hits the ball you need. You kick when your opponent leaves you snookered: another ball blocks the straight path. In 9-Ball and 10-Ball, missing the lowest ball is a foul and gives your opponent ball in hand, so kicking well is one of the fastest ways to win more matches.</p>
<h2>The mirror method</h2>
<p>A ball bounces off a cushion at about the same angle it went in. So imagine a mirror image of the table on the other side of the rail. Find where the target ball would sit on that mirror table, the same distance behind the rail as it is in front of it. Aim the cue ball straight at that mirror ball. Where your aim line crosses the rail is your kick point.</p>
${table({ balls: [{ x: 5.6, y: 2.4, n: 7 }, { x: 3.6, y: 2.6, n: 8 }, { x: 1.6, y: 2.8, n: 0 }], paths: [[[1.6, 2.8], [3.76, 0.12]], [[3.76, 0.12], [5.5, 2.27]]] }, 'One-rail kick around a blocker: aim at the mirror image of the target ball behind the rail.')}
<h2>Aim at the right line</h2>
<p>The cue ball's center never reaches the cushion. It bounces off a line half a ball width inside the rail. When you picture the mirror, measure from that line, not from the wood. On a 9-foot table this is a small number, but on a long kick it is the difference between a hit and a miss.</p>
<h2>Speed and spin change the angle</h2>
<ul>
<li><b>Medium speed, center ball.</b> This gives the truest mirror angle. Start here.</li>
<li><b>Hard hits come off shorter.</b> The cushion squashes and the ball comes off at a narrower angle.</li>
<li><b>Running English makes the angle wider; reverse makes it narrower.</b> Use spin only once your plain kicks are reliable.</li>
<li><b>Slow rolls drift long</b> and can roll off line on worn cloth.</li>
</ul>
<h2>The rules when you kick</h2>
<p>Under most rules (WPA, BCA and APA among them), you must hit the correct ball first, and then a ball must reach a rail or go in a pocket. A great kick that touches the ball but leaves everything off the rails is still a foul. That's why many players kick with enough speed to drive the cue ball or object ball to a cushion. House and bar rules vary, so read <a href="/guides/bar-rules-vs-tournament-rules">bar rules vs tournament rules</a> and the <a href="/guides/9-ball-rules">9-Ball rules</a>.</p>
<h2>Kick to hide, not just to hit</h2>
<p>A good kick does more than make contact. Think about where the balls end up. A soft kick that hits the ball and leaves your opponent with no shot is a safety of your own. Learn the ideas in <a href="/guides/safety-play-in-pool">safety play in pool</a>.</p>
<h2>Practice</h2>
<ul>
<li>Play the free <a href="/play/kick-trainer">kick shot trainer</a> to learn the angles by feel. It scores ten kicks a round.</li>
<li>On a real table, run the <a href="/guides/pool-practice-drills#5-the-kick-drill">kick drill</a>: ten kicks at a ball near the corner, count your hits.</li>
<li>For the same geometry with the object ball, try the <a href="/play/bank-trainer">bank shot trainer</a> and read the <a href="/guides/bank-pool-rules">bank pool rules</a>.</li>
</ul>
<p>Most players never practice kicks, so a little work goes a long way. Then test it: <a href="/tonight/">find a tournament tonight</a>.</p>`
  },
  {
    slug: 'pool-vs-billiards-vs-snooker', title: 'Pool vs Billiards vs Snooker: What\'s the Difference?',
    desc: 'Pool, billiards and snooker explained: tables, balls, pockets and how each game is played, plus carom billiards, English billiards and which one to try first.',
    body: `
<p>People use "pool" and "billiards" for the same thing, and snooker looks like pool on a giant table. They are related, but they are different games with different tables, balls and skills. Here is the short version, then the details.</p>
<h2>The short answer</h2>
<ul>
<li><b>Billiards</b> is the family name for all cue sports. In the US, people often say "billiards" when they mean pool.</li>
<li><b>Pool</b> (pocket billiards) is played on a table with six pockets and numbered balls. 8-Ball and 9-Ball are pool games.</li>
<li><b>Snooker</b> is played on a much bigger table with smaller pockets, 15 red balls and six colored balls.</li>
<li><b>Carom billiards</b> has no pockets at all. You score by making the cue ball hit other balls and the cushions.</li>
</ul>
<h2>Side by side</h2>
<div class="seo-tbl" style="overflow-x:auto"><table class="t" style="font-size:14px;min-width:300px"><thead><tr><th></th><th>Pool</th><th>Snooker</th><th>Carom</th></tr></thead><tbody>
<tr><th>Table</th><td>7, 8 or 9 ft</td><td>12 ft</td><td>10 ft (heated slate)</td></tr>
<tr><th>Pockets</th><td>6, fairly wide</td><td>6, small and rounded</td><td>None</td></tr>
<tr><th>Balls</th><td>15 numbered + cue ball</td><td>15 reds, 6 colors + cue ball</td><td>3 (two cue balls and a red)</td></tr>
<tr><th>Ball size</th><td>2¼ in (57 mm)</td><td>About 2 1/16 in (52.5 mm)</td><td>About 2 7/16 in (61.5 mm)</td></tr>
<tr><th>Popular in</th><td>US, worldwide</td><td>UK, China, Asia</td><td>Europe, Asia, South America</td></tr>
<tr><th>Best known game</th><td>8-Ball, 9-Ball</td><td>Snooker</td><td>Three-cushion</td></tr>
</tbody></table></div>
<h2>Pool (pocket billiards)</h2>
<p>Pool is what you'll find in most American bars and pool halls. The table has six pockets and the balls are numbered 1 to 15. In <a href="/guides/8-ball-rules">8-Ball</a> you shoot your group (solids or stripes) and then the 8. In <a href="/guides/9-ball-rules">9-Ball</a> and <a href="/guides/10-ball-rules">10-Ball</a> you must always hit the lowest ball first. Other pool games include <a href="/guides/one-pocket">One Pocket</a>, <a href="/guides/straight-pool-rules">straight pool</a>, <a href="/guides/bank-pool-rules">banks</a> and <a href="/guides/cutthroat-pool-rules">cutthroat</a>.</p>
<p>Bar tables are usually 7 feet; tournaments often use 9-foot tables. See <a href="/guides/pool-table-sizes">pool table sizes</a> for the details.</p>
<h2>Snooker</h2>
<p>Snooker is played on a 12-foot table with smaller balls and tight, rounded pockets, so long pots are much harder than in pool. Players alternate potting a red (1 point) and a color (2 to 7 points: yellow, green, brown, blue, pink, black). When the reds are gone, the colors go down in order. The maximum break is 147. Snooker rewards long, careful break-building and safety play.</p>
<h2>Carom billiards</h2>
<p>Carom tables have no pockets. In three-cushion, the most popular carom game, you score a point when your cue ball hits both other balls and touches at least three cushions before hitting the second ball. It is a game of angles and spin, and the best players see paths around the table that look impossible. If you've played the <a href="/play/kick-trainer">kick shot trainer</a>, you've had a taste of it.</p>
<h2>English billiards</h2>
<p>English billiards uses a snooker-size table and three balls. You score by potting balls, going in-off (the cue ball dropping into a pocket after hitting a ball) and making cannons (caroms). It is older than snooker and still played in the UK and India.</p>
<h2>Which one should you play?</h2>
<p>If you're in the US, start with pool: tables are everywhere, the games are quick, and there are weekly tournaments in almost every town. Learn the basics in <a href="/guides/pool-basics-for-beginners">pool for beginners</a>, take the <a href="/play/which-game">which pool game is yours?</a> quiz, and then <a href="/guides/first-pool-tournament">play your first tournament</a>. The skills carry over: a good stroke and cue ball control help in every cue sport.</p>
<p>Ready to play? <a href="/tonight/">See pool tournaments tonight</a> or <a href="/pool-halls/">find a pool hall near you</a>.</p>`
  },
  {
    slug: 'pool-rules-questions', title: 'Pool Rules Q&A: Scratches, Breaks, the 8-Ball and More',
    desc: 'Quick answers to the pool rules questions players argue about: scratching on the 8, making the 8 on the break, calling shots, ball in hand, jump shots, push outs and more.',
    faq: RULES_QA,
    body: `
<p>Every pool room has an argument about the rules sooner or later. Here are straight answers to the questions players ask most, based on tournament rules (WPA, BCA and APA league rules where they differ). Bar rules vary, so when in doubt, agree before the first break.</p>
${RULES_QA.map(([q, a]) => `<h2>${q}</h2>\n<p>${a}</p>`).join('\n')}
<h2>Full rules for each game</h2>
<p>For the complete rules, read <a href="/guides/8-ball-rules">8-Ball rules</a>, <a href="/guides/9-ball-rules">9-Ball rules</a>, <a href="/guides/10-ball-rules">10-Ball rules</a>, and <a href="/guides/bar-rules-vs-tournament-rules">bar rules vs tournament rules</a>. Then test yourself with the <a href="/tools/pool-rules-quiz">pool rules quiz</a>.</p>
<p>Ready to play by the book? <a href="/tonight/">Find a tournament tonight</a>.</p>`
  },
  {
    slug: 'how-to-hold-a-pool-cue', title: 'How to Hold a Pool Cue: Grip, Bridge and Stance',
    desc: 'How to hold a pool cue the right way: where to grip, how loose to hold it, the open, closed and rail bridges, bridge length, and a stance that keeps your stroke straight.',
    body: `
<p>Most missed shots start before the stroke: a tight grip, a wobbly bridge or a stance that pulls the cue off line. Fix these three things and the same aim makes more balls. Here is how to hold a pool cue, step by step. (Left-handed? Swap left and right.)</p>
<h2>The grip (back hand)</h2>
<ul>
<li><b>Where to hold it:</b> find the cue's balance point (balance it on one finger), then move your hand 3 to 6 inches behind it. When the tip is at the cue ball, your forearm should hang straight down, at 90 degrees to the cue.</li>
<li><b>How tight:</b> loose. Cradle the cue with your thumb and first two or three fingers, with a small gap between the cue and your palm. A tight fist makes the tip steer and kills speed.</li>
<li><b>Wrist:</b> let it hang straight, not cocked in or out. A wrist turned sideways pushes the cue sideways.</li>
</ul>
<h2>The bridge (front hand)</h2>
<p>The bridge is the guide the cue slides through. It has to be steady and let the cue move perfectly straight.</p>
<ul>
<li><b>Open bridge:</b> lay your hand flat on the cloth, spread the fingers, then raise the knuckles a little. Press your thumb against the base of your first finger to make a V and rest the cue in it. Easiest to learn, and best for soft shots and seeing the line.</li>
<li><b>Closed (loop) bridge:</b> curl your first finger over the cue to make a loop, with the cue resting against your thumb and middle finger. It locks the cue in place, so it is better for firm shots, draw and the break.</li>
<li><b>Rail bridge:</b> when the cue ball is near the cushion, rest the cue on the rail and guide it between your first and second fingers, or slide it along the rail under your fingers.</li>
<li><b>Over a ball:</b> raise your hand on your fingertips (a "tripod") so the cue clears the blocking ball. Shorten the stroke and keep it smooth.</li>
<li><b>Mechanical bridge (the rake):</b> for shots you can't reach. Set it flat on the table a few inches from the cue ball and stroke with your hand at shoulder height, elbow out.</li>
</ul>
<h2>How long should your bridge be?</h2>
<p>Keep your bridge hand about 6 to 9 inches from the cue ball on normal shots. Go a little longer for the break and power shots, and shorter for delicate shots and when the cue ball is close to another ball. Too long and the tip wanders; too short and you cannot follow through.</p>
<h2>The stance</h2>
<ul>
<li><b>Feet:</b> step into the shot line with your back foot right on it (right foot for right-handers). Put your front foot forward and to the side, about shoulder width apart, pointing toward the shot.</li>
<li><b>Body:</b> bend at the waist so your chin is a few inches above the cue. Lower is more accurate; most good players get their chin close to the cue.</li>
<li><b>Head:</b> keep it still and over the cue. Your eyes should look straight down the line, like sighting a rifle.</li>
<li><b>Balance:</b> you should be stable enough that someone could tap your shoulder without you wobbling. Under tournament rules you must keep at least one foot on the floor.</li>
</ul>
<h2>Check yourself in 2 minutes</h2>
<ol>
<li><b>The mirror check:</b> get down on a shot facing a mirror or a phone camera. The cue, your forearm and your eyes should all line up.</li>
<li><b>The straight-stroke test:</b> shoot the cue ball straight up the table over the second diamond. It should come straight back to your tip. If it drifts, your grip or stance is pulling it.</li>
<li><b>The bottle drill:</b> stroke into the neck of an empty bottle lying on the table without touching the sides.</li>
</ol>
<p>Next, learn to aim with <a href="/guides/how-to-aim-in-pool">how to aim in pool</a>, put spin on the ball in <a href="/guides/english-in-pool">English in pool</a>, and practice with the <a href="/guides/pool-practice-drills">practice drills</a>. Start from the beginning in <a href="/guides/pool-basics-for-beginners">pool for beginners</a>.</p>
<p>Ready to try it? <a href="/tonight/">Find a tournament tonight</a>.</p>`
  },
  {
    slug: 'pool-cue-tips', title: 'Pool Cue Tips Explained: Soft vs Hard, Size, Shape and When to Replace',
    desc: 'Everything about pool cue tips: soft, medium and hard tips, layered vs solid leather, tip sizes, the right shape, how to keep a tip in shape, and when to replace it.',
    body: `
<p>The tip is the only part of the cue that touches the cue ball, so it changes everything: how much spin you get, how often you miscue, and how the cue feels. Here is what you need to know.</p>
<h2>Soft, medium or hard?</h2>
<ul>
<li><b>Soft tips</b> grip the cue ball longer, so spin comes easier and the hit feels muted. They flatten and wear out faster and need shaping more often.</li>
<li><b>Medium tips</b> are the most popular: a good mix of spin, feel and life. If you are not sure, start here.</li>
<li><b>Hard tips</b> keep their shape for a long time and give a crisp, solid hit, but they need good chalk and a good stroke to avoid miscues. Very hard (phenolic) tips are used on break and jump cues, not playing cues.</li>
</ul>
<h2>Layered or solid leather?</h2>
<p>Layered tips are made of thin layers of leather glued together. They are more consistent from tip to tip and hold their shape longer, so most serious players use them. Solid (one-piece) tips are cheaper and fine for house and beginner cues.</p>
<h2>Tip size</h2>
<p>Most playing cues use 12 to 13 mm tips; 13 mm is the most common. A smaller tip can feel more precise for spin, while a bigger tip feels more forgiving. The tip must match the ferrule (the white collar at the end of the shaft): a new tip is trimmed flush to it.</p>
<h2>The right shape</h2>
<p>Keep the tip rounded like the edge of a nickel or a dime. A nickel shape is a good all-around curve; a dime shape is a little rounder and some players like it for more spin. A flat tip miscues on spin shots, so reshape it when it flattens.</p>
<h2>Keeping a tip in shape</h2>
<ul>
<li><b>Chalk before every shot.</b> Brush the chalk on lightly; don't grind the tip into the cube.</li>
<li><b>Scuff it now and then</b> with a tip tool so it holds chalk. Don't overdo it: every scuff takes leather off.</li>
<li><b>Shape it when it flattens</b> with a shaper, working around the edge.</li>
<li><b>Keep the cue in a case</b> and out of hot cars. Heat and moisture loosen the glue.</li>
</ul>
<h2>When to replace your tip</h2>
<ul>
<li>It is thinner than about 3 mm, or you can see the ferrule through the side.</li>
<li>It mushrooms (spreads wider than the ferrule) and won't stay trimmed.</li>
<li>It won't hold chalk or keeps miscuing even after scuffing.</li>
<li>It is coming loose or has a crack.</li>
</ul>
<p>Most pool halls and cue repair shops can replace a tip while you wait. Some players do it themselves with a tip kit, glue and a clamp, but a pro job is cheap and gets the shape and trim right.</p>
<p>More cue care in <a href="/guides/pool-cue-care">how to take care of your pool cue</a>, picking a new cue in <a href="/guides/how-to-choose-a-pool-cue">how to choose a pool cue</a>, and spin shots in <a href="/guides/english-in-pool">English in pool</a>.</p>`
  },
  {
    slug: 'how-to-bank-in-pool', title: 'How to Bank in Pool: The Mirror Method and Simple Diamond Aiming',
    desc: 'How to make bank shots in pool: the mirror method, using the diamonds, why speed and spin change the angle, cross-side and cross-corner banks, and how to practice.',
    body: `
<p>A bank shot sends the object ball into a cushion and then into a pocket. Banks win games when there is no direct shot, and good bankers make them look easy. The good news: the geometry is simple, and the rest is feel you build with practice.</p>
<h2>The mirror method</h2>
<p>A ball leaves a cushion at about the same angle it went in. So picture the table reflected on the other side of the rail you are banking off: a mirror table. Find where your target pocket would be on that mirror table and aim the object ball straight at it. The point where that line crosses the rail is your bank spot.</p>
${table({ balls: [{ x: 4, y: 2.6, n: 6 }, { x: 3.52, y: 3.36, n: 0 }], paths: [[[3.52, 3.36], [3.84, 2.85]], [[4, 2.6], [5.56, 0.12]], [[5.56, 0.12], [7.85, 3.85]]], labels: [[5.56, 0.6, 'bank spot']] }, 'Bank off the top rail: aim the 6 at the corner pocket on the mirror table and it comes back into the far corner.')}
<p>The ball's center never reaches the cushion; it bounces off a line about half a ball inside the rail. Measure your mirror from that line, not from the wood.</p>
<h2>Using the diamonds</h2>
<p>The diamonds on the rails are evenly spaced, so they make the mirror easy to measure. For a straight cross-side bank (the object ball across from a side pocket), aim at the diamond halfway between the ball and the pocket on the far rail. For a cross-corner bank, count the diamonds from the ball to the corner and aim at the halfway point on the long rail.</p>
<h2>Speed and spin change the angle</h2>
<ul>
<li><b>Hit it firmly and the ball comes off shorter</b> (a narrower angle), because the cushion squashes and the ball slides.</li>
<li><b>Hit it softly and it runs a little longer.</b> Most players aim slightly "long" on soft banks and "short" on hard ones.</li>
<li><b>Cut angle matters:</b> if you cut the object ball into the rail, it picks up spin that pushes it the opposite way off the cushion. Full hits bank the truest.</li>
<li><b>Keep the cue ball center</b> while you learn. Spin on the cue ball changes the object ball's path too.</li>
</ul>
<h2>Watch out for the kiss</h2>
<p>On short banks, the cue ball can follow the object ball and hit it again on the way back off the rail (a "kiss"). If the cue ball is in the way of the rebound, hit with a little draw or stun, or cut the ball slightly so the cue ball goes another way.</p>
<h2>How to practice</h2>
<ol>
<li>Put an object ball in the middle of the table and bank it cross-side ten times. Count your makes.</li>
<li>Move the ball one diamond at a time and repeat. Notice where you miss long or short.</li>
<li>Try the same shot soft, medium and firm, and see how the angle changes.</li>
</ol>
<p>Train your eye for free with the <a href="/play/bank-trainer">bank shot trainer</a>, then try the <a href="/trick-shots/cross-corner-bank">cross-corner bank</a> trick shot. For banks with the cue ball, read <a href="/guides/how-to-kick-in-pool">how to kick in pool</a>. Love banks? There is a whole game of them: <a href="/guides/bank-pool-rules">bank pool</a>.</p>`
  },
  {
    slug: 'pool-ball-colors-and-numbers', title: 'Pool Ball Colors and Numbers: Solids, Stripes and the 8',
    desc: 'What color is each pool ball? The standard colors of balls 1 to 15, solids vs stripes, the cue ball, and how the numbers are used in 8-Ball, 9-Ball and other games.',
    body: `
<p>A standard pool set has 16 balls: a white cue ball and 15 numbered object balls. The 1 through 8 are solid colors, and the 9 through 15 are white with a colored stripe. Each stripe uses the same color as the solid eight numbers below it.</p>
${table({ balls: [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => ({ x: 0.6 + i * 0.95, y: 1.3, n })).concat([9, 10, 11, 12, 13, 14, 15].map((n, i) => ({ x: 0.6 + i * 0.95, y: 2.7, n }))).concat([{ x: 7.25, y: 2.7, n: 0 }]) }, 'Top row: the solids, 1 to 8. Bottom row: the stripes, 9 to 15, and the cue ball.')}
<h2>The colors, ball by ball</h2>
<div class="seo-tbl" style="overflow-x:auto"><table class="t"><thead><tr><th>Color</th><th>Solid</th><th>Stripe</th></tr></thead><tbody>
<tr><td>Yellow</td><td>1</td><td>9</td></tr>
<tr><td>Blue</td><td>2</td><td>10</td></tr>
<tr><td>Red</td><td>3</td><td>11</td></tr>
<tr><td>Purple</td><td>4</td><td>12</td></tr>
<tr><td>Orange</td><td>5</td><td>13</td></tr>
<tr><td>Green</td><td>6</td><td>14</td></tr>
<tr><td>Maroon (burgundy)</td><td>7</td><td>15</td></tr>
<tr><td>Black</td><td>8</td><td>none</td></tr>
</tbody></table></div>
<p>A quick way to remember them: the stripe is always the solid's number plus eight. The 3 is red, so the 11 is red-striped. Some sets use slightly different shades (a pink 4, a brown 7), and TV and pro sets sometimes use brighter colors so they show up on camera.</p>
<h2>The cue ball</h2>
<p>The cue ball is plain white. Some are marked with a red or blue dot or logo so players and viewers can see spin. Coin-operated bar tables sometimes use a slightly larger or heavier cue ball so the table can send it back to the player; it plays a little differently from a standard one.</p>
<h2>How the numbers are used</h2>
<ul>
<li><b>8-Ball:</b> one player takes the solids (1 to 7), the other the stripes (9 to 15), and the 8 is last. See <a href="/guides/8-ball-rules">8-Ball rules</a>.</li>
<li><b>9-Ball and 10-Ball:</b> only balls 1 to 9 (or 1 to 10) are used, and you must hit the lowest-numbered ball first. See <a href="/guides/9-ball-rules">9-Ball rules</a> and <a href="/guides/10-ball-rules">10-Ball rules</a>.</li>
<li><b>Straight pool and One Pocket:</b> the numbers don't matter; every ball counts the same.</li>
<li><b>Cutthroat:</b> three players each own a group: 1 to 5, 6 to 10 and 11 to 15. See <a href="/guides/cutthroat-pool-rules">cutthroat rules</a>.</li>
</ul>
<p>Setting up a game? Read <a href="/guides/how-to-rack-pool-balls">how to rack pool balls</a> for every game. Need a new set for a home table? See the <a href="/gear/home-pool-table">home pool table buying guide</a>.</p>`
  },
  {
    slug: 'pool-games-to-play', title: '14 Pool Games to Play: With Friends, Alone or at a Party',
    desc: 'The best pool games beyond 8-Ball: 9-Ball, 10-Ball, cutthroat for three players, rotation, 3-Ball, Kelly pool for groups, one pocket, bank pool, straight pool and more, with how each one works.',
    body: `
<p>8-Ball is just the start. Here are 14 pool games worth knowing, grouped by how many people are playing. Each one has a quick "how it works" so you can rack up and play tonight.</p>
<h2>Two players: the classics</h2>
<ul>
<li><b>8-Ball.</b> One player takes solids, the other stripes. Clear your group, then make the 8 to win. The most played game in the world. <a href="/guides/8-ball-rules">Full rules</a>.</li>
<li><b>Last Pocket 8-Ball.</b> A popular bar version: the 8 must go in the same pocket as your last ball of your group. It makes every rack harder to finish.</li>
<li><b>9-Ball.</b> Balls 1 to 9. Always hit the lowest ball first; whoever makes the 9 wins, even on a combination. Fast, and the most common tournament game. <a href="/guides/9-ball-rules">Full rules</a>.</li>
<li><b>10-Ball.</b> Like 9-Ball with ten balls and called shots, so there is less luck. <a href="/guides/10-ball-rules">Full rules</a>.</li>
<li><b>7-Ball.</b> A quicker version of 9-Ball with only the 1 through 7. Great when you want short racks.</li>
<li><b>Straight Pool (14.1).</b> Call any ball in any pocket, one point each, and keep shooting until you miss. Re-rack 14 balls and keep going. Games go to 100 or more. <a href="/guides/straight-pool-rules">Full rules</a>.</li>
<li><b>One Pocket.</b> Each player gets one corner pocket at the foot of the table, and only balls in your pocket count. First to 8 wins. A chess match on a pool table. <a href="/guides/one-pocket">How it works</a>.</li>
<li><b>Bank Pool.</b> Every ball must be banked off at least one cushion and called. Usually first to 8 in a full rack. <a href="/guides/bank-pool-rules">Full rules</a>.</li>
<li><b>Rotation (61).</b> Hit the lowest ball first, like 9-Ball, but every ball you make is worth its number in points. There are 120 points on the table, so 61 wins.</li>
</ul>
<h2>Three to five players</h2>
<ul>
<li><b>Cutthroat.</b> Three players each own a group of five balls (1 to 5, 6 to 10, 11 to 15). Sink your opponents' balls; the last player with a ball left wins. The best game for three. <a href="/guides/cutthroat-pool-rules">Full rules</a>.</li>
<li><b>3-Ball.</b> Rack just three balls and try to pocket all three in as few shots as possible, break included. Everyone takes a turn and the lowest score wins. Quick, simple and very competitive.</li>
</ul>
<h2>Groups and parties</h2>
<ul>
<li><b>Kelly Pool.</b> Each player secretly draws a number from 1 to 15. Shoot the balls in rotation; whoever legally pockets the ball that matches their secret number wins. Great for a crowd, because anyone can win.</li>
<li><b>Killer.</b> Every player starts with three lives and takes one shot per turn. Make a ball and stay alive; miss and lose a life. Last player standing wins. Big groups take turns around the table, so nobody waits long.</li>
<li><b>Scotch Doubles.</b> Two-player teams take turns shooting: partner A, then partner B, every shot. Perfect for couples and mixed teams. <a href="/guides/scotch-doubles">How it works</a>.</li>
</ul>
<h2>Playing alone</h2>
<p><b>Play the ghost:</b> break, take ball in hand, and try to run the rack. If you miss, the "ghost" wins that rack. Race to 5 and track your score over time. It is in our <a href="/guides/pool-practice-drills">practice drills</a>, and you can log your results in the free <a href="/play/practice-log">practice log</a>. Between sessions, play our <a href="/play/">free pool games</a> online.</p>
<p>Not sure which game fits you? Take the <a href="/play/which-game">which pool game is yours?</a> quiz. Then find a tournament for it: <a href="/tonight/">tonight</a> or <a href="/this-weekend/">this weekend</a>.</p>`
  },
  {
    slug: 'best-pool-movies', title: 'The Best Pool Movies of All Time: From The Hustler to Poolhall Junkies',
    desc: 'The best movies about pool and pool hustlers: The Hustler, The Color of Money, Poolhall Junkies, The Baltimore Bullet, Kiss Shot, Turn the River and Stickmen, and what each gets right about the game.',
    body: `
<p>Pool has given Hollywood some of its best characters: hustlers, road players and old pros with one last big match in them. Here are the pool movies every player should see, oldest first. Grab some friends and make it a movie night.</p>
<h2>The Hustler (1961)</h2>
<p>Paul Newman plays "Fast Eddie" Felson, a young hustler who wants to beat the legendary Minnesota Fats (Jackie Gleason). It is dark, smoky and serious, and the long straight pool marathon is still the best match ever put on film. Many people say this movie filled pool halls across America. <a href="https://www.amazon.com/s?k=The+Hustler+1961" target="_blank" rel="sponsored nofollow noopener">Find it on Amazon</a>.</p>
<h2>The Baltimore Bullet (1980)</h2>
<p>James Coburn is an aging road player who teams up with a young partner to set up one huge game. It is lighter than The Hustler, and it features cameos from real pool champions of the era. <a href="https://www.amazon.com/s?k=The+Baltimore+Bullet" target="_blank" rel="sponsored nofollow noopener">Find it on Amazon</a>.</p>
<h2>The Color of Money (1986)</h2>
<p>Martin Scorsese's sequel to The Hustler. Paul Newman returns as an older Fast Eddie, now staking a cocky young player (Tom Cruise) on the 9-Ball road. Newman won the Oscar for it. The 9-Ball tournament scenes are a fun look at the game in the eighties. <a href="https://www.amazon.com/s?k=The+Color+of+Money+1986" target="_blank" rel="sponsored nofollow noopener">Find it on Amazon</a>.</p>
<h2>Kiss Shot (1989)</h2>
<p>A made-for-TV movie starring Whoopi Goldberg as a single mom who goes back to hustling pool to keep her house. Warm, funny and an easy watch with the family. <a href="https://www.amazon.com/s?k=Kiss+Shot+Whoopi+Goldberg" target="_blank" rel="sponsored nofollow noopener">Find it on Amazon</a>.</p>
<h2>Stickmen (2001)</h2>
<p>A comedy from New Zealand about three friends in a pub pool tournament with a mysterious big-money prize. Quirky, quick and full of pub pool. <a href="https://www.amazon.com/s?k=Stickmen+2001+movie" target="_blank" rel="sponsored nofollow noopener">Find it on Amazon</a>.</p>
<h2>Poolhall Junkies (2002)</h2>
<p>A hustler tries to go straight and gets pulled back in for one more big game. Christopher Walken steals every scene, and the trick shots and money games make it a favorite with players. <a href="https://www.amazon.com/s?k=Poolhall+Junkies" target="_blank" rel="sponsored nofollow noopener">Find it on Amazon</a>.</p>
<h2>Turn the River (2007)</h2>
<p>Famke Janssen plays a hustler who plays high-stakes games to win back her son. A quiet, tense drama with some of the most realistic pool playing in any movie. <a href="https://www.amazon.com/s?k=Turn+the+River+2007" target="_blank" rel="sponsored nofollow noopener">Find it on Amazon</a>.</p>
<h2>What the movies get right (and wrong)</h2>
<ul>
<li><b>Right:</b> the road-player culture, staking, and how much of a money game is about nerve. Read <a href="/guides/money-game-spots">money games and spots</a> to learn how real games are matched.</li>
<li><b>Wrong:</b> nobody makes every shot, and real hustles are slower and quieter than Hollywood's. Real tournaments are friendlier, too: here's <a href="/guides/first-pool-tournament">what to expect at your first one</a>.</li>
</ul>
<p>Inspired? Learn a <a href="/trick-shots/">trick shot</a>, play the <a href="/play/">free pool games</a>, or <a href="/tonight/">find a tournament tonight</a>.</p>`
  },
  {
    slug: 'how-to-clean-a-pool-table', title: 'How to Clean a Pool Table: Cloth, Rails, Pockets and Balls',
    desc: 'How to clean a pool table the right way: brushing and vacuuming the cloth, removing chalk and spills, cleaning the rails, pockets and balls, and how often to do it.',
    body: `
<p>A clean table plays faster and truer, and the cloth lasts years longer. Chalk dust and dirt act like sandpaper on the cloth and slow the balls down. Here is how to clean every part of a pool table.</p>
<h2>Brush the cloth</h2>
<ol>
<li>Use a soft brush made for billiard cloth, never a stiff household broom.</li>
<li>Brush in straight, short strokes from the foot of the table toward the head, the way the cloth's nap runs. Don't scrub in circles: it pills the cloth.</li>
<li>Brush the chalk out from under the cushion edges first, then the bed.</li>
<li>Sweep the dust into a pocket or onto a dustpan at the end.</li>
</ol>
<h2>Vacuum (carefully)</h2>
<p>A handheld vacuum with a brush attachment picks up what the brush loosens. Use low suction and keep the nozzle just above the cloth; strong suction can stretch the cloth and pull it loose from the slate.</p>
<h2>Spills and stains</h2>
<ul>
<li><b>Blot, don't rub.</b> Soak up a spill right away with a dry cloth or paper towel.</li>
<li>For a sticky spill, dab with a cloth barely dampened with cold water and a drop of mild dish soap, then blot dry. Never soak the cloth: water can warp the slate backing and leave rings.</li>
<li>Chalk smudges usually brush out. Leave stubborn stains alone rather than scrubbing the cloth bald.</li>
</ul>
<h2>Rails, pockets and the frame</h2>
<p>Wipe the wooden rails and frame with a soft, slightly damp cloth and dry them. Use wood polish only on the wood, never near the cloth. Empty the pockets now and then and wipe the leather or rubber with a dry cloth.</p>
<h2>Clean the balls</h2>
<p>Dirty balls drag chalk around and stick together on contact. Wash them in warm water with a little mild soap, dry them right away, and buff them with a soft cloth. Ball cleaner and polish make them look and roll like new. Never use a dishwasher.</p>
<h2>How often?</h2>
<ul>
<li><b>After every session:</b> a quick brush.</li>
<li><b>Weekly (home table):</b> brush and light vacuum; wipe the rails.</li>
<li><b>Monthly:</b> clean the balls and empty the pockets.</li>
<li><b>Always:</b> cover the table when it is not being used, and keep drinks off the rails.</li>
</ul>
<p>Setting up a game room? See our <a href="/gear/home-pool-table">home pool table buying guide</a> and <a href="/gear/game-room-setup">game room setup guide</a>. Is your table rolling off? Read <a href="/guides/how-to-level-a-pool-table">how to level a pool table</a>.</p>`
  },
  {
    slug: 'how-to-level-a-pool-table', title: 'How to Level a Pool Table (and Check If It Rolls Off)',
    desc: 'How to check if a pool table is level and how to fix it: the rolling-ball test, using a machinist level, adjusting the legs and shims, and when to call a pro for a slate table.',
    body: `
<p>A table that is not level makes slow shots roll off line, and no amount of skill fixes that. The good news: checking is easy, and small fixes are often simple. Here is how.</p>
<h2>Test it: the rolling ball</h2>
<ol>
<li>Roll a ball very slowly down the middle of the table from the head rail toward the foot rail, then back.</li>
<li>Roll balls slowly across the table at the head, the middle and the foot.</li>
<li>If a slow ball curves the same way every time, the table leans that way. A ball that wanders differently in different spots usually means the slate or cloth is uneven, not just the legs.</li>
</ol>
<h2>Measure it with a level</h2>
<p>Use a good machinist level (a cheap bubble level is not precise enough). Lay it on the cloth across the width and along the length, near each corner and in the middle. Note which way and how much each spot is off.</p>
<h2>Fix it</h2>
<ul>
<li><b>Adjustable legs:</b> many tables have leveling feet or screws at the bottom of each leg. Raise the low side a little at a time, re-checking with the level after each change.</li>
<li><b>Shims:</b> on tables without adjustable feet, slide thin hardwood or plastic shims under the low legs. Work in small amounts.</li>
<li><b>Check the floor:</b> a sagging floor or a thick rug under one end is often the real problem. On carpet, legs can sink over time, so re-check after a week.</li>
<li><b>Work end to end, then side to side:</b> level the length first, then the width, then check the length again.</li>
</ul>
<h2>When to call a pro</h2>
<p>Slate tables are leveled at the slate itself, using shims between the slate and the frame, and the seams between the slate pieces are filled and leveled too. If the slate is off, the seams are raised, or the table was just moved, a table mechanic can level it properly, usually while recovering or tightening the cloth. Non-slate tables that sag in the middle usually can't be fixed by leveling.</p>
<p>Keep it playing well with <a href="/guides/how-to-clean-a-pool-table">how to clean a pool table</a>. Shopping? See the <a href="/gear/home-pool-table">home pool table buying guide</a>.</p>`
  },
  {
    slug: 'history-of-pool', title: 'The History of Pool: From Lawn Game to Bar Table, and the Players Who Made It',
    desc: 'A short history of pool and billiards: its roots in a lawn game, why the cloth is green, where the name pool came from, the leather tip and chalk, and legends from Willie Mosconi to Efren Reyes.',
    body: `
<p>Pool has been played for hundreds of years, by kings, hustlers and league players in every bar in America. Here is the short version of how the game got here, and the players who made it famous.</p>
<h2>A lawn game moves indoors</h2>
<p>Billiards grew out of a lawn game played in Europe in the 1400s, a bit like croquet, where players pushed balls with sticks. When it moved indoors onto a table, the table was covered in green cloth to look like grass. That is why pool tables are still green today.</p>
<h2>From a mace to a cue</h2>
<p>Early players pushed the ball with a "mace," a stick with a heavy head. Players started turning it around to use the thin end, or "queue," on hard shots, and by the late 1600s the cue was its own tool. In the early 1800s the leather tip and chalk came along, which let players put spin on the cue ball. Americans still call that spin "English."</p>
<h2>Why it is called pool</h2>
<p>In the 1800s, American "poolrooms" were places where people pooled their bets on horse races, and billiard tables kept customers busy between races. The name stuck to the game, and pocket billiards became "pool."</p>
<h2>The American game</h2>
<p>Brunswick began building tables in the 1840s and became the biggest name in American tables. Straight pool was the championship game for most of the 1900s, and 9-Ball grew into the fast, TV-friendly game most tournaments play today. Two movies, The Hustler (1961) and The Color of Money (1986), each set off a pool boom across the country. See our <a href="/guides/best-pool-movies">best pool movies</a>.</p>
<h2>Legends of the game</h2>
<ul>
<li><b>Willie Mosconi</b> won the world straight pool title many times between the 1940s and 1950s and set the famous record run of 526 balls in a row in 1954.</li>
<li><b>Minnesota Fats</b> (Rudolf Wanderone) was the most famous hustler and showman in pool, and a big reason people know the game.</li>
<li><b>Efren Reyes</b> of the Philippines, "The Magician," is known for impossible shots and is often called the greatest player ever.</li>
<li><b>Earl Strickland</b>, <b>Johnny Archer</b> and <b>Shane Van Boening</b> are among the top American 9-Ball champions of the modern era.</li>
<li><b>Jeanette Lee</b>, "The Black Widow," and <b>Allison Fisher</b> brought huge audiences to women's pool in the 1990s and 2000s.</li>
</ul>
<h2>Pool today</h2>
<p>Today pool is played in leagues and tournaments in nearly every town, with ratings like Fargo matching players fairly (see <a href="/guides/fargo-ratings-handicaps">Fargo ratings</a>). The big pro events are streamed online; see the <a href="/guides/major-pool-events-calendar">major pool events calendar</a>. And every week, thousands of local tournaments keep the game going.</p>
<p>Be part of it: <a href="/tonight/">find a pool tournament tonight</a>.</p>`
  }
];
