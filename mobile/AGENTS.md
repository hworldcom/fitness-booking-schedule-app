# MovX mobile

Root AGENTS.md and the live MOV issue remain authoritative. MOV-26 owns this
foundation; MOV-7 owns verified mobile identity/API transport. Read
docs/mvp-spec.md section 23 from the repository root for product boundaries.

This package is independent of the root Next.js package. Run commands from
mobile/ or use npm --prefix mobile. Do not import parent src/ code, inherit the
web TypeScript/ESLint config, or depend on parent node_modules. Keep runtime
dependencies declared here and the mobile lockfile reproducible.

Current implementation is a labelled sample-data preview. It has no real
authentication, API, database or persistent account data. Samples stay in
src/preview and in memory; do not load environment files or real/demo credentials
to make the preview appear connected. Backend integration belongs to its owning
issues and must preserve shared versus personal note permissions.

Before changing Expo/React Native APIs, inspect installed versions and the
matching official Expo documentation. Current SDK 57 documentation:
https://docs.expo.dev/versions/v57.0.0/ .

Use the scripts in package.json for native typecheck, lint, formatting, boundary
tests and export. The React Native web rehearsal proves mounted interactions and
responsive/keyboard behavior; it does not prove iPhone, VoiceOver, Expo Go,
native keyboard, Auth/SQL or TestFlight behavior. Never mark those checks passed
from a web screenshot or a successful JavaScript export.
