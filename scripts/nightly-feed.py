# Nightly tournament import: reads downloaded findtourneys / rackradar pages, adds the
# recurring venue events, dedupes against public/tournaments-feed.json and appends new ones.
# Usage: python3 -I scripts/nightly-feed.py <download-dir> <YYYY-MM-DD today> [--write]
#   <download-dir> must hold ft.html (findtourneys.com/tournaments.php), ftf.json
#   (findtourneys ajaxFetchResults.php) and rr.html (rackradar.com/tournaments?reset=true).
import json, re, sys, html, datetime as dt
from pathlib import Path

DL, TODAY = Path(sys.argv[1]), sys.argv[2]
WRITE = '--write' in sys.argv
FEED = Path(__file__).resolve().parent.parent / 'public' / 'tournaments-feed.json'
DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
STATES = {'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC', 'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'}

def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
def norm(s): return re.sub(r'[^a-z0-9 ]+', '', (s or '').lower()).strip()
STOP = {'night', 'tournament', 'tournaments', 'weekly', 'pool', 'the', 'tourney', *DAYS}
def words(s): return {w for w in norm(s).split() if w not in STOP}
def state_code(s):
    s = (s or '').strip()
    return s.upper() if len(s) == 2 else STATES.get(s.lower(), '')

def clean_name(n):
    n = html.unescape(re.sub(r'\s+', ' ', n or '')).strip(' -!.,')
    n = re.sub(r'(?i)\s*every \w+ night\s*@.*$', '', n)
    n = re.sub(r'(?i)\b(\d+) bal\b', r'\1 Ball', n)  # source typo "8 Bal"
    for _ in range(3):  # collapse repeated phrases ("Friday Night Friday Night 8 Ball")
        n = re.sub(r'(?i)\b((?:\w+ ){1,3})\1', r'\1', n + ' ').strip()
    return n

def game_of(n, hint=''):
    s = f'{n} {hint}'.lower()
    if re.search(r'8\s*/\s*9|laggers?\s*choice|lagger.s choice|rackers?\s*choice|8 ball winners', s): return None
    if 'scotch' in s: return 'Scotch Doubles'
    if re.search(r'one pocket|1 pocket|1-pocket', s): return 'One Pocket'
    if re.search(r'\b10[- ]?ball\b', s): return '10-Ball'
    if re.search(r'\b9[- ]?ball\b|nine ball', s): return '9-Ball'
    if re.search(r'\b8[- ]?ball\b|eight ball|straight 8', s): return '8-Ball'
    return None

def weekday_ok(name, date):
    wd = dt.date.fromisoformat(date).weekday(); n = name.lower()
    return not any(d in n for i, d in enumerate(DAYS) if i != wd)

def entry(prefix, name, date, venue, city, state, address='', zip_='', game=None, fee=None, notes='', venue_in_id=True):
    e = {'id': f'{prefix}{slug(name)}-{slug(venue) + "-" if venue_in_id else ""}{date}', 'name': name, 'date': date, 'venue': venue}
    if address: e['address'] = address
    e['city'] = city; e['state'] = state
    if zip_: e['zip'] = zip_
    if game: e['game'] = game
    if fee: e['entry'] = fee
    e['notes'] = notes
    return e

cands, skipped = [], []

# findtourneys weekly list (schema.org Event rows)
h = (DL / 'ft.html').read_text(errors='ignore')
for row in re.findall(r'<tr itemscope itemtype="https://schema.org/Event">(.*?)</tr>', h, re.S):
    g = lambda p: (re.search(p, row, re.S) or [None, ''])[1].strip()
    name = clean_name(g(r'itemprop="name">([^<]*)</span>\s*</a>'))
    date = g(r'itemprop="startDate" content="([^"]+)"')
    venue = html.unescape(g(r'itemtype="https://schema.org/Place">\s*<span itemprop="name">([^<]*)</span>'))
    if not (name and date and venue): continue
    if not weekday_ok(name, date): skipped.append(('weekday', name, date)); continue
    if 'bulldogs billiards bar' in venue.lower() and '9-ball open' in name.lower(): continue
    cands.append(entry('ft-', name, date, venue, html.unescape(g(r'addressLocality" content="([^"]*)"')),
                       state_code(g(r'addressRegion" content="([^"]*)"')), html.unescape(g(r'streetAddress" content="([^"]*)"')),
                       g(r'postalCode" content="([^"]*)"'), game_of(name), notes='Source: findtourneys.com'))

# findtourneys future events
for x in json.loads((DL / 'ftf.json').read_text()):
    name = clean_name(x.get('headline') or ''); date = x.get('date') or ''
    venue = html.unescape(x.get('pool_hall') or '')
    if not (name and date and venue): continue
    freq = x.get('frequency') or 'once'
    if not weekday_ok(name, date): skipped.append(('weekday', name, date)); continue
    m = re.match(r'monthly_(\w+)_(\w+)', freq)
    if m and m.group(1) == 'last':  # "last <day>" must really be the last one of the month
        d0 = dt.date.fromisoformat(date)
        if (d0 + dt.timedelta(days=7)).month == d0.month: skipped.append(('not-last', name, date)); continue
    notes = 'Source: findtourneys.com' + (f'. Recurring monthly {m.group(1)} {m.group(2)}' if m else (f'. Recurring {freq.replace("_", " ")}' if freq != 'once' else ''))
    cands.append(entry('ft-', name, date, venue, x.get('city') or '', state_code(x.get('state')), game=game_of(name, x.get('game_type') or ''), notes=notes))

# rackradar (one-off events only)
r = (DL / 'rr.html').read_text(errors='ignore')
blob = ''.join(json.loads('"' + s + '"') for s in re.findall(r'self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)', r))
i = blob.find('"tournaments":[')
if i >= 0:
    arr, depth, j = blob[i + len('"tournaments":'):], 0, 0
    for j, ch in enumerate(arr):
        depth += ch == '['; depth -= ch == ']'
        if depth == 0: break
    for t in json.loads(arr[:j + 1]):
        if t.get('recurringInfo'): continue
        v = t.get('venue') or {}
        date = str(t.get('date') or '')[:10]; name = clean_name(t.get('name') or '')
        if not (name and re.match(r'\d{4}-\d\d-\d\d$', date) and v.get('name')): continue
        addr = v.get('address') or ''
        zm = re.search(r'\b(\d{5})\b(?=[^\d]*$)', addr)
        street = addr.split(',')[0].strip() if addr else ''
        fee = t.get('entryFee'); fee = int(fee) if isinstance(fee, (int, float)) and fee > 0 else None
        cands.append(entry('rr-', name, date, v['name'], v.get('city') or '', state_code(v.get('state')), street,
                           zm.group(1) if zm else '', game_of(name, t.get('gameType') or ''), fee, 'Source: rackradar.com'))

# recurring venue events: next 2 upcoming dates for each
today = dt.date.fromisoformat(TODAY)
def nth_weekday(d, wd): return (d.day - 1) // 7 + 1 if d.weekday() == wd else 0
REC = [
    ('mrcues2-com-', 'Open 9-Ball Tournament', 0, None, "Mr. Cue's II Billiards", 'Atlanta', 'GA', '9-Ball', None, 'Source: mrcues2.com. Recurring weekly Monday 8pm'),
    ('mrcues2-com-', '9-Ball C & D Tournament', 4, None, "Mr. Cue's II Billiards", 'Atlanta', 'GA', '9-Ball', None, 'Source: mrcues2.com. Recurring weekly Friday 8pm'),
    ('mrcues2-com-', '8 Ball Tournament', 6, None, "Mr. Cue's II Billiards", 'Atlanta', 'GA', '8-Ball', None, 'Source: mrcues2.com. Recurring weekly Sunday 7pm'),
    ('legendsjax-com-', 'Open 9-Ball Tournament', 6, None, 'Legends Billiards', 'Jacksonville', 'FL', '9-Ball', 20, 'Source: legendsjax.com. Recurring weekly Sunday 1pm'),
    ('legendsjax-com-', 'Short Race 8-Ball Tournament', 6, None, 'Legends Billiards', 'Jacksonville', 'FL', '8-Ball', 20, 'Source: legendsjax.com. Recurring weekly Sunday 4pm'),
    ('playhoboken-com-', 'Casual Tournament', 6, 'not3', 'Play! Hoboken', 'Hoboken', 'NJ', None, 35, 'Source: playhoboken.com. Recurring every Sunday except third Sunday, double elimination'),
    ('playhoboken-com-', 'Competitive Tournament', 6, 3, 'Play! Hoboken', 'Hoboken', 'NJ', None, 75, 'Source: playhoboken.com. Recurring third Sunday, double elimination'),
    ('californiabilliards-com-', 'One Pocket Tournament', 5, 3, 'California Billiards', 'Fremont', 'CA', 'One Pocket', 30, 'Source: californiabilliards.com. Recurring: third Saturday of the month'),
    ('californiabilliards-com-', '9 Ball Tournament', 6, 3, 'California Billiards', 'Fremont', 'CA', '9-Ball', 30, 'Source: californiabilliards.com. Recurring: third Sunday of the month'),
]
feed = json.loads(FEED.read_text())
have = {e['id'] for e in feed['tournaments']}
for pre, name, wd, nth, venue, city, st, game, fee, notes in REC:
    got, d = 0, today
    while got < 2 and d < today + dt.timedelta(days=120):
        n = nth_weekday(d, wd)
        if n and (nth is None or (nth == 'not3' and n != 3) or nth == n):
            e = entry(pre, name, d.isoformat(), venue, city, st, game=game, fee=fee, notes=notes, venue_in_id=False)  # recurring ids have no venue part
            if e['id'] in have: got += 1  # already listed counts toward the next two
            else: cands.append(e); got += 1
        d += dt.timedelta(days=1)

# dedupe against the feed and within the new list
def dup(e, pool):
    for o in pool:
        if o['id'] == e['id']: return True
        if o.get('date') != e['date']: continue
        va, vb = norm(o.get('venue')), norm(e['venue'])
        same_venue = va and vb and (va.startswith(vb) or vb.startswith(va))
        wa, wb = words(o.get('name')), words(e['name'])
        share = (not wa and not wb) or (wa and wb and len(wa & wb) >= max(1, min(len(wa), len(wb))) / 2)
        if same_venue and share: return True
        if norm(o.get('city')) == norm(e['city']) and (norm(o.get('name')) == norm(e['name']) or (share and len(wa & wb) >= len(wa | wb) / 2)): return True
    return False

existing = [e for e in feed['tournaments']]
new = []
for e in cands:
    if e['date'] < TODAY or not (e['name'] and e['city'] and e['state']): continue
    if dup(e, existing) or dup(e, new): continue
    new.append(e)

for e in new: print(f"{e['id']} | {e['name']} | {e['venue']} | {e['city']} {e['state']} | {e.get('game')} | {e.get('entry')}")
from collections import Counter
print('skipped:', skipped)
print('by source:', dict(Counter(e['id'].split('-')[0] for e in new)))
old = len(feed['tournaments'])
if WRITE and new:
    feed['tournaments'] += new
    ids = [e['id'] for e in feed['tournaments']]; assert len(ids) == len(set(ids))
    FEED.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + '\n')
print(f'{old} -> {old + len(new)}')
