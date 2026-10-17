// Original articles for players and tournament directors (/guides/...), plus the About and Contact pages.
// Plain server-rendered HTML so search engines and ad reviewers read the full text.
import { layout, shareStrip } from './seo.js';
import { MORE_GUIDES } from './guides-more.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EMAIL = 'billiardactiontime@gmail.com';

// Which guide to suggest on a tournament page, by game.
// (the game -> guide map lives in seo.js so seo.js does not need to import this file)

const BASE_GUIDES = [
  {
    slug: 'first-pool-tournament', title: 'Your First Pool Tournament: What to Expect and What to Bring',
    desc: 'Never played in a pool tournament? How sign-up works, what the bracket means, how races and handicaps work, and what to bring on the night.',
    body: `
<p>Walking into your first pool tournament can feel like everyone else already knows the rules. They don't — every room runs things a little differently, and most players are happy to help a newcomer. Here is what a typical bar or pool hall tournament looks like, start to finish.</p>
<h2>Before you go</h2>
<ul>
<li><b>Check the start time and sign-up cutoff.</b> Most weekly tournaments close sign-ups 15–30 minutes before the start. If you are late, you are usually out.</li>
<li><b>Bring cash.</b> Entry fees for weekly events usually run $10–$30 and are often cash only. Some rooms add a small "greens fee" for table time.</li>
<li><b>Ask about handicaps.</b> Many weekly events are handicapped, either by the room's own system or by FargoRate. If you are new, tell the director so you get a fair starting rating.</li>
</ul>
<h2>What to bring</h2>
<ul>
<li>Your own cue if you have one (house cues are fine for your first time).</li>
<li>A small piece of chalk and a glove if you use one.</li>
<li>Cash for the entry, a drink, and tipping the director if you cash.</li>
</ul>
<h2>How the night runs</h2>
<p>After sign-ups close, the director draws a bracket — most local events use a <a href="/guides/double-elimination-brackets">double-elimination bracket</a>, so you are not out until you lose twice. Each match is a "race," for example race to 3, meaning the first player to win 3 games wins the match. In a handicapped event, a stronger player might have to win 5 games while you only need 3.</p>
<p>Listen for your name. The director will call matches and assign tables. Play your match, report the winner to the desk, and wait to be called again. On a busy night there can be long waits — that is normal.</p>
<h2>Etiquette that gets you invited back</h2>
<ul>
<li>Call your own fouls. Nobody respects a player who won't.</li>
<li>Stay quiet and still while your opponent is shooting.</li>
<li>Ask before you touch a ball, and agree on a referee or a neutral watcher for close hits.</li>
<li>Shake hands before and after, win or lose.</li>
</ul>
<h2>Find a tournament</h2>
<p>Ready to play? See <a href="/this-weekend/">this weekend's tournaments</a> or <a href="/tournaments/">browse by state</a>.</p>`
  },
  {
    slug: 'how-to-run-a-pool-tournament', title: 'How to Run a Pool Tournament: A Step-by-Step Guide for Directors',
    desc: 'Planning a weekly or one-off pool tournament? Format, entry fees, races, brackets, payouts and promotion, step by step.',
    body: `
<p>A well-run tournament fills tables on slow nights, brings regulars back every week and builds a room's reputation. A badly run one empties the room by 11 p.m. The difference is mostly planning. Here is a checklist that works for weekly bar tournaments and bigger one-day events alike.</p>
<h2>1. Pick the game and format</h2>
<p>8-Ball is the easiest draw for a bar crowd. 9-Ball and 10-Ball attract stronger players. Most local events use <a href="/guides/double-elimination-brackets">double elimination</a>, which guarantees everyone at least two matches. Single elimination is faster but players who drive in and lose once go home unhappy.</p>
<h2>2. Decide handicaps</h2>
<p>Open events reward the best players; handicapped events keep newer players coming back. FargoRate is the most common system — see <a href="/guides/fargo-ratings-handicaps">how Fargo handicaps work</a>. Whatever you choose, post it before sign-ups so nobody feels surprised.</p>
<h2>3. Set races and estimate the time</h2>
<p>Short races (race to 2 or 3) keep a 32-player bar event to about four hours. A useful rule of thumb: count on 15–20 minutes per game of 8-Ball on a bar table, multiply by the games in a race, and remember a double-elimination bracket needs roughly twice as many matches as there are players.</p>
<h2>4. Entry fee, added money and payouts</h2>
<p>Be clear about what goes where: entry, greens fee for the room, and any added money. Announce the payout plan before play starts. Our <a href="/guides/pool-tournament-payouts">payout guide</a> has a simple chart by field size.</p>
<h2>5. Run the desk</h2>
<ul>
<li>Draw the bracket in the open, or use an online bracket so players can follow along.</li>
<li>Call matches promptly and assign tables in order.</li>
<li>Have one clear rule set and one person who makes rulings.</li>
</ul>
<h2>6. Promote it</h2>
<p>Post the event on the room's social pages and in local pool groups at least a week ahead, and again the day before. <a href="/post">List it free on Billiard Action Time</a> — it gets its own page and a share graphic sized for Facebook and Instagram, and it shows up on your state and city pages.</p>
<h2>7. Want a Calcutta?</h2>
<p>For bigger events, a <a href="/guides/calcutta-auction-explained">Calcutta auction</a> adds excitement. Our free <a href="/auctions">Calcutta tool</a> handles bidding and payouts from players' phones. Check your local laws first.</p>`
  },
  {
    slug: 'double-elimination-brackets', title: 'Double-Elimination Brackets Explained (With Byes and the "True Double" Final)',
    desc: 'How double-elimination pool brackets work: the winners and losers sides, byes for uneven fields, how many matches to expect, and the true double final.',
    body: `
<p>Most pool tournaments use a double-elimination bracket: you are out only after your second loss. It is the fairest common format for a one-day event, because one bad roll does not send anyone home.</p>
<h2>The two sides</h2>
<p>Everyone starts on the <b>winners side</b>. Lose a match and you drop to the <b>losers side</b> (also called the "one-loss side"). Lose again on the losers side and you are out. The last player on each side meets in the final.</p>
<p>Need one to print? Grab a free <a href="/tools/brackets/">printable double-elimination bracket</a> for 8, 16, 32 or 64 players.</p>
<h2>Byes</h2>
<p>Brackets work in powers of two: 8, 16, 32, 64, 128. If 21 players sign up, the director uses a 32-player bracket and gives 11 first-round "byes" — those players advance without playing. Byes should be spread through the bracket, not bunched at the top.</p>
<h2>How many matches?</h2>
<p>For a field of <i>N</i> players, a double-elimination bracket needs <b>2N − 2</b> matches, plus one more if the final goes to a second set. A 32-player event is about 62–63 matches. Divide by the number of tables to estimate how many "rounds" of play you need.</p>
<h2>The final: "true double" or single set?</h2>
<p>The winners-side champion has not lost yet. In a <b>true double</b> final, if the losers-side player wins the first set, both players now have one loss and they play a second set to decide it. Some directors play a single, longer race instead to save time. Either is fine — just announce it before play starts.</p>
<h2>Seeding and redraws</h2>
<p>Most weekly events draw names randomly. Bigger events sometimes seed the top players so they do not meet early. When players drop to the losers side, a good bracket crosses them over so the same two players do not meet twice in a row.</p>
<p>Running an event? See our <a href="/guides/how-to-run-a-pool-tournament">director's guide</a> and <a href="/guides/pool-tournament-payouts">payout chart</a>.</p>`
  },
  {
    slug: 'pool-tournament-payouts', title: 'Pool Tournament Payouts: How Many Places to Pay and How to Split the Pot',
    desc: 'A simple payout chart for pool tournaments by number of players, plus how added money, greens fees and ties are usually handled.',
    body: `
<p>Nothing causes more arguments at the end of the night than a payout nobody explained. The fix is simple: decide the payout before the first break and post it at the desk. Here is a common approach that most players find fair.</p>
<h2>How many places to pay</h2>
<p>A popular rule of thumb is to pay about <b>one place for every eight players</b>, and at least two places for any field.</p>
<table class="t"><thead><tr><th>Players</th><th>Places paid</th><th>Example split of the pot</th></tr></thead><tbody>
<tr><td>8 or fewer</td><td>2</td><td>1st 70% · 2nd 30%</td></tr>
<tr><td>9–16</td><td>3</td><td>1st 50% · 2nd 30% · 3rd 20%</td></tr>
<tr><td>17–24</td><td>4</td><td>1st 45% · 2nd 25% · 3rd 15% · 4th 15%</td></tr>
<tr><td>25–32</td><td>4–6</td><td>1st 40% · 2nd 24% · 3rd 14% · 4th 10% · 5th–6th 6% each</td></tr>
<tr><td>33–64</td><td>6–8</td><td>1st 32% · 2nd 20% · 3rd 13% · 4th 10% · 5th–6th 7.5% each · 7th–8th 5% each</td></tr>
</tbody></table>
<p class="muted">These are examples, not rules. Many rooms pay more to first place on small fields and spread money deeper when there is added money.</p>
<h2>What goes in the pot</h2>
<ul>
<li><b>Entry fees</b>, minus any greens fee the room keeps for table time.</li>
<li><b>Added money</b> from the room or a sponsor goes straight into the pot.</li>
<li>Announce any director's fee up front. Hidden cuts are the fastest way to lose your players.</li>
</ul>
<h2>Ties in a double-elimination bracket</h2>
<p>In <a href="/guides/double-elimination-brackets">double elimination</a>, players who lose on the losers side in the same round finish tied (for example, two players tie for 5th–6th). Split those places evenly.</p>
<h2>Splitting in the final</h2>
<p>Finalists sometimes agree to split first and second and stop playing. That is up to the players and the director — just make sure the room's rules allow it.</p>`
  },
  {
    slug: 'calcutta-auction-explained', title: 'Calcutta Auctions in Pool Tournaments, Explained',
    desc: 'How a pool tournament Calcutta works: the auction, buying back half of yourself, how the pot is paid out, and how to run one smoothly.',
    body: `
<p>A Calcutta is an auction held before a tournament, where bidders "buy" players. When the tournament ends, the Calcutta pot is paid to the owners of the players who finished in the money. It adds a lot of excitement to bigger events.</p>
<h2>How the auction works</h2>
<ol>
<li>Players' names are auctioned one at a time, often the strongest players first.</li>
<li>Anyone in the room can bid. The highest bidder owns that player for the Calcutta.</li>
<li>All winning bids go into the Calcutta pot.</li>
</ol>
<h2>Buying back half</h2>
<p>In many Calcuttas the player can buy back half of themselves from the winning bidder, at half the winning price. It lets players share in their own result.</p>
<h2>How the pot is paid</h2>
<p>The pot is usually paid on the same places as the tournament, often with a bigger share to the winner, for example 40% / 25% / 15% / 10% / 5% / 5% for the top six. Some events take a small percentage for the organizer or the room — announce it before the auction.</p>
<h2>Run it smoothly</h2>
<ul>
<li>Post the rules before the auction: minimum bids, buy-back rules, payout percentages and when money is due.</li>
<li>Collect money as you go, not after the tournament.</li>
<li>Keep a clear written record of every owner and price.</li>
</ul>
<p>Our free <a href="/auctions">online Calcutta tool</a> lets everyone bid from their phone and works out the payouts for you.</p>
<p class="muted"><b>Important:</b> Calcutta auctions are treated differently from place to place. Check your local and state laws before running one. Billiard Action Time does not take, hold or pay out money.</p>`
  },
  {
    slug: 'fargo-ratings-handicaps', title: 'FargoRate and Pool Handicaps: How Ratings and Races Work',
    desc: 'What a Fargo rating means, how a 100-point gap translates to winning chances, and how directors use ratings to set handicapped races and rating caps.',
    body: `
<p>FargoRate is the most widely used rating system in American pool. It gives every player a number based on their game results, and directors use it to set handicaps and rating caps for tournaments.</p>
<h2>What the numbers mean</h2>
<p>Ratings run from a few hundred for newer players to the 800s for the world's best. Many league and bar players fall roughly between 400 and 550; strong local players are often in the 600s.</p>
<h2>The 100-point rule</h2>
<p>The key idea is simple: <b>a 100-point difference means the higher-rated player is expected to win about two games for every one the lower-rated player wins.</b> A 200-point gap is about 4 to 1. That makes it possible to build fair handicapped races.</p>
<h2>Handicapped races</h2>
<p>In a handicapped event, players race to different numbers. A 600 playing a 500 might race to 5 against a race to 3, so each player has roughly the same chance to win the match. Directors usually use a printed chart or an app to look up races.</p>
<h2>Rating caps</h2>
<p>Many events are listed as "550 and under" or "a 1000 combined Fargo" for doubles. That means only players at or below the number can enter (for doubles, the two partners' ratings added together). You will see these caps in many tournament names on this site.</p>
<h2>Don't have a rating?</h2>
<p>Your rating builds as your results are reported. Many rooms and leagues report weekly tournaments. Until you have a solid rating, directors usually assign you a starting number — be honest about your level.</p>
<p>See the numbers for every rating gap in our <a href="/guides/fargo-rating-chart">Fargo rating chart</a>.</p>`
  },
  {
    slug: '8-ball-rules', title: '8-Ball Rules: The Basics Every Tournament Player Should Know',
    desc: 'A plain-English guide to 8-Ball as played in tournaments: the break, open table, fouls, ball in hand and how to win.',
    body: `
<p>8-Ball is the most played pool game in America, and also the one with the most "house rules." Tournaments usually follow a published rule set (league rules, BCA/CSI or WPA rules). These are the basics most of them share. When in doubt, ask the director before you play.</p>
<h2>The goal</h2>
<p>One player shoots the solids (1–7), the other the stripes (9–15). Pocket all of your group, then legally pocket the 8-ball to win.</p>
<h2>The break</h2>
<p>The breaker must pocket a ball or drive a minimum number of balls to the rails. What happens if the 8-ball goes in on the break depends on the rules in use: under some rule sets it is a win, under others it is spotted or re-racked. Check before you start.</p>
<h2>Open table</h2>
<p>After the break the table is "open": groups are not decided yet. Your group is set when you legally pocket a solid or stripe on a called shot after the break.</p>
<h2>Calling shots</h2>
<p>In most tournament rules you call the ball and the pocket for anything that is not obvious. Bank shots, kicks and combinations should always be called.</p>
<h2>Fouls and ball in hand</h2>
<p>Common fouls include scratching, failing to hit your own group first, and no ball reaching a rail after contact. Most tournament rules give the opponent <b>ball in hand anywhere on the table</b> after a foul.</p>
<h2>How you lose on the 8</h2>
<ul>
<li>Pocketing the 8 before your group is cleared.</li>
<li>Pocketing the 8 in a pocket you did not call.</li>
<li>Scratching while pocketing the 8 (under most rules).</li>
</ul>
<p>Ready to play? Find <a href="/tournaments/8-ball">8-Ball tournaments near you</a>.</p>`
  },
  {
    slug: '9-ball-rules', title: '9-Ball Rules: How the Game Is Played in Tournaments',
    desc: '9-Ball basics: hitting the lowest ball first, the push out, three-foul rule, and how games are won.',
    body: `
<p>9-Ball is the classic tournament game: fast, open and exciting. Most events play close to the World Pool-Billiard Association (WPA) rules. Here is how it works.</p>
<h2>The goal</h2>
<p>Balls 1 through 9 are racked in a diamond with the 1 at the front and the 9 in the middle. On every shot you must hit the <b>lowest-numbered ball on the table first</b>. Any ball can go in after that. Whoever legally pockets the 9-ball wins the game — even on the break.</p>
<h2>The break and the push out</h2>
<p>The breaker must hit the 1-ball first and drive enough balls to the rails. On the shot right after the break, the shooter may choose to <b>push out</b>: move the cue ball to a new spot without having to hit the lowest ball. The opponent then decides who shoots next.</p>
<h2>Fouls</h2>
<p>Scratching, hitting the wrong ball first, or no ball reaching a rail after contact are fouls. A foul gives the opponent <b>ball in hand anywhere on the table</b>.</p>
<h2>Three fouls</h2>
<p>Under WPA rules, three fouls in a row by the same player in one game is a loss of that game — but the opponent must warn you after your second foul.</p>
<h2>Handicaps and races</h2>
<p>Many 9-Ball events are handicapped by rating. Learn how in our <a href="/guides/fargo-ratings-handicaps">Fargo guide</a>.</p>
<p>Find <a href="/tournaments/9-ball">9-Ball tournaments near you</a>.</p>`
  },
  {
    slug: '10-ball-rules', title: '10-Ball Rules: The Call-Shot Rotation Game',
    desc: '10-Ball explained: the rack, call-shot rules, what happens to the 10 on the break, and the push out.',
    body: `
<p>10-Ball is 9-Ball's tougher cousin. It adds a ball and, more importantly, makes you <b>call every shot</b>. Luck matters less, which is why many top events use it.</p>
<h2>The goal</h2>
<p>Like 9-Ball, you must always hit the lowest-numbered ball first. You win by legally pocketing the 10-ball on a called shot.</p>
<h2>The rack and break</h2>
<p>The balls are racked in a triangle with the 1 at the front and the 10 in the middle. Under WPA rules, a 10-ball pocketed on the break does <b>not</b> win: it is spotted and the breaker keeps shooting. Local events sometimes play it differently, so check first.</p>
<h2>Call shot</h2>
<p>You call the ball and the pocket (obvious shots usually do not need to be announced). If you pocket the wrong ball or miss your called pocket, it is not a foul, but your opponent chooses whether to shoot or hand the table back to you.</p>
<h2>Push out and fouls</h2>
<p>The push out after the break and ball in hand after fouls work the same as <a href="/guides/9-ball-rules">9-Ball</a>.</p>
<p>Find <a href="/tournaments/10-ball">10-Ball tournaments near you</a>.</p>`
  },
  {
    slug: 'scotch-doubles', title: 'Scotch Doubles: How Pool\'s Team Game Works',
    desc: 'Scotch Doubles explained: alternating shots, who breaks, common fouls, combined rating caps and tips for playing with a partner.',
    body: `
<p>Scotch Doubles is a two-player team format where partners <b>take turns shooting</b>: one partner shoots, then the other, and so on, for as long as the team stays at the table. It is social, strategic and a great way to bring new players into tournaments.</p>
<h2>The basic rules</h2>
<ul>
<li>Partners alternate shots. Shooting out of turn is usually a foul.</li>
<li>Each team decides who breaks; the partner shoots the next shot.</li>
<li>Partners can talk strategy, but many events limit coaching time per shot.</li>
<li>Everything else follows the game being played (8-Ball, 9-Ball or 10-Ball rules).</li>
</ul>
<h2>Mixed and "Jack &amp; Jill" events</h2>
<p>Many Scotch Doubles tournaments are "mixed" or "Jack &amp; Jill," meaning each team has one man and one woman.</p>
<h2>Combined rating caps</h2>
<p>Events are often capped by the partners' combined rating, for example "1000 combined Fargo." Add both players' ratings together; the team must be at or under the cap. See <a href="/guides/fargo-ratings-handicaps">how Fargo ratings work</a>.</p>
<h2>Tips</h2>
<ul>
<li>Play position for your partner, not for yourself: leave a shot they are comfortable with.</li>
<li>Agree on safeties versus going for it before the match.</li>
<li>Stay positive. The teams that have fun usually play better.</li>
</ul>
<p>Find <a href="/tournaments/scotch-doubles">Scotch Doubles tournaments</a>.</p>`
  },
  {
    slug: 'one-pocket', title: 'One Pocket: The Basics of Pool\'s Chess Game',
    desc: 'One Pocket explained: choosing pockets, scoring to eight balls, why defense matters, and what to expect at a One Pocket tournament.',
    body: `
<p>One Pocket is often called "pool's chess game." Each player gets just one corner pocket, and every shot is about offense and defense at the same time.</p>
<h2>The basics</h2>
<ul>
<li>All 15 balls are racked. Before the break, the breaker picks one of the two foot corner pockets; the opponent gets the other.</li>
<li>Any ball counts, but only when it goes in <b>your</b> pocket.</li>
<li>The first player to get <b>eight balls</b> in their pocket wins the game.</li>
<li>Balls made in your opponent's pocket count for them.</li>
</ul>
<h2>Fouls</h2>
<p>A foul usually costs a ball: you spot one of the balls you have already made. If you have none, you owe one.</p>
<h2>Why it is different</h2>
<p>Because you only have one target, much of One Pocket is moving balls toward your side of the table and leaving your opponent nothing. Games can be long and tactical, which is why One Pocket events often use short races.</p>
<p>Find <a href="/tournaments/one-pocket">One Pocket tournaments near you</a>.</p>`
  },
  {
    slug: 'straight-pool-rules', title: 'Straight Pool (14.1 Continuous) Rules and Scoring',
    desc: 'How straight pool works: calling every shot, scoring a point per ball, the 14-ball rerack, the opening break rule and the three-foul penalty.',
    body: `
<p>Straight pool, officially called <b>14.1 continuous</b>, was the main tournament game in America for most of the 1900s. It rewards position play and patience more than any other game, and many players say it is the best way to learn the game.</p>
<h2>The goal</h2>
<p>Every ball is worth one point. Players agree on a target before the match, such as 50, 100 or 150 points for a top-level match, or 25 to 75 points in a local event. The first player to reach the target wins.</p>
<h2>Call every shot</h2>
<p>You can shoot at any ball, in any order, but you must <b>call the ball and the pocket</b>. Obvious shots usually do not need to be said out loud, but a bank, combination or kick should be called. If the called ball goes in the called pocket, you score a point and keep shooting. Extra balls that fall on a legal shot also count.</p>
<h2>The rerack</h2>
<p>This is what makes the game "continuous." When only one object ball is left on the table, the other <b>14 balls are racked again</b> with the spot at the front of the rack left empty. The player keeps shooting, usually trying to make the last ball and break open the new rack with the cue ball in the same shot. Planning that "break ball" is the heart of straight pool strategy.</p>
<h2>The opening break</h2>
<p>The first break of the game is a safety-first shot. The breaker must either pocket a called ball, or drive the cue ball and at least <b>two object balls to a rail</b>. Failing that is a breaking foul and costs <b>two points</b>, and the opponent can make the breaker break again. That is why most opening breaks just clip a corner ball and send the cue ball back up the table.</p>
<h2>Fouls and the three-foul rule</h2>
<ul>
<li>A normal foul (scratching, not hitting a ball, no rail after contact) costs <b>one point</b>. Scores can go negative.</li>
<li>Three fouls in a row by the same player cost an extra <b>15 points</b>, and the balls are reracked. Players are warned after the second foul in a row.</li>
</ul>
<h2>Safeties</h2>
<p>You can call "safety" and play a defensive shot. You do not score, but it is not a foul as long as you still hit a ball and get a rail. Long safety battles are normal, especially on the opening break.</p>
<h2>Straight pool tournaments</h2>
<p>Straight pool events are rarer than 8-Ball or 9-Ball because matches take longer. When they are run, the race is often shorter (for example, 50 or 75 points) or handicapped by points. Look for <a href="/tournaments/straight-pool">straight pool tournaments</a>, or brush up on the <a href="/guides/9-ball-rules">9-Ball</a> and <a href="/guides/8-ball-rules">8-Ball</a> rules most weekly events use.</p>`
  },
  {
    slug: 'pool-tournament-etiquette', title: 'Pool Tournament Etiquette: The Unwritten Rules',
    desc: 'How to behave at a pool tournament: before your match, at the table, calling fouls, sharking, conceding and dealing with disputes.',
    body: `
<p>Most pool tournaments are friendly, and most of the rules that keep them that way are never written on the flyer. Here is what regular players expect from each other.</p>
<h2>Before your match</h2>
<ul>
<li><b>Be there when you are called.</b> If you have to step out, tell the director. Many events give a short grace period and then forfeit the match.</li>
<li><b>Pay before the draw.</b> Have cash ready. Directors are often running the event and playing in it at the same time.</li>
<li><b>Know the rules for the event.</b> Ask about the race, the break rules and who racks before the first match, not after a disputed shot.</li>
</ul>
<h2>At the table</h2>
<ul>
<li><b>Stay still and quiet while your opponent shoots.</b> Sit down out of their line of sight. Don't chalk loudly, stand behind the pocket they are shooting at, or talk to them.</li>
<li><b>Rack carefully and fairly.</b> A tight rack is a courtesy. If your opponent asks to see the rack, let them.</li>
<li><b>Don't coach during the match</b> unless the event allows coaching. Friends at the rail should stay quiet too.</li>
<li><b>Put the phone away.</b> Step away from the table to take a call.</li>
</ul>
<h2>Fouls and close hits</h2>
<p>Call your own fouls. If a shot might be close, such as a possible double hit or a hit you can't see, ask a neutral player or the director to watch it before it is shot. Arguing about it afterwards rarely ends well. In most bar events, if no one watched, the shooter gets the benefit of the doubt.</p>
<h2>Sharking</h2>
<p>"Sharking" is anything meant to distract or upset an opponent: noise, movement, slow play on purpose, or needling talk. Most events can penalize it, and it is the quickest way to get a bad reputation in a local scene.</p>
<h2>Winning and losing</h2>
<ul>
<li>Shake hands at the end of a match, win or lose.</li>
<li>Report the result to the director right away, as the winner, the loser or both, whatever the event uses.</li>
<li>Don't unscrew your cue to concede a game unless you mean it. In most events, that counts as conceding.</li>
</ul>
<h2>Disputes</h2>
<p>Stop play, call the director and explain calmly. The director's decision is final. If you think a ruling was wrong, bring it up politely after the match, not at the table.</p>
<p>Heading to your first event? Read <a href="/guides/first-pool-tournament">what to expect at your first pool tournament</a>, then <a href="/this-weekend/">find a tournament this weekend</a>.</p>`
  },
  {
    slug: 'pool-table-sizes', title: 'Pool Table Sizes: 7-Foot, 8-Foot and 9-Foot Tables Compared',
    desc: 'Playing-surface sizes for 7, 8 and 9-foot pool tables, how much room you need for each, and which size tournaments are played on.',
    body: `
<p>Pool tables are named by their rough length, but the number that matters for play is the size of the <b>playing surface</b>, measured between the cushion noses. The playing surface is always twice as long as it is wide.</p>
<h2>Common sizes</h2>
<table class="t"><thead><tr><th>Table</th><th>Playing surface (about)</th><th>Room needed with a 58" cue (about)</th><th>Where you see it</th></tr></thead><tbody>
<tr><td>7-foot ("bar box")</td><td>78" × 39"</td><td>16'2" × 12'11"</td><td>Bars, coin-op tables, many leagues and bar-box tournaments</td></tr>
<tr><td>8-foot</td><td>88" × 44"</td><td>17' × 13'4"</td><td>Homes, some pool rooms</td></tr>
<tr><td>Oversized 8-foot ("8-plus")</td><td>92" × 46"</td><td>17'4" × 13'6"</td><td>Homes, some pool rooms</td></tr>
<tr><td>9-foot</td><td>100" × 50"</td><td>18' × 13'10"</td><td>Pool rooms, pro events, most big tournaments</td></tr>
</tbody></table>
<p class="muted">Room sizes add about 58 inches (a standard cue) on every side of the playing surface. With a shorter 52" or 48" cue you can get by in less space, but you will feel it on shots near the rail.</p>
<h2>How the game changes</h2>
<p>On a <b>7-foot bar table</b>, the balls are closer together and the break is powerful, so 8-Ball runs out more often and clusters are a bigger problem. Many bar-box tournaments play 8-Ball with a short race and a fast pace.</p>
<p>On a <b>9-foot table</b>, shots are longer and position play is harder, but there is more room around the balls. Rotation games like <a href="/guides/9-ball-rules">9-Ball</a> and <a href="/guides/10-ball-rules">10-Ball</a> are mostly played on 9-footers, and so are <a href="/big-tournaments/">the bigger tournaments</a>.</p>
<h2>Tournament tables</h2>
<p>Flyers usually say "bar box" or "7-foot" when an event is on small tables, and "9-foot" or "big tables" otherwise. If a flyer doesn't say, ask the room. Players who practice on one size are often surprised by the other: cue ball speed on a big table and crowding on a small one are the usual adjustments.</p>
<h2>Other things that affect play</h2>
<ul>
<li><b>Pocket size.</b> Tighter pockets make every shot harder. Pro tables often use pockets around 4.5 inches; many bar tables are more generous.</li>
<li><b>Cloth.</b> New, fast cloth makes balls roll farther and spin more. Older or slower cloth needs a firmer stroke.</li>
<li><b>Cue ball.</b> Some coin-op bar tables use a slightly larger or heavier cue ball so the table can return it. It reacts differently on draw shots.</li>
</ul>
<p>Find <a href="/tournaments/">pool tournaments near you</a> and check the listing or flyer for table size.</p>`
  },
  {
    slug: 'find-pool-tournaments-near-you', title: 'How to Find Pool Tournaments Near You (Weekly, Monthly and Big Events)',
    desc: 'Where pool tournaments are posted, how to find weekly bar and pool-room events near you, and how to hear about new ones first.',
    body: `
<p>Most towns with a pool room or a few bars with tables have at least one weekly tournament, but they can be hard to find. Many are only posted on a flyer by the counter or in a local Facebook group. Here is how to track them down.</p>
<h2>1. Start with a directory</h2>
<p>Billiard Action Time collects tournaments every day from pool rooms, tournament directors, public calendars and players. Browse <a href="/tournaments/">tournaments by state and city</a>, see <a href="/this-weekend/">what is on this weekend</a>, or use <a href="/near">near me</a> to sort by distance. Each listing shows the game, entry fee and added money when the room provides them.</p>
<h2>2. Ask at the pool room</h2>
<p>The person at the counter knows every event in the room and usually the ones nearby. Look for flyers at the counter, on the walls and near the restrooms. Many rooms run the same event on the same night each week, such as an 8-Ball tournament every Tuesday or a 9-Ball tournament every Sunday afternoon.</p>
<h2>3. Join the local pool groups</h2>
<p>Search Facebook for your city or region plus "pool" or "billiards." These groups are where directors post flyers, changes and cancellations. When you see a flyer for an event we don't have, you can <a href="/post">post it free</a> or <a href="/scan">scan the flyer</a> and it will show up for everyone.</p>
<h2>4. Leagues lead to tournaments</h2>
<p>League nights are a good way to meet the local players, and league players always know where the weekend tournaments are. Many leagues also run their own tournaments and qualifiers.</p>
<h2>5. Plan around the big ones</h2>
<p>Regional tours, state opens and added-money events draw players from hours away. See the <a href="/big-tournaments/">biggest upcoming tournaments</a> and the <a href="/calendar">tournament calendar</a> to plan ahead.</p>
<h2>6. Get alerts</h2>
<p>New events are posted every day. <a href="/alerts">Get an email alert</a> for your area so you hear about them first.</p>
<h2>Before you go</h2>
<p>Call or message the room to confirm the start time, sign-up cutoff and entry fee, especially for weekly events that may skip a holiday. Then read <a href="/guides/first-pool-tournament">what to expect at your first tournament</a> and <a href="/guides/pool-tournament-etiquette">the unwritten rules</a>.</p>`

  }
];

export const GUIDES = [...BASE_GUIDES, ...MORE_GUIDES];

// Section each guide is filed under on /guides/ and shown as a tag on the page.
export const GUIDE_CATS = [
  { key: 'rules', name: 'Game rules' },
  { key: 'players', name: 'For players' },
  { key: 'directors', name: 'For tournament directors' }
];
const CAT_OF = {
  '8-ball-rules': 'rules', '9-ball-rules': 'rules', '10-ball-rules': 'rules', 'scotch-doubles': 'rules', 'one-pocket': 'rules', 'straight-pool-rules': 'rules', 'bank-pool-rules': 'rules', 'how-to-rack-pool-balls': 'rules', 'cutthroat-pool-rules': 'rules', 'bar-rules-vs-tournament-rules': 'rules',
  'first-pool-tournament': 'players', 'fargo-ratings-handicaps': 'players', 'pool-tournament-etiquette': 'players', 'pool-table-sizes': 'players', 'find-pool-tournaments-near-you': 'players',
  'pool-terms-glossary': 'players', 'major-pool-events-calendar': 'players', 'fargo-rating-chart': 'players', 'how-to-aim-in-pool': 'players', 'pool-basics-for-beginners': 'players', 'pool-cue-care': 'players', 'pool-tips': 'players', 'pool-leagues-explained': 'players', 'how-to-read-a-tournament-flyer': 'players', 'bar-pool-etiquette': 'players', 'money-game-spots': 'players', 'english-in-pool': 'players', 'safety-play-in-pool': 'players', '8-ball-patterns': 'players', '9-ball-strategy': 'players', 'pool-tournament-nerves': 'players', 'pool-practice-drills': 'players', 'how-to-choose-a-pool-cue': 'players', 'how-to-break-in-pool': 'players', 'how-to-draw-the-cue-ball': 'players', 'how-to-kick-in-pool': 'players', 'pool-vs-billiards-vs-snooker': 'players', 'pool-rules-questions': 'rules', 'how-to-hold-a-pool-cue': 'players', 'pool-cue-tips': 'players', 'how-to-bank-in-pool': 'players', 'pool-ball-colors-and-numbers': 'players', 'pool-games-to-play': 'rules', 'best-pool-movies': 'players', 'how-to-clean-a-pool-table': 'players', 'how-to-level-a-pool-table': 'players',
  'how-to-run-a-pool-tournament': 'directors', 'double-elimination-brackets': 'directors', 'pool-tournament-payouts': 'directors', 'calcutta-auction-explained': 'directors', 'chip-tournaments': 'directors', 'tournament-formats': 'directors', 'start-a-weekly-pool-tournament': 'directors'
};
export const guideCat = slug => CAT_OF[slug] || 'players';
const catName = key => (GUIDE_CATS.find(c => c.key === key) || GUIDE_CATS[1]).name;
const slugify = s => String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const readMinutes = html => Math.max(2, Math.round(String(html).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220));

// Gives every <h2> an id, wraps tables so they scroll on phones, and builds a table of contents.
function prepareBody(html) {
  const toc = [], used = new Set();
  let body = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
    let id = slugify(inner) || 'section'; while (used.has(id)) id += '-2'; used.add(id);
    toc.push({ id, text: inner.replace(/<[^>]+>/g, '') });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  body = body.replace(/<table class="t">[\s\S]*?<\/table>/g, t => `<div class="t-wrap">${t}</div>`);
  return { body, toc };
}

const guideCard = g => `<li><a href="/guides/${g.slug}"><b>${esc(g.title)}</b></a><br><span class="muted">${esc(g.desc)}</span></li>`;

export function guidesIndexPage(cfg) {
  const sections = GUIDE_CATS.map(c => {
    const list = GUIDES.filter(g => guideCat(g.slug) === c.key);
    return list.length ? `<section><h2 id="${c.key}">${c.name}</h2><ul class="seo-list" style="list-style:none;padding:0;display:grid;gap:14px">${list.map(guideCard).join('')}</ul></section>` : '';
  }).join('');
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <span>Guides</span></nav>
  <div class="pagehead"><h1>Pool Tournament Guides</h1><p>Plain-English guides for players and tournament directors: game rules, brackets, payouts, handicaps, practice and more. ${GUIDES.length} guides, all free.</p></div>
  <p class="glossary-az">${GUIDE_CATS.map(c => `<a href="#${c.key}" style="min-width:auto;padding:4px 12px">${c.name}</a>`).join('')}<a href="/trick-shots/" style="min-width:auto;padding:4px 12px">✨ Trick shots</a><a href="/play/aim-trainer" style="min-width:auto;padding:4px 12px">🎯 Aim trainer</a><a href="/tools/" style="min-width:auto;padding:4px 12px">Free tools</a></p>
  <section class="card" style="padding:16px 18px;margin:0 0 22px"><h2 style="margin:0 0 6px;font-size:24px">New to pool? Start here</h2>
  <ol style="margin:0;padding-left:22px;line-height:1.9">
    <li><a href="/guides/pool-basics-for-beginners">Pool for beginners: stance, bridge, grip and stroke</a></li>
    <li><a href="/guides/how-to-aim-in-pool">How to aim: ghost ball and contact points</a>, then try the <a href="/play/aim-trainer">aim trainer</a></li>
    <li><a href="/guides/8-ball-rules">8-Ball rules</a> and <a href="/guides/bar-rules-vs-tournament-rules">bar rules vs. tournament rules</a></li>
    <li><a href="/guides/pool-practice-drills">7 practice drills</a> and <a href="/guides/english-in-pool">English explained</a></li>
    <li><a href="/guides/first-pool-tournament">Your first tournament</a>, then <a href="/this-weekend/">find one this weekend</a></li>
  </ol></section>
  <div class="guide-cats">${sections}</div>`;
  return layout(cfg, { title: 'Pool Tournament Guides: Rules, Brackets, Payouts & More | Billiard Action Time', description: 'Free guides for pool players and tournament directors: 8-Ball, 9-Ball and 10-Ball rules, double-elimination brackets, payout charts, Fargo handicaps, practice drills and a pool glossary.', path: '/guides/', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: 'Pool Tournament Guides', itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${cfg.publicUrl}/guides/${g.slug}`, name: g.title })) }] });
}

export function guidePage(cfg, slug, extraHtml = '') {
  const g = GUIDES.find(x => x.slug === slug);
  if (!g) return null;
  const cat = guideCat(g.slug);
  const { body: content, toc } = prepareBody(g.body);
  const same = GUIDES.filter(x => x.slug !== slug && guideCat(x.slug) === cat);
  const other = GUIDES.filter(x => x.slug !== slug && guideCat(x.slug) !== cat);
  const next = [...same.slice(0, 3), ...other.slice(0, Math.max(1, 4 - same.slice(0, 3).length))].slice(0, 4);
  const tocHtml = toc.length >= 3 ? `<nav class="guide-toc" aria-label="On this page"><b>On this page</b><ol>${toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : '';
  const body = `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> <span>/</span> <a href="/guides/">Guides</a> <span>/</span> <span>${esc(g.title)}</span></nav>
  <article class="card guide"><h1>${esc(g.title)}</h1>
  <p class="guide-meta"><a class="guide-tag" href="/guides/#${cat}" style="text-decoration:none">${catName(cat)}</a><span>${readMinutes(g.body)} min read</span><span>Updated October 2026</span><span>By Billiard Action Time</span></p>
  ${tocHtml}${content}${shareStrip(cfg, `/guides/${g.slug}`, g.title, g.title + ' (free guide)')}${cat === 'rules' ? '<p class="tip" style="margin-top:18px"><b>Test yourself:</b> take the 12-question <a href="/tools/pool-rules-quiz">pool rules quiz</a> and share your score with your league. Settling an argument? See the <a href="/guides/pool-rules-questions">pool rules Q&amp;A</a>.</p>' : ''}</article>
  ${extraHtml}
  <section class="sec seo-sec"><h2>Keep reading</h2><div class="guide-next">${next.map(x => `<a href="/guides/${x.slug}"><small>${catName(guideCat(x.slug))}</small><b>${esc(x.title)}</b></a>`).join('')}</div><p style="margin-top:12px"><a href="/guides/">All ${GUIDES.length} guides →</a> · <a href="/tools/">Free tools →</a></p></section>`;
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, url: `${cfg.publicUrl}/guides/${g.slug}`, articleSection: catName(cat), dateModified: '2026-10-15',
    publisher: { '@type': 'Organization', name: 'Billiard Action Time', logo: { '@type': 'ImageObject', url: cfg.publicUrl + '/icons/icon-512.png' } }, author: { '@type': 'Organization', name: 'Billiard Action Time' } };
  const bc = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: cfg.publicUrl + '/' }, { '@type': 'ListItem', position: 2, name: 'Guides', item: cfg.publicUrl + '/guides/' }, { '@type': 'ListItem', position: 3, name: g.title, item: `${cfg.publicUrl}/guides/${g.slug}` }] };
  const faq = g.faq ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : [];
  return layout(cfg, { title: `${g.title} | Billiard Action Time`, description: g.desc, path: `/guides/${g.slug}`, body, jsonld: [ld, bc, ...faq], ogImage: `${cfg.publicUrl}/og/guides/${g.slug}.png` });
}

export function aboutPage(cfg) {
  const body = `<div class="pagehead"><h1>About Billiard Action Time</h1></div>
  <article class="card" style="padding:20px 22px;line-height:1.65">
  <p>Billiard Action Time is a free directory of pool and billiards tournaments across the United States, run by pool players for pool players.</p>
  <p>Finding a tournament used to mean scrolling through a dozen Facebook groups, flyers taped to bar walls and word of mouth. We built one place where you can see what is happening near you this week: weekly 8-Ball and 9-Ball nights at local bars, monthly money-added events, Scotch Doubles, One Pocket, and the big regional opens.</p>
  <h2>What we do</h2>
  <ul>
  <li><b>Tournament listings, updated every day.</b> We gather events from tournament directors, pool rooms, public tournament calendars and players' submissions, check them for duplicates and mistakes, and organize them by state, city, game and date.</li>
  <li><b>This weekend's tournaments.</b> One page per state that always shows the coming weekend.</li>
  <li><b>Free tools for directors and players:</b> <a href="/post">free tournament posting</a> with share graphics, a <a href="/scan">flyer scanner</a>, an online <a href="/auctions">Calcutta auction</a>, the <a href="/matches">Match Finder</a> and the <a href="/money-matches/">Money Match</a> board.</li>
  <li><b><a href="/guides/">Guides</a></b> on game rules, brackets, payouts, handicaps and running a tournament.</li>
  </ul>
  <h2>Accuracy</h2>
  <p>Tournament details change, and some come to us second-hand. Every listing shows where it came from, and we fix problems as soon as we hear about them. If you see a mistake, use the "Report a problem" link on any tournament, or email us. Always confirm with the room before you drive a long way.</p>
  <h2>For tournament directors and pool rooms</h2>
  <p>Listing your tournaments is free. <a href="/post">Post a tournament</a>, or <a href="/contact">contact us</a> to have your weekly events added automatically or to claim a listing.</p>
  <h2>Contact</h2>
  <p>Questions, corrections or partnership ideas: <a href="mailto:${EMAIL}">${EMAIL}</a></p>
  </article>`;
  return layout(cfg, { title: 'About Billiard Action Time | Pool Tournament Directory', description: 'Billiard Action Time is a free, daily-updated directory of pool and billiards tournaments across the USA, with free tools for players and tournament directors.', path: '/about', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'AboutPage', name: 'About Billiard Action Time', url: cfg.publicUrl + '/about' }] });
}

export function contactPage(cfg) {
  const body = `<div class="pagehead"><h1>Contact Us</h1><p>We read every message and usually reply within a day or two.</p></div>
  <article class="card" style="padding:20px 22px;line-height:1.65">
  <p style="font-size:1.15em"><b>Email:</b> <a href="mailto:${EMAIL}">${EMAIL}</a></p>
  <h2>Quick links</h2>
  <ul>
  <li><b>Post a tournament:</b> <a href="/post">list it free here</a>, or snap a flyer with the <a href="/scan">flyer scanner</a>.</li>
  <li><b>Fix a listing:</b> open the tournament and tap "Report a problem," or email us the link and the correction.</li>
  <li><b>Run a pool room or a tour?</b> Email us your schedule and we can add your weekly events automatically.</li>
  <li><b>Advertising and sponsorship:</b> email us to sponsor the site or the weekly email.</li>
  <li><b>Get tournament emails:</b> <a href="/alerts">sign up for alerts</a>.</li>
  </ul>
  <p class="muted">To be removed from our email list, reply "unsubscribe" to any email. See our <a href="/privacy">Privacy Policy</a>.</p>
  </article>`;
  return layout(cfg, { title: 'Contact Billiard Action Time', description: 'Contact Billiard Action Time: post or correct a tournament, add your pool room\'s events, or ask about sponsorship.', path: '/contact', body,
    jsonld: [{ '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact Billiard Action Time', url: cfg.publicUrl + '/contact' }] });
}
