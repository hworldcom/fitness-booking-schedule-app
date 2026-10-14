# DEV0044 — Hero asset provenance

- Delivered asset: [club-friends-hero.webp](../../public/images/club-friends-hero.webp).
- Built-in image generation tool, reference-guided generation using the original design reference, removed under DEV0225; no CLI fallback.
- Generated source: `exec-0e23ae07-3919-477c-aca7-e30ee3ced7cc.png`, retained in the local Codex generated-images directory.
- Optimized with Sharp to WebP, quality 85. CSS performs responsive cropping and gradient masking; the original running image remains available to other surfaces.
- People and location are illustrative; they are not real member or partner evidence. The shoe/star marks are native decorative SVG; the logo is selectable text.

## Final generation prompt

Use case: photorealistic-natural. Create a standalone website hero photograph, not a screenshot or mockup. Reference image is style/composition guidance only: recreate the friendly group-photo spirit of the top-right banner. Four diverse adult friends aged roughly 28-40 standing shoulder to shoulder after a run, laughing naturally together, waist-up, black and muted lilac unbranded sportswear, one man in cap. Berlin riverside urban background softly out of focus, warm natural daylight. Landscape 1536x1024. All four heads entirely visible with generous headroom; group occupies rightmost 75 percent, leftmost 25 percent empty background with pale lilac haze #e9e2f6 softly merging into real scene. Natural candid editorial photograph, realistic skin and anatomy. NO lettering, UI, buttons, logo, stickers, doodles, frame or watermark. The output is just the photo, to blend into a lilac website banner using CSS.

> Documentary pruning — 2026-10-14: obsolete interface screenshots and the original design-reference PNG were removed under [DEV0225](../../tickets/archive/organisatory/DEV0225-remove-blockchain-historical-evidence.md). The independent photo-generation prompts, delivered photo files and truthful fictional-image provenance remain unchanged.
