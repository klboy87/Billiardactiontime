// Daily subscriber list for the morning email task. Claude's scheduled email task can't reach the site,
// but it can read this service's private Railway logs, so once a day (6:25-6:35 AM Detroit time) the
// server writes one log line: "[daily-email-list] YYYY-MM-DD <base64 JSON array of emails>".
// Base64 only keeps addresses from showing as plain text at a glance in the logs; it is not encryption.
import { listSubscribers } from './db.js';

export const TAG = '[daily-email-list]';

function detroitNow(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function listLine(db, day) {
  const emails = listSubscribers(db).map(s => s.email);
  return `${TAG} ${day} ${Buffer.from(JSON.stringify(emails)).toString('base64')}`;
}

// Call every few minutes; logs at most once per Detroit day, inside the 6:25-6:35 AM window.
export function makeListLogger(db, log) {
  let lastDay = null;
  return (now = new Date()) => {
    const { day, minutes } = detroitNow(now);
    if (day === lastDay || minutes < 6 * 60 + 25 || minutes > 6 * 60 + 35) return false;
    lastDay = day;
    log(listLine(db, day));
    return true;
  };
}
