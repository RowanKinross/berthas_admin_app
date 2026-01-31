import subprocess
from datetime import datetime, timedelta
from statistics import mean, median

# --- Tunable assumptions (edit if you like) ---
SESSION_GAP_MINUTES = 90     # gap between commits that starts a new session
MIN_SESSION_MINUTES = 45     # minimum counted time per session
MAX_SESSION_HOURS   = 6      # cap very long sessions (avoids counting breaks/sleep)
OVERHEAD_MINUTES    = 10     # add per session for context/setup

def run(cmd):
    return subprocess.check_output(cmd, text=True).strip()

# Get commit timestamps (oldest -> newest)
raw = run(["git", "log", "--date=iso-strict", "--pretty=format:%ad", "--reverse"])
lines = [l.strip() for l in raw.splitlines() if l.strip()]
if not lines:
    raise SystemExit("No commits found.")

times = [datetime.fromisoformat(l) for l in lines]

total_commits = int(run(["git", "rev-list", "--count", "HEAD"]))
active_days = len(set(t.date() for t in times))
first, last = times[0], times[-1]
span_days = (last.date() - first.date()).days + 1

gap = timedelta(minutes=SESSION_GAP_MINUTES)
sessions = []
start = prev = times[0]

for t in times[1:]:
    if t - prev > gap:
        sessions.append((start, prev))
        start = t
    prev = t
sessions.append((start, prev))

def adjusted_session_hours(a, b):
    dur = b - a
    if dur < timedelta(minutes=MIN_SESSION_MINUTES):
        dur = timedelta(minutes=MIN_SESSION_MINUTES)
    if dur > timedelta(hours=MAX_SESSION_HOURS):
        dur = timedelta(hours=MAX_SESSION_HOURS)
    dur += timedelta(minutes=OVERHEAD_MINUTES)
    return dur.total_seconds() / 3600

session_hours = [adjusted_session_hours(a, b) for a, b in sessions]
total_hours = sum(session_hours)

def estimate(session_gap=90, min_sess=30, cap_h=6, overhead=10):
    gap = timedelta(minutes=session_gap)
    sessions=[]
    start=prev=times[0]
    for t in times[1:]:
        if t-prev>gap:
            sessions.append((start,prev))
            start=t
        prev=t
    sessions.append((start,prev))
    tot=0.0
    for a,b in sessions:
        dur=b-a
        if dur < timedelta(minutes=min_sess):
            dur = timedelta(minutes=min_sess)
        if dur > timedelta(hours=cap_h):
            dur = timedelta(hours=cap_h)
        dur += timedelta(minutes=overhead)
        tot += dur.total_seconds()/3600
    return tot, len(sessions)

low,  _  = estimate(session_gap=120, min_sess=30, cap_h=4, overhead=5)
mid,  mid_n  = estimate(session_gap=90,  min_sess=45, cap_h=6, overhead=10)
high, _ = estimate(session_gap=60,  min_sess=60, cap_h=8, overhead=15)

print("\n=== Git-based effort estimate ===")
print(f"Commits:              {total_commits}")
print(f"Active days:          {active_days}")
print(f"Project span:         {span_days} days ({first.date()} → {last.date()})")
print(f"Sessions (mid model): {mid_n}")
print("")
print("Hours estimate (session model):")
print(f"  Low:  {low:.1f} h")
print(f"  Mid:  {mid:.1f} h  ← recommended")
print(f"  High: {high:.1f} h")
print("")
print("Session length stats (mid model):")
print(f"  Mean session hours:   {mean(session_hours):.2f}")
print(f"  Median session hours: {median(session_hours):.2f}")
print("")
print("Suggested reporting line:")
print(f"  I estimate ~{mid:.0f} hours (approx. {low:.0f}–{high:.0f}) based on commit-session analysis.")

# 26.1.26 estimate was 150 hrs (130 - 170). A professional freelance developer would charge between £8,000 and £15,000 for a custom app with the same number of features.

