# Together & Co. — Spin & Win (GitHub Pages)

| File | What it is |
|---|---|
| `index.html` | **Lobby screen**: slideshow, Spin & Win wheel and vouchers. No admin on the screen. |
| `admin.html` | **Admin**: works on desktop, tablet and phone, PIN protected. |
| `config.js` | The **only file you edit**: your Google Apps Script web app link. |
| `assets/` | Logo, fonts, icons and shared code. Don't rename. |
| `manifest.webmanifest`, `sw.js` | Let the screen install as a full-screen app and keep running if the internet drops. |
| `Code.gs` | Backend: paste into your Google Sheet (Extensions → Apps Script). GitHub Pages doesn't run it. |

Everything (guests, spins, awards, settings, schedule and slideshow) is stored in your Google Sheet and Drive.

## 1. Google Sheet (one time)
1. Open the Sheet → **Extensions → Apps Script** → replace everything with `Code.gs` → **Save**.
2. Choose **setup** in the toolbar → **▶ Run** → allow access. This adds a **Settings** tab and re-applies the locks.
3. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The link stays the same.
4. The first admin PIN is **2468**. Change it in admin → Settings.

## 2. GitHub Pages
This repository is published with **Settings → Pages → Deploy from a branch → main / (root)**.

- Screen: https://strivedi6.github.io/Spin-Win/
- Admin: https://strivedi6.github.io/Spin-Win/admin.html

To change the Google link later, edit `config.js` on GitHub and commit. The screen picks it up on its next reload.

## 3. Lobby screen (Android)
1. Open the screen link in **Chrome**.
2. Go to **⋮ → Add to Home screen / Install app**. It then opens full screen, without the browser bar.
3. Open it from the home screen and tap **Start** once.
4. A small red dot in the corner means the screen is offline. Spins and vouchers are saved on the screen and sent to the Sheet when it's back online.

## Day to day (admin.html)
- **Dashboard**: today's numbers, screen online/offline, and **Redeem a voucher** (type the code from the guest's photo).
- **Vouchers**: search, filter, redeem / undo, view the voucher, and **Excel** export.
- **Spin awards**: edit text, colour, slices and chance, with a live wheel preview.
- **Slideshow**: upload photos and videos, set order, seconds and show/hide, and set the Spin & Win days and times.
- **Settings**: timings, one-per-day rule, sound, screen text, T&Cs, logo and PIN.

Changes reach the screen within a few seconds.
