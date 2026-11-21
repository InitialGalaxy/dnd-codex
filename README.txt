DnD Codex - running it from this folder
=======================================

Start it
  Double-click "Start DnD Codex". A black window opens and the codex opens in your browser.
  Keep that window open while you play. Close it to stop the codex.

  The first time, Windows may ask whether Node.js can use the network.
  Tick "Private networks" and click Allow, or your phone won't be able to connect.

Pin it to your taskbar
  Double-click "Make taskbar shortcut" once. It puts a DnD Codex shortcut on your desktop and in the
  Start menu. Right-click the desktop one, choose Show more options, then Pin to taskbar.
  The shortcut starts the codex with no black window and opens it in its own window. It stops by
  itself a couple of minutes after every codex window (yours and the players') has been closed.
  If something goes wrong, codex.log in this folder says why.

Open it on your phone (or any device on the same Wi-Fi)
  The black window, and the Library file page in the codex, show a link like
  http://192.168.1.20:3210/  - type it into your phone's browser.
  Changes on any device appear on the others straight away.

  Can't connect from the phone? Check:
   - the phone is on the same Wi-Fi as this computer (not mobile data or a guest network)
   - this computer's Wi-Fi is set to "Private network" in Windows settings
   - you clicked Allow on the Windows firewall question (Windows Security > Firewall >
     "Allow an app through firewall" > tick Private for Node.js)

Open it from anywhere (Tailscale Funnel)
  Players don't install anything: they get a normal https link that works on mobile data
  or at a friend's house. Only this computer needs Tailscale.

  One-time setup:
   1. Install Tailscale on this computer from https://tailscale.com/download and sign in.
   2. Start the codex. The first time, Tailscale opens a page asking you to turn on Funnel
      (and HTTPS certificates if needed). Approve it; the codex carries on by itself.
   3. In the codex, go to Library file and set a GM password and a player password.
   4. Copy the "From anywhere" link from the black window or the Library file page and send
      it to your players with the player password.

  The link only works while the Start DnD Codex window is open. Closing the window turns it off.
  To run it for your home Wi-Fi only, use "Start DnD Codex (home Wi-Fi only)".

  Safety: from the internet everyone must sign in. Players need the player password, the GM
  view needs the GM password. Five wrong passwords lock that device out for 15 minutes, and
  lots of wrong passwords from different places pause internet sign-ins for 15 minutes.
  Once a player password is set, players on your home Wi-Fi need it too.

Updating
  Double-click "Update Codex". It downloads the newest version from
  https://github.com/InitialGalaxy/dnd-codex and replaces the program files here.
  Close the DnD Codex window first. Your library.json, images, backups and
  passwords (codex-config.json) are never touched.

Sync with GitHub (optional)
  Keeps your library and pictures in a private GitHub repository, so other computers
  (and the phone version) can load it without this computer being on.
  Set it up in the codex on this computer: Library file > Sync with GitHub. It explains
  how to make the key. The key stays in codex-config.json here and only goes to GitHub.
  github-base.json is the library as it was at the last sync (used to combine changes).

What's in this folder
  library.json      everything in your codex (same format as a downloaded library file)
  images\           pictures
  backups\          a dated copy of library.json from each day, the last 14 kept
  DnD Codex.html    the codex itself
  server.js         the small program that shares it on your network
  Update Codex.bat  gets the newest version from GitHub
  codex-config.json the GM and player passwords (scrambled), who's signed in, and the GitHub key

GM and players
  This computer is always the GM. Other devices are asked who's joining:
   - Player: sees everything except entries and books marked hidden from players,
     and can only change characters.
   - GM: everything. Needs the GM password, which you set on this computer in the
     codex under Library file > "GM password for other devices".
  The "switch" button at the top of a phone or other device signs it out to choose again.
  Passwords and sign-ins are kept in codex-config.json in this folder.
