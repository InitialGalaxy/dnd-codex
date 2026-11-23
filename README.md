# DnD Codex

A D&D lore, character and virtual-tabletop app that runs on your own computer. Your players join from
their phones or laptops through a web browser, with nothing to install.

- **On your phone:** https://initialgalaxy.github.io/dnd-codex/ is the web version. It keeps your library on the
  phone, works offline, and syncs with your private library repository using a key only you have. Without the
  key it's an empty codex.
- **Your campaign data is never in this repository.** `library.json`, `images/`, `backups/` and
  `codex-config.json` stay on your computer, and git ignores them.

## Getting started

1. Install [Node.js](https://nodejs.org) (the LTS version).
2. Download this repository (Code → Download ZIP) and unzip it into a folder.
3. Double-click **Make taskbar shortcut** once, then pin the DnD Codex shortcut it makes
   (right-click the desktop shortcut → Show more options → Pin to taskbar).
4. Click it to start. The codex opens in its own window. It stops by itself a couple of minutes after every
   codex window (yours and the players') has been closed. If something goes wrong, `codex.log` says why.

The first time, Windows may ask whether Node.js can use the network. Tick **Private networks** and click
**Allow**, or phones won't be able to connect.

You can also start it with **Start DnD Codex**, which keeps a black window open while you play. Closing that
window stops the codex.

## Updating

Double-click **Update Codex**. It downloads the newest version from GitHub and replaces the program files.
Close the codex first. Your library, pictures, backups and passwords are never touched.

## Players on your home Wi-Fi

The **Library file** page in the codex shows a link like `http://192.168.1.20:3210/`. Players type it into
their browser. Changes on any device appear on the others straight away.

Can't connect from a phone? Check that:
- the phone is on the same Wi-Fi as this computer (not mobile data or a guest network)
- this computer's Wi-Fi is set to **Private network** in Windows settings
- Node.js is allowed through the firewall (Windows Security → Firewall → Allow an app through firewall →
  tick **Private** for Node.js)

## Players from anywhere (Tailscale Funnel)

Players get a normal https link that works on mobile data or at a friend's house. Only this computer needs
Tailscale.

1. Install Tailscale from https://tailscale.com/download and sign in.
2. Start the codex. The first time, Tailscale opens a page asking you to turn on Funnel (and HTTPS
   certificates if needed). Approve it, and the codex carries on by itself.
3. In the codex, go to **Library file** and set a GM password and a player password.
4. Copy the **From anywhere** link from the Library file page and send it to your players with the player
   password.

The link only works while the codex is running. For home Wi-Fi only, use
**Start DnD Codex (home Wi-Fi only)**.

**Safety:** from the internet, everyone must sign in. Players need the player password, and the GM view needs
the GM password. Five wrong passwords lock that device out for 15 minutes, and lots of wrong passwords from
different places pause internet sign-ins for 15 minutes. Once a player password is set, players on your home
Wi-Fi need it too.

## GM and players

This computer is always the GM. Other devices are asked who's joining:
- **Player:** sees everything except entries, books and character sheets hidden from players, and can only
  change their own characters.
- **GM:** everything. Needs the GM password, set under Library file → GM password for other devices.

The **Switch** button at the top of another device signs it out so you can choose again.

## Sync with GitHub (optional)

Keeps your library and pictures in a private GitHub repository, so the phone version and other computers can
load it without this computer being on. Set it up under **Library file → Sync with GitHub**, which explains how
to make the key. The key stays in `codex-config.json` and only ever goes to GitHub.

## What each file does

**The app** (what Update Codex copies into your folder)

| File | What it does |
|---|---|
| `DnD Codex.html` | The codex itself: every page, the tabletop, the built-in SRD rules and monsters. |
| `server.js` | The small program that runs the codex on your computer, shares it with players' devices, keeps your library saved, makes the daily backups and syncs with GitHub. |
| `DnD Codex.vbs` | What the taskbar shortcut runs: starts `server.js` with no black window and opens the codex in its own window. |
| `DnD Codex.ico` | The shortcut's icon. |
| `Make taskbar shortcut.bat` | Makes the DnD Codex shortcut on your desktop and in the Start menu, ready to pin. |
| `Start DnD Codex.bat` | Starts the codex with a black window that shows the links for players. Close it to stop. |
| `Start DnD Codex (home Wi-Fi only).bat` | The same, without the from-anywhere internet link. |
| `Update Codex.bat` | Downloads the newest version from GitHub and replaces the files in this table. |
| `dict-en.txt` | The English word list the spell checker uses. |
| `README.md` | This guide. |

**Made on your computer** (never uploaded here)

| File | What it is |
|---|---|
| `library.json` | Everything in your codex. |
| `images/` | Your pictures. |
| `backups/` | A dated copy of `library.json` from each day; the last 14 are kept. |
| `codex-config.json` | The GM and player passwords (scrambled), who's signed in, and your GitHub key. |
| `github-base.json` | Your library as it was at the last GitHub sync, used to combine changes. |
| `codex.log` | What happened the last time the taskbar shortcut started the codex. |
| `codex-port.txt` | Which port the running codex is on, so the taskbar shortcut can find it. Removed when it stops. |

**The phone version** (served by GitHub Pages at the link above, so they have to stay at the top level)

| File | What it does |
|---|---|
| `index.html` | The phone version of the codex. |
| `sw.js` | Lets the phone version open with no internet. |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png` | Its name and icons when it's added to a phone's home screen. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

**For making changes** (`source/`)

| Path | What it is |
|---|---|
| `source/*.js`, `source/shell.html` | The code, split into parts (`vtt.js` is the tabletop, `app.js` the library and pages, `characters.js` the sheets, and so on). |
| `source/build.py` | Joins the parts into `DnD Codex.html`: run `python3 build.py` in `source/`. |
| `source/server/server.js` | The source of `server.js`. |
| `source/web/` | Turns `DnD Codex.html` into the phone version: `python3 web/make_web.py "DnD Codex.html" web/index.html`, plus its service worker, manifest and icons. |
| `source/test/` | Browser tests (Playwright). `run27.py` covers the library and pages; the others cover the tabletop, sheets and inventory. |

To release a change: build, then copy `DnD Codex.html`, `server/server.js` and the phone version files to the
top of the repository.
