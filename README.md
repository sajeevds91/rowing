# STC Rowing Crew Hub

A dashboard site for the S. Thomas' College rowing crew. It covers the season leading up to the **Royal Thomian Regatta**.

It is a static website: plain HTML, CSS and JavaScript with no server and no build step. Chart.js is included in `vendor/`, so the site also works offline.

## Views

Use the switch in the header to change view.

| View | Who | What they see |
|---|---|---|
| **Team** | Rowers and coxes | Team info, schedule and calendar, *My Progress* (personal erg, VO₂ max, resting HR and weight charts), attendance, crews, boat progress against records |
| **Coach** | Coaches (PIN) | Everything above with editing, plus **Combinations** (seat racing), **Committee Report** and **Data & Settings** |
| **Advisory Committee** | Committee members | A printable **Committee Report**: days to the regatta, boat readiness against records, attendance trend, squad fitness, athlete welfare and the latest coach updates. Read-only access to the other pages |

## Features

- **Team Info**: about the team, daily updates feed, photo gallery (images are resized on upload), squad roster, this week's plan, upcoming events, squad 2k trend and weekly attendance.
- **Schedule & Calendar**: the coach enters a weekly plan with a focus and sessions (water, erg, gym, run, test, rest). A plan can be copied from the previous week. Each week shows a summary of session types. The month calendar shows time tests, trial regattas, meetings and the regatta itself.
- **Athletes & Fitness**: a dashboard for each athlete covering 2k and 5k erg (as split per 500 m), VO₂ max, resting heart rate and body weight over time. A squad table shows watts per kg and attendance. The **Recovery watch** flags any athlete whose resting HR is 5 or more bpm above their recent baseline. Coaches can enter results for the whole squad at once after a test day, and can export the data as CSV.
- **Attendance**: tap P, L, A or E (present, late, absent, excused) for each athlete. Shows a 14-day grid, attendance percentages, weekly trend and anyone below 80%.
- **Crews & Boats**: the events are 4+ A, B and C; 2x A and B; 2- A and B; 1x A and B; and U16 4+. Each crew has seat-by-seat selection, average 2k erg and average weight, and its gap to the record. It also flags athletes who race in more than one event.
- **Boat Progress & Records**: a log of time tests and trial regattas for each boat, covering distance, time, split, stroke rate, conditions and line-up. Every result is compared with the regatta record by gap in seconds and as % of record speed. Tests over 500 m or 2000 m are converted to the race distance with Paul's law, so they can be compared.
- **Combinations** (coach only): log pieces with different line-ups. The page ranks line-ups by average split and projected race time, and shows a seat-racing effect for each athlete (pieces with vs without them). A single click makes the best line-up the crew.
- **Data & Settings**: regatta name and date, venue, coaches, coach PIN, and events with their **official records** (holder, year, a *verified* tick). Also backup and restore.

## Before real use

1. Open **Coach**. The demo PIN is `1234`; change it in Data & Settings.
2. **Data & Settings → Start empty** removes the demo athletes, results and attendance and keeps the event list.
3. Enter the **official Royal Thomian records** and the race distance for each event. The demo records and the 1000 m distances are placeholders, and the site marks unverified records with `?`.
4. Set the real regatta date and venue.

## Sharing data with everyone

Data is saved in the browser of whoever enters it, which is normally the coach. To publish it to the team and the committee:

1. Go to **Data & Settings → Download data file**.
2. Commit that file to this repo as `data/team-data.json`.
3. Anyone who opens the site, and who has no local edits in their own browser, now sees the published data.

The coach PIN only hides the editing controls. It is **not** real security, because a static site's data file is public. If the data must be private, or several coaches need to edit at the same time, the next step is a small backend such as Firebase or Supabase.

## Running locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. To host it, turn on **GitHub Pages** for this repository (Settings → Pages → deploy from branch).
