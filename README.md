# STC Rowing Crew Hub

A dashboard site for the S. Thomas' College rowing crew. It covers the season leading up to the **Royal Thomian Regatta** (1000 yards / 914.4 m, Beira Lake).

It is a static website: plain HTML, CSS and JavaScript with no build step. It is hosted on GitHub Pages and can use **Firebase** for logins and shared data.

## Who sees what

| Role | Who | Can do |
|---|---|---|
| **Coach** | Coaches | Everything. Sets weekly schedules, gives boats their own sessions or exceptions, drags sessions between days, gets AI suggestions, selects crews, logs time tests and regatta results, writes technical feedback for athletes, edits records and points, and manages logins |
| **Data Entry** | Secretary / coxes | **Daily Entry**: attendance (Present / Late / Absent / Excused), each rower's resting HR with its source (Manual, Garmin, Whoop…) and which crews completed each session. Can also print or send the day's plan |
| **Athlete** | Each rower and cox | **My Page**: enter today's resting HR, keep a training log, read coach feedback, and see km rowed per week, all sessions for every boat they are in, erg / VO₂ / HR / weight progress, and every race and time test they took part in |
| **Advisory Committee** | Committee members | View only. **Committee Report**: boat readiness against course records and S. Thomas' bests, the **athlete load table** (events, Royal Thomian points carried, wins and losses, progress), attendance and welfare flags |

## Main features

- **Today**: the day's sessions by crew, and completion marking (done / partial / missed). One click sends the plan to WhatsApp, copies it, or prints it.
- **Schedule board**: drag sessions between days. The coach can copy the previous week, assign a session to the whole squad or to specific boats, and add exceptions per crew. The board warns when a session falls outside the 2–6 pm rowing window or the fitness window, or clashes for the same crew. **✨ Suggest sessions** proposes sessions based on days to the regatta, each crew's gap to the record, recent completion and raised resting-HR flags. **Ask Claude** opens Claude with a full prompt to plan the week.
- **km rowed**: for each athlete, the planned km of the sessions their crew completed on days they attended, plus km they log themselves.
- **Regattas & Results**: race results over 300 m, 500 m, 1000 yd, 1000 m, 2000 m and 2-mile head races. Each result is linked to every crew member's page with a win–loss record. The page also holds the **Royal Thomian history** (2022–2026, with 2026 race by race).
- **Boat Progress & Records**: every time test is converted to 1000 yd and compared with the course record and with S. Thomas' best for that event.
- **Royal Thomian data**: the 10 events, the 52 points (A4+ Boat Race 12, B4+ 8, A2x 8, A2− 8, A1x 6, B2x 4, B2− 4, B1x 2), course records and STC bests. This is compiled from Wikipedia and the 2026 ePRESS match report. Records are marked **?** until they are checked against the official record sheet. The 2026 Boat Race time is disputed (3:03 vs 3:05).

## Switching on logins (cloud mode)

Until this is done the site runs in **local mode**: data stays in each browser, the demo squad is shown, and the coach and data-entry views use PINs (demo `1234` / `1111`).

1. Go to https://console.firebase.google.com and click **Add project**. The free Spark plan is enough.
2. Go to **Build → Authentication → Get started** and enable **Email/Password**.
3. Go to **Build → Firestore Database → Create database** (production mode). Open the **Rules** tab, paste in the contents of [`firestore.rules`](firestore.rules), and click **Publish**.
4. Go to **Project settings → Your apps → Web app (`</>`)**. Copy the `firebaseConfig` values into [`js/firebase-config.js`](js/firebase-config.js) and commit the file.
5. Go to **Authentication → Settings → Authorized domains** and add `sajeevds91.github.io`.
6. Open the site. Choose **First-time setup** and create the coach account. Only the very first account can do this.
7. Go to **Data & Settings**:
   - Choose **Load demo squad** or **Start empty**, or **Restore** a backup downloaded from local mode.
   - Create a login for each athlete (linked to their profile), for the secretary or coxes (Data Entry) and for each committee member (Advisory).
   - Usernames without "@" work, so no email is needed.

The rules in `firestore.rules` are enforced on the server:

- Athletes can only write their *own* resting HR and training log.
- Data entry can only write attendance, session completion and resting HR.
- Advisory accounts are read-only.
- Only coaches change everything else.

## Garmin, Whoop and other devices

The site cannot read heart rate directly from a watch:

- **Whoop** has a public developer API, but connecting to it needs a small server to hold the app secret.
- **Garmin's** Health API is only open to approved business partners.
- **Apple Health and Google Health Connect** can only be read by a phone app.

For now, athletes copy the morning resting HR from their device app into **My Page**, or tell the cox, who enters it on **Daily Entry**. Each reading records which device it came from. A direct Whoop link could be added later with a Firebase Cloud Function, which needs the paid Blaze plan.

## Running locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

---

This repository also contains **`transco-dashboard/`**, a separate customer shipment-tracking portal for Transco Consolidation. See [`transco-dashboard/README.md`](transco-dashboard/README.md).
