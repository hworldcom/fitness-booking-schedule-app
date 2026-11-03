import type { ExpoConfig } from "expo/config";

if (
  process.env.MOVX_MOBILE_ENVIRONMENT &&
  process.env.MOVX_MOBILE_ENVIRONMENT !== "preview"
) {
  throw new Error(
    "This app is a sample-data preview. Live environments are not implemented yet.",
  );
}

const config: ExpoConfig = {
  name: "MovX Preview",
  slug: "movx-mobile-preview",
  version: "0.1.0",
  scheme: "movx-preview",
  orientation: "portrait",
  userInterfaceStyle: "light",
  platforms: ["ios", "web"],
  ios: { supportsTablet: false, bundleIdentifier: "club.movx.mobile.preview" },
  web: { output: "single" },
  plugins: ["expo-router"],
  extra: { mode: "sample-data", backendConnected: false },
};

export default config;
