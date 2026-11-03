# MovX mobile preview

A separate Expo/React Native app for iPhone, inside the MovX repository.
[MOV-26](https://linear.app/movx/issue/MOV-26) owns the foundation; the
[native contract](../docs/mvp-spec.md#23-native-ios-application) owns product rules.

This is a **sample-data preview**, with fictional people, sessions and locations.
Message and note edits exist only in memory and reset on reload. There is no
sign-in, backend connection, real booking, external message, persistent save or
video integration. The booked/shared and personal/private note screens are
separate examples. Do not enter real credentials or sensitive notes.

## Run on your iPhone

Use Node 24.21.x and npm 11.19.x:

```sh
cd mobile
npm ci
npm start
```

Install Expo Go on the phone, keep the phone and computer on the same Wi-Fi,
and scan the terminal QR code using Camera. If Expo Go asks for an account,
sign into Expo CLI and Expo Go with the same Expo account; never share its
credentials in tickets. The CLI command for that is `npx expo login`.

The first target is iPhone Air on iOS 26.6.1. SDK 57 supports iOS 16.4+, and
Expo's current transition guidance selects SDK 57 for physical Expo Go. A
development build will be needed to validate the app's own links/native
configuration in later integration. No paid Apple build/upload or signing is
performed by these preview commands.

The app uses a light portrait layout. Choose Explore, Sessions, Messages or
Account. Open a sample session to read its coach plan and shared feedback;
personal notes are a separate section in Sessions. Sample messages are never
sent to a person. Account can reset all sample edits.

## Checks and browser review

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check:boundaries
npm run doctor
npm run export:ios
npm run export:web
npm run test:ui
npm run preview:web
```

The last command serves the exported React Native web preview at
http://127.0.0.1:8082. It requires `export:web` first. Use
`MOBILE_PREVIEW_PORT=8083 npm run preview:web` for a different local port.
`npm run web` instead starts Metro's web development preview on port 8082.
The automated UI rehearsal needs Google Chrome and saves ignored screenshots
under test-results/preview. It starts/stops only its own loopback server.

`export:ios` builds an iOS JavaScript bundle and checks its source maps for
forbidden web/server dependencies. It is **not** a signed iOS binary or proof of
installation on a physical phone. Real iPhone/VoiceOver/keyboard/resume and
Auth/API checks remain separate acceptance work.

Use the app's own back arrow when reviewing in the browser. Browser Back can
reload the web renderer and reset the sample; app navigation preserves edits
and drafts in memory. Closing or reloading the app intentionally resets them.

## Independent application

This package has its own package.json, package-lock.json, node_modules,
TypeScript, ESLint, Metro, tests and output. Install with `npm ci` here; root
commands keep operating on the website. No root workspaces or shared React
version are introduced. React Native web/react-dom are present only for the
preview renderer, and the iOS source-map audit rejects DOM/server packages in
the native bundle.

Application imports are limited to this package's source/assets and declared
native dependencies. The boundary checker rejects direct, transitive,
type-only and symlink escapes into parent web/server/domain/DB code. It also
rejects non-literal module loads and inherited web aliases. A future shared
contract package requires an explicit boundary change.

The only configuration profile is preview. MOVX_MOBILE_ENVIRONMENT values other
than preview are rejected. No environment file, API URL, Supabase key or
privileged credential is needed. The CLI scripts disable dotenv loading.
Later live identity/API configuration must be added through MOV-7/MOV-26,
not by importing web services or enabling direct application-table access.
