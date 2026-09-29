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

## Gameplay notes: Vertical city (Stage 7)

Buildings are now places, not just blocks. Everything is generated per chunk and deterministic, so streaming a chunk
back in gives the identical building, and nothing needs the network.

- Rooftops are walkable. Any solid building top, roof slab, balcony, landing or crate can be stood on, fought on and
  landed on. Heatblast / Diamondhead can fly up, then press their FLY/LEVITATE button again to land on a roof.
- Apartments and towers have zig-zag exterior fire escapes (with landings) up to the roof, plus balconies.
  Towers reach 6-12 flights: a good long XLR8 run. Running off the top of a ramp at speed launches you into the air.
- Houses have a walkable pitched roof, a side ladder to the eave, a garage annex and porch deck to hop up from.
  Shops have a rear ladder and rooftop AC units/crates. The school has a fire escape and a ladder up its bell tower.
- Ladders: face one and push the stick forward to climb, back to descend, JUMP to hop off. A hint appears when near one.
- Mantling: jump into a ledge within arm's reach and you haul yourself up. Four Arms now jumps much higher, so he can
  leap onto garages, eaves and shop roofs directly.
- Echo Echo replicas hop up to ledges the controlled Echo stands on, and warp up beside you if the roof is too high.
- Roughly 1 in 3 enemy spawns is a rooftop ambusher (normal/ranged) within 12-38 units; enemies stand on whatever
  surface is under them and drop down when they walk off an edge.
- Fixes: unloaded chunks now actually remove their buildings/textures (cityGroup children were never detached).

Technical: colliders carry optional `bot` (vertical extent), and flags `nb` (non-blocking), `ramp`, `pyr`, `ladder`.
`groundTopAt(x,z)` is unchanged; `groundTopAt(x,z,feetY)` returns the highest surface within a step of the feet.

## Gameplay notes: Vehicles (Stage 8)

- Parked cars are now drivable. Walk close and tap ENTER VEHICLE (left side, above the lock button); it becomes EXIT while
  seated. While driving the alien ability buttons, lock and hotbar hide; the attack button is HORN and jump is BRAKE
  (handbrake). Stick up/down = throttle / brake-then-reverse, left/right = steer. Keyboard: WASD, V enter/exit, Space brake.
- Arcade model: speed-scaled steering, wall probes with sliding, crash damage, car-vs-car bumps, ramps/drop-offs.
  Cars have 100 HP: smoke below 45, explode at 0 (the wreck burns, hurts nearby enemies/you, then clears after ~16 s).
  A driver ejected by an explosion takes damage. Enemy hits on a driver mostly damage the car.
- Running enemies/NPCs over hurts them and throws them. Cars you shove or ram also hit things while sliding.
- NPC traffic (LOW 2 / MEDIUM 4 / HIGH 6 cars) drives the road lanes, brakes for people/cars ahead, despawns when far or
  stuck. You can take any traffic car. Cars asleep beyond ~70 units are not simulated.
- Aliens: Four Arms punches shove/dent cars, his finisher and SLAM flip them (flip again to right them), SMASH heavily
  damages them, and he can still lift and throw one. Heatblast fireballs/flame/melee set cars burning. XLR8 tackles cars
  (a flip at near-max speed) and easily outruns traffic. Cannonbolt ramming smashes/flips them. Ice Diamondhead spray still works.
- Parked cars are unloaded with their chunk unless someone is in them.

## Side quest: character animation rebuild

Every character (Ben, all aliens, Echo replicas, civilians, gang members, hostile enemies) now uses one jointed rig
(`buildRig`) driven by one procedural animator (`animateRig`) instead of rigid single-box limbs.

- Joints: hips, chest twist, neck/head, shoulder -> elbow -> hand, hip -> knee -> foot. Four Arms has two full arm chains per side.
- Locomotion: idle (breathing, weight shift, head scan), walk, run and XLR8 sprint blend by real speed; opposite arm/leg swing,
  knee flex, pelvis/chest counter-twist, hip bob, forward lean, backpedal when moving away from facing, landing squash,
  rising/falling jump poses, ladder climbing, flying/levitating/swimming, carrying, panic run.
- Punching: coil -> accelerating strike -> hold -> recover, with the hit landing at the same point the damage is applied
  (40% / 45% of the swing). Torso and hips rotate into the punch, the opposite foot steps forward, the free hand guards.
  The heavy finisher is a two-handed overhead slam with a full-body lunge. Four Arms hooks with the diagonal lower arm.
- Enemies: hit flinch, melee swings (brute overhead slam, speed jabs), aimed pistol pose with recoil, a crumple-and-fall death
  that clears after ~2 s. Also fixed: respawned enemies no longer register twice in the enemy list.
- `player.hurtT` drives the player's own hit flinch. Standing Cannonbolt now walks and punches; curling still swaps to the ball.
