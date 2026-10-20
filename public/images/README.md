# Public banner assets

2026-10-20 artifact retirement: the owner removed standalone design previews under [DEV0390](../../tickets/archive/organisatory/DEV0390-remove-unneeded-design-previews.md). The record below preserves the original design/validation history; backticked preview paths identify retired artifacts. Runtime images/code are retained, with banner source/prompt provenance in public/images/retained-banner-provenance.json.

## Events tug-of-war photograph

`events-tug-of-war.jpg` is the user-supplied photograph, copied unchanged from `amari-shutters-S1Xo-Ygp_q0-unsplash.jpg` under [DEV0353](../../tickets/archive/frontend/DEV0353-add-face-free-events-banner.md). The local original is 7680 × 5120, 7,166,194 bytes, visually matching the supplied attachment at a higher resolution. SHA-256: `aba1e97d807452f71bd6cd8ec999790bd992df5d404e4c8230bdbb8d2ffb3728`. The filename credits Amari Shutters / Unsplash. It illustrates group activity and does not identify a MovX session, coach or confirmed venue.

The displayed hero always uses only the photograph's lower half: a centered, cover-scaled image fills a frame twice the banner height, anchored at the bottom of the clipped banner. The visible top therefore corresponds to the source midpoint at any aspect ratio; every face in this particular photo is above it. This preserves the source bytes without blur, retouching or stretching. Next.js retains its normal fill sizing and supplies optimized responsive sources at the existing quality 95. Shared banner heights match Home/Explore. A future image change must recheck face locations; this framing rule is specific to the inspected source.

## Explore training photograph

`explore-training.jpg` is the user-supplied black-and-white 5240 × 3493 training photograph, copied unchanged from `grace-anne-bobadilla-nH3Nkhu-C1Y-unsplash.jpg` under [DEV0351](../../tickets/archive/frontend/DEV0351-align-explore-banner-and-search-with-home.md). File size: 2,928,622 bytes. SHA-256: `ffd2d73e4156b6a7a56b89fde482d5a9279a8b35815100ac61454ff6b90ceddc`. The source filename credits Grace Anne Bobadilla / Unsplash; no generated or edited image bytes are introduced. The photograph is illustrative and does not identify a MovX coach or training venue. The shared hero uses optimized responsive sources at quality 95, cover cropping and the same responsive dimensions as Home. Explore uses a higher crop to retain the athletes' faces and a white left fade for readable HTML text.

## Current battle-rope photograph

`home-battle-ropes.jpg` is the user-selected 4161 × 2779 photograph, copied byte-for-byte from their local `karsten-winegeart-eGSBVVtVCCw-unsplash.jpg` source. It visually matches the attachment approved on 18 October 2026 under [DEV0350](../../tickets/archive/frontend/DEV0350-soften-public-page-colors-and-replace-home-banner.md). SHA-256: `31913577cd4c7a24c3b7d0ba79c77c11f23c75cc785e9a4c984c11e2d5c96b58`.

Source attribution: [Karsten Winegeart / Unsplash photo eGSBVVtVCCw](https://unsplash.com/photos/eGSBVVtVCCw); [Unsplash license](https://unsplash.com/license). The photo is illustrative and does not identify a MovX coach or confirmed training venue. The original bytes are unedited. Next.js supplies optimized responsive delivery with the existing quality-95/size hints. CSS crops the image into the unchanged panoramic banner height, with a left fade for readable selectable slogan text; no generated content or stretching is introduced. Previous banner artwork is retained below as history.

## Earlier curved training collage — retained history

`home-training-collage.png` was the approved B3 banner, copied byte-for-byte from the 2170 × 725 preview artwork (retired artifact: `previews/home-banner-collages/assets/banner-b3-ropes-kick.png`). The user selected it for actual Home under [DEV0308](../../tickets/archive/frontend/DEV0308-adopt-curved-training-collage-home-banner.md). Battle ropes fill the middle; the kicking image replaces the high-knees group, while the other curved photo windows remain.

This AI-assisted composite was made with built-in imagegen under [DEV0307](../../tickets/archive/frontend/DEV0307-preview-curved-banner-with-ropes-and-kick.md). The exact edit prompt (retired artifact: `previews/home-banner-collages/prompts/b3-ropes-kick.txt`) and input/output hashes and roles (retired artifact: `previews/home-banner-collages/provenance-b3-ropes-kick.json`) preserve its source trail. Separate source photographs do not depict a single MovX event, coach or venue. Next.js `getImageProps` supplies optimized responsive images. The dark-green slogan remains selectable HTML positioned over the photograph's bright opening, with a pale fallback when the image is unavailable.

[DEV0309](../../tickets/archive/frontend/DEV0309-lower-home-banner-slogan-and-expand-framing.md) refines the actual page's CSS framing: a modestly taller desktop/tablet banner and lower slogan clear the kicking window and reveal more of the lower-right coaching scene. The artwork bytes stay unchanged; retained preview comparisons show earlier layout choices.

[DEV0310](../../tickets/archive/frontend/DEV0310-improve-home-banner-image-quality.md) raises only this banner's responsive delivery quality from 75 to 95. The bounded Next.js allowlist retains 75 for other images. A minimum 480 CSS-pixel `sizes` hint accounts for the 160 px-tall phone crop, preventing an undersized request at high pixel densities. This preserves more of the PNG's existing detail without changing its bytes or claiming detail beyond its 2170 × 725 native resolution; downloaded images are larger than the former quality-75 variants.

## Earlier rooftop banner — retained history

`home-coaching-banner.png` is the 2172 × 724 pixel approved banner, copied byte-for-byte from the rooftop preview asset (retired artifact: `previews/home-banner/assets/rooftop-coach-athlete-banner-v8.png`). It is an original fictional coaching scene, created with built-in imagegen under [DEV0301](../../tickets/archive/frontend/DEV0301-preview-coached-boxing-banner.md); the scene prompt (retired artifact: `previews/home-banner/image-prompt-rooftop-v7.txt`) and framing prompt (retired artifact: `previews/home-banner/image-edit-prompt-rooftop-v8.txt`) preserve provenance. No stock-reference photograph is shipped.

The user initially selected this image and “Find your coach. Achieve your goals.” for actual Home under [DEV0303](../../tickets/archive/frontend/DEV0303-adopt-compact-photographic-home.md). It illustrates coaching and is not a directory coach portrait or documented real training venue. DEV0308 replaces its Home use with B3; this original asset remains as history.

Retained source manifests and generation/edit prompts for the two earlier production banners are available in [retained banner provenance](retained-banner-provenance.json). The removed preview inventory and original file hashes are recorded in [the retirement manifest](../../docs/retired-design-previews.json).
