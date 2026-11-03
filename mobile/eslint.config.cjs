const { defineConfig, globalIgnores } = require("eslint/config");
const expo = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expo,
  {
    files: ["metro.config.cjs"],
    languageOptions: { globals: { __dirname: "readonly" } },
  },
  globalIgnores(["dist/**", ".expo/**", "test-results/**", "expo-env.d.ts"]),
]);
