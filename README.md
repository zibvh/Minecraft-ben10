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


## Feel pass + Stage 11 (Omnitrix)

**Vehicles (weight).** Torque now falls off with speed and drag grows with speed squared, so the car builds speed over ~4 s to a
~58 km/h top speed (was ~86 km/h in 2 s with an instant stop). Lifting off engine-brakes, the handbrake stops you from 57 km/h in ~1 s,
reverse tops out ~22 km/h. The wheel angle eases toward the stick, high speed understeers, and part of your old heading's velocity carries
on sideways (drift; much more on the handbrake). The chassis has spring-damper pitch (nose lifts on power, dives on brake), corner roll
and a landing bounce. Traffic cruises 20-32 km/h and brakes harder. Fixed: cars generated in the first chunks had `hp`/`by` undefined
(constants declared after first use), so they could never be destroyed and had NaN heights.

**Enemy pacing (no more mobs).** Attack slots: at most 2 melee and 1 ranged enemy commit to attacking at once; the rest circle at ~3.6
units and wait their turn. A slot holder gets a 0.4-0.75 s wind-up before its first swing, and must wait its cooldown before it can take
a slot again. Hostile population is capped by quality (LOW 3 / MEDIUM 5 / HIGH 6), spawns every 6 s at 28-48 units, never while a fight is
under way; killed enemies respawn 32-48 units away instead of near you. Gang members who join a fight now hesitate 1-4.5 s each.

**Sound.** All sfx are now layered/filtered synth (footsteps vary with speed, whoosh on swings, thump+crack on hits, explosion, screech,
ambient bed, a revving engine with a fake gearbox). Drop real recordings in `www/sounds/` (see sounds/README.txt) and they replace the synth.

**Scale.** `CHAR_SCALE = 1.35` (player, replicas, enemies) and `NPC_SCALE = 1.05` are single constants. Collision body height, melee reach,
camera distance/height were retuned with them. Camera also gained a small velocity look-ahead and a landing dip.

**Stage 11 - Omnitrix.**
- Tap the alien portrait (top-left) to open the dial (Ben + 6 aliens); tap one to transform. Swiping the portrait still cycles. Keyboard: O = dial, Q = Ben.
- Omnitrix charge (OM bar) drains while transformed (Four Arms 85 s, Diamondhead 80, Echo Echo 75, Heatblast/Cannonbolt 65, XLR8 60), recharges as Ben
  (~20 s empty to full, after a 1.5 s hold), needs 25% to transform. Warning at 10 s (bar flashes red), beeps + countdown in the last 3 s, then a
  red-flash timeout back to Ben and a 2.5 s lockout. Reverting voluntarily keeps your remaining charge; dying refills it.
- Transform animation: the body squashes, bursts past full size and settles, with a ring of light and a small camera nudge.
- Settings > OMNITRIX TIMER: OFF disables the drain completely for pure sandbox play.
- Not built yet (skipped per "start from Stage 11"): Stage 9 wanted/heat and Stage 10 missions.


## Stage 12 - Health (Ben vs alien) + body inertia
- Every form has its own HP pool (HP.store): Ben 100, Four Arms 160, etc. Damage taken as an alien never touches Ben; reverting returns Ben
  with the health he had. A damaged alien stays damaged when you re-transform, and heals in the background at 3%/s while unused.
- An alien at 0 HP is knocked out: Omnitrix red-out, back to Ben (alive), 3 s lockout, that form returns at 35%. Ben at 0 HP dies:
  DEFEATED screen, respawn at full HP for every form, 2.5 s spawn protection, nearby enemies stand down (no spawn-camping).
  (Fixed: the old respawn never restored Ben's health, so Ben could respawn already dead.)
- Out-of-combat regen after 7 s without damage. HUD: HP number, and a purple BEN bar while transformed.
- Feedback: camera shake + hurt sound scaled by damage, low-health (<30%) pulsing red edges, flashing bar and a heartbeat that speeds up.
- Echo Echo replicas keep their independent HP (unchanged).
- Body inertia: the model pitches forward through a damped spring when speed changes (push-off, braking, sudden stops), per-alien
  weight profile (Four Arms heavy and slow to settle, XLR8/Echo snappy). Gameplay velocity is untouched.


## Redesign pass - HUD, Omnitrix dial, voxel aliens
**Controls (CODM-style).** Joystick bottom-left with a RUN button above it (hold = sprint, x1.5; Shift on keyboard). Right side: big ATTACK,
JUMP above it, and the alien's powers in an arc around the thumb; LOCK sits above JUMP; ENTER VEHICLE is a pill at bottom-centre.
Buttons are themed per alien (fire orange, XLR8 blue, Diamondhead teal...). All ability icons are SVG (no emoji). Layout audited for
non-overlap at 640x360 up to 932x430.
**Top-left card.** Hex portrait (bust shot), name, ability tagline, HP / (BEN) / EN / OM bars. **Tap the portrait** (Ben or any alien) to open
the **radial Omnitrix dial**: Ben/hourglass in the centre, six aliens around the ring; the world slows to a crawl and the Omnitrix timer pauses
while it is open. Tap an alien to transform, the hourglass to revert, X or the backdrop to close. Swiping the card still cycles aliens.
**Minimap.** Heading-up radar top-right: hostile enemies red, gang members orange, N marker.
**Start menu.** New title screen (PLAY / SETTINGS / HOW TO PLAY / ABOUT).
**Characters.** Every rig box now carries a pixel-noise voxel texture with darker cube edges. Each alien was rebuilt with recognisable detail:
Ben (spiky brown hair, green jacket, wrist Omnitrix), Four Arms (red, white/black shirt, four red arms, brow, tusks), Heatblast (charred
rock body, flickering lava cracks and flames), XLR8 (swept head, green visor, swaying tail, blades), Diamondhead (crystal spikes,
glowing core), Echo Echo (white body, black speaker discs, visor), Cannonbolt (yellow plated armour, black stripes, helmet).
Glowing parts survive hit-flashes. See alien-preview.png; tests/render_models.js re-renders it without a GPU.


## Anatomy pass + movement rework
- **Run is CODM-style:** the RUN marker above the joystick is an indicator, not a button. Drag the stick up onto it (or far past the ring, mostly
  upward) to lock sprint; it stays locked while the thumb is down and the stick is still pushed, and releases if you ease below ~35% or lift.
  Ben etc: sprint = 1.5x. **XLR8: RUN is now the true sustained super speed** (progressive ramp, energy drain, gradual slowdown, streaks, chunk preload).
- **XLR8 DASH is now a burst:** 0.32 s of ~4.6x speed that decays back to normal, 7 energy, 0.45 s cooldown, chainable, with afterimage streaks.
- **Four Arms:** canonically a huge Tetramand, so his size stays. Jump is stronger (tap = 13 launch, ~4.6 units up). HOLD jump to crouch and charge (ring
  around the button, coiled pose, dust), RELEASE to leap: up to ~33 units high and ~70 forward, clearing the ~25-unit towers; landing is a ground-pound
  shockwave (damage + knockback + debris) scaled by fall speed. Keyboard: hold/release Space.
- **Anatomy:** every alien's mannequin boxes are replaced with tapered, multi-block anatomy on the same joints (animation/physics untouched):
  deltoids, biceps, forearms, fingered fists/claws, knees, calves, boots; digitigrade zig-zag legs for XLR8; V-taper pecs/traps/lats for Four Arms;
  faceted crystals for Diamondhead; speaker hands and joint rings for Echo Echo; plated armour for Cannonbolt; lava plates and flames for Heatblast.


## HUD fix (device screenshot feedback)
- **Action buttons were missing:** the right-hand button containers had collapsed to 0x0 (inset + auto sizes), so every absolutely-positioned button
  (attack, jump, powers, special) sat off-screen. Both are now full-screen layers. tests/t_hudlayout.js guards this.
- Profile card 232px -> 176px wide, bar labels now light-coloured and readable; RUN marker 54px -> 38px and 40px clear of the stick (was touching);
  LOCK moved off the minimap; minimap 80px.
- Portraits were showing the model's BACK (rig faces -Z, portrait camera sits at +Z) and cropping heads. Now 3/4 front view framed from the real
  bounding box (hair, flames, crystal crowns fit). Also removed a NaN crystal mesh on Diamondhead.


## METROPOLIS - large-world, city-scale and speedster-streaming upgrade
**Scale (1 unit ~ 0.73 m; Ben ~2.5 u = ~1.8 m, Four Arms ~4.2 u, ratio ~1.7).**
World is now 11,264 x 11,264 units (~8 km). Road hierarchy: street 12 wide every 80 u, avenue 24 wide every 320 u, boulevard 32 wide every 1,280 u
(long straight runs for XLR8). Four lots per block; buildings are scaled 2x with consistent doors/stairs/fire escapes (a scaled house door is 4 u).
Downtown (centre sector) has skyscrapers up to ~150 u (~110 m); then commercial, mixed, residential, industrial warehouses and parkland sectors
(8x8-block ~470 m sectors, deterministic from coordinates). Cars are 2.7 x ~6 u (speedometer shows real km/h).

**Detail tiers.** T0 (<80 u): diggable voxel ground, full lots, NPC/vehicle simulation. T1 (<=150-230 u by quality): full lots, merged meshes, spatial-grid
colliders. T2 (to 420-880 u): skyline = ONE instanced mesh of building volumes + analytic road network (repeating street texture + pooled avenue strips)
= zero per-chunk cost to the horizon. T3: fog. T4: nothing in memory - the layout is a pure function of coordinates so it regenerates identically.

**Streaming.** Lots are built by a frame-budgeted job queue (adaptive 1.6-5 ms/frame from the measured frame time), nearest/corridor-first.
Predictive corridor: samples at +0.5 and +1 x horizon (1-3 s, scaled with speed) so lots ahead of XLR8 exist before they are seen. Collision safety:
any lot within ~58 u that is not built yet is built immediately (max 2/frame), so the player can never outrun collision data. Voxel ground stops
generating while moving >28 u/s (the ground layers carry the visuals). Skyline rebuilds incrementally in slices and swaps atomically.

**Memory/pooling.** Cached shared materials (walls/signs/flat), static batching (a lot's boxes merge per material: ~25 draw calls -> ~6), pooled chunk
InstancedMeshes, spatial-grid colliders (O(1) lookups), undisturbed column heights are forgotten on unload (fixed a growth leak). Civilians recycle around
the player, NPCs beyond 95 u sleep, traffic is lane-accurate per road level and recycled beyond 190 u.

**XLR8.** RUN (drag the stick to the RUN marker / Shift) = sustained super speed, now up to x13 (~96 u/s: edge to edge in ~2 minutes); DASH = burst.

**Tools.** Settings > PERFORMANCE STATS (or F3) shows fps, frame ms, chunks/lots/queue, builds/drops/urgent, lot build ms, skyline count, entities, draw calls, heap.
tests/t_world.js audits the layout (roads vs buildings, widths, determinism); tests/t_stress.js runs the 10-scenario speed test (node --expose-gc t_stress.js 240).
