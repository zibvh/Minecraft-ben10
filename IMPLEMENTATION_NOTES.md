# HUD + Character Overhaul

This package keeps the existing voxel game architecture and joint/physics systems while adding:

- CODM-style joystick-to-RUN gesture; tapping RUN does nothing.
- RUN placed above the joystick at the requested 1.4% / 55% anchor.
- Deterministic right-side power/action grid.
- XLR8 RUN now controls sustained super-speed.
- XLR8 DASH is now a short burst impulse.
- Four Arms keeps his intentionally larger scale.
- Four Arms JUMP is tap/hold-release charge-based, reaching a high-power building-clearing leap.
- Lightweight low-poly visual rebuild layer for all six alien forms, attached to the existing joint rig so existing animation/physics logic remains reusable.
- Updated control instructions.

Source of truth used for the implementation: the current `index.html` supplied in the conversation.
