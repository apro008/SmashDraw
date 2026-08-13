const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  ...expoConfig,
  prettierConfig,
  {
    // Edge Functions run on Deno with JSR/URL imports — linted by the Supabase CLI.
    ignores: ['dist/**', 'node_modules/**', '.expo/**', 'supabase/functions/**'],
  },
]);
