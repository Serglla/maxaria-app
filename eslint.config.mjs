// Analisis estatico: `npm run lint`.
// Busca errores que no rompen el arranque pero si el comportamiento: variables
// o funciones sin definir, nombres declarados dos veces (el segundo pisa al
// primero sin aviso) y codigo que nadie usa.
import globals from "globals";

const rules = {
  "no-undef": "error",
  "no-redeclare": "error",
  "no-dupe-keys": "error",
  "no-duplicate-case": "error",
  "no-dupe-else-if": "error",
  "no-unreachable": "warn",
  "no-self-assign": "warn",
  "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
};

export default [
  { ignores: ["node_modules/**", "graphify-out/**", "data/**", "erp-test/**"] },
  {
    files: ["server.js", "lib/**/*.js", "scripts/**/*.js", "test/**/*.js", "public/js/shared/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node, self: "readonly" } },
    rules,
  },
  {
    files: ["public/js/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, Chart: "readonly", MaxPricing: "readonly" },
    },
    rules,
  },
  {
    files: ["public/sw.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.serviceworker } },
    rules,
  },
];
