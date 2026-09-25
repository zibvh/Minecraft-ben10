Drop your audio files here with these exact names:

  back1.mp3   - background music track 1 (loops, then plays back2)
  back2.mp3   - background music track 2 (loops, then plays back1)
  mutate.mp3  - plays once whenever Ben transforms into an alien

The game already looks for files at these paths and will just start
using them once they exist -- no code changes needed. If a file is
missing, that sound is silently skipped and the game keeps running
(you'll still hear the built-in synth beep for transforms either way).
