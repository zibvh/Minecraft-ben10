# Ben 10 City — Android build

This wraps `www/index.html` (the game) as an Android app using Capacitor,
and builds it automatically with GitHub Actions.

## One-time setup

1. Create a new GitHub repository and push this folder to it:
   ```
   git init
   git add .
   git commit -m "Ben 10 city app"
   git branch -M main
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. Go to the repo's **Actions** tab. The "Build Android APK" workflow runs
   automatically on push (or click "Run workflow" to trigger it by hand).
3. When it finishes (a few minutes), open the completed run and download
   the **ben10-city-debug-apk** artifact — that's your installable APK.
4. Copy it to your phone and open it (you'll need to allow "install from
   unknown sources" once). This is a debug build, unsigned, fine for your
   own device but not for the Play Store.

## Updating the game later

Whenever you have a new version of the HTML file, replace `www/index.html`
with it, commit, and push. The workflow rebuilds the APK for you — you
never need Android Studio or a local Android SDK.

## Notes / things I could not verify here

- This was generated without network or Android SDK access, so the
  Capacitor project itself (the `android/` folder) has never actually been
  generated or compiled by me — the first real build happens the first
  time this workflow runs in GitHub Actions. If `npx cap add android`
  or the Gradle build fails there, paste me the Actions log and I'll fix
  the workflow or config.
- App icon/splash screen are Capacitor's defaults for now. I can generate
  a custom Omnitrix-style icon and splash if you want.
- The `<meta viewport>` and safe-area handling already in the game HTML
  should carry over fine inside the Android WebView, but I have not
  confirmed that on a real device.

## Gameplay notes: Lock-on (Stage 6)

- Tap an enemy or civilian to lock it (a red reticle + name + HP bar appear). Tap it again, or press the reticle
  button above the joystick, to release. Desktop: L / Tab / middle-click.
- Lock-on is optional. Swiping the screen still rotates the camera freely; camera assist backs off while you swipe.
- While locked: the camera eases toward the target, melee swings turn to face it, abilities/projectiles fire at it,
  Sonic Doom targets it, and XLR8 sprints bend gently toward it so a tackle can be aimed.
- The lock breaks automatically if the target dies or gets more than ~44 units away.

## Character Life / Jointed Animation Pass

The current build includes a procedural character-animation pass layered onto the existing character/combat architecture. Player aliens now use segmented upper/lower limbs with visible joint pivots, wrists/elbows/hips/neck/shoulder details, gait counter-motion, idle breathing, subtle head tracking, pelvis movement, and joint follow-through. NPCs and hostile enemies use the same lightweight jointed approach. Existing combat animation code remains the primary action driver, with the life layer providing secondary motion rather than replacing attacks.

The animation is procedural and offline-friendly; it does not require a skeletal animation asset pipeline or network service.
