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
