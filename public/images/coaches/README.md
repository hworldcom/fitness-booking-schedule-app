# Fictional demo coach portraits

Daniel Park's existing portrait is retained unchanged. Sam Lee, Nora Klein, Idris Malik and Elif Demir were generated separately with built-in imagegen under [DEV0335](../../../tickets/archive/backend/DEV0335-provision-nonproduction-demo-coaches.md). These are fictional faces for nonproduction test profiles, not photographs of real coaches or documented venues.

The [prompt files](prompts/) describe each subject and the natural gym-photo direction. [Provenance](provenance.json) records generated-source and shipped-file SHA-256 hashes. Generated originals remain in the imagegen library; delivered portraits are 1024 × 1024 WebP at quality 90. No additional creative editing was applied.

The nonproduction seed/provisioner attaches these paths only to the exact allowlisted demo profiles. Later tester uploads/removals are preserved, and real profiles without a portrait retain the initials fallback. The files grant no account or coach authority. Production startup/build never provision dummy profiles or credentials.

Jake Miller’s portrait was generated separately with built-in imagegen under [DEV0336](../../../tickets/archive/backend/DEV0336-add-fitness-and-sixth-demo-coach.md). The user requested a white adult with a casual college-sports look; the fictional sample implies no real fraternity membership. Its [prompt](prompts/jake-miller.txt) and added provenance entry record the source, delivered 1024-square WebP and hashes.
