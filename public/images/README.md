# Home banner assets

## Current curved training collage

`home-training-collage.png` is the approved B3 banner, copied byte-for-byte from the [2170 × 725 preview artwork](../../previews/home-banner-collages/assets/banner-b3-ropes-kick.png). The user selected it for actual Home under [DEV0308](../../tickets/archive/frontend/DEV0308-adopt-curved-training-collage-home-banner.md). Battle ropes fill the middle; the kicking image replaces the high-knees group, while the other curved photo windows remain.

This AI-assisted composite was made with built-in imagegen under [DEV0307](../../tickets/archive/frontend/DEV0307-preview-curved-banner-with-ropes-and-kick.md). The [exact edit prompt](../../previews/home-banner-collages/prompts/b3-ropes-kick.txt) and [input/output hashes and roles](../../previews/home-banner-collages/provenance-b3-ropes-kick.json) preserve its source trail. Separate source photographs do not depict a single MovX event, coach or venue. Next.js `getImageProps` supplies optimized responsive images. The dark-green slogan remains selectable HTML positioned over the photograph's bright opening, with a pale fallback when the image is unavailable.

[DEV0309](../../tickets/archive/frontend/DEV0309-lower-home-banner-slogan-and-expand-framing.md) refines the actual page's CSS framing: a modestly taller desktop/tablet banner and lower slogan clear the kicking window and reveal more of the lower-right coaching scene. The artwork bytes stay unchanged; retained preview comparisons show earlier layout choices.

[DEV0310](../../tickets/archive/frontend/DEV0310-improve-home-banner-image-quality.md) raises only this banner's responsive delivery quality from 75 to 95. The bounded Next.js allowlist retains 75 for other images. A minimum 480 CSS-pixel `sizes` hint accounts for the 160 px-tall phone crop, preventing an undersized request at high pixel densities. This preserves more of the PNG's existing detail without changing its bytes or claiming detail beyond its 2170 × 725 native resolution; downloaded images are larger than the former quality-75 variants.

## Earlier rooftop banner — retained history

`home-coaching-banner.png` is the 2172 × 724 pixel approved banner, copied byte-for-byte from the [rooftop preview asset](../../previews/home-banner/assets/rooftop-coach-athlete-banner-v8.png). It is an original fictional coaching scene, created with built-in imagegen under [DEV0301](../../tickets/archive/frontend/DEV0301-preview-coached-boxing-banner.md); the [scene prompt](../../previews/home-banner/image-prompt-rooftop-v7.txt) and [framing prompt](../../previews/home-banner/image-edit-prompt-rooftop-v8.txt) preserve provenance. No stock-reference photograph is shipped.

The user initially selected this image and “Find your coach. Achieve your goals.” for actual Home under [DEV0303](../../tickets/archive/frontend/DEV0303-adopt-compact-photographic-home.md). It illustrates coaching and is not a directory coach portrait or documented real training venue. DEV0308 replaces its Home use with B3; this original asset remains as history.
