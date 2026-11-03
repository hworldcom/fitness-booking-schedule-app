const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Keep the SDK resolver and its project-local file map. No parent watch folders
// or workspace aliases; source-boundary and iOS bundle checks enforce isolation.
module.exports = config;
