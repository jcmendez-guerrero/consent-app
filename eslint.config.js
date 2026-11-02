import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".specify/**",
      ".claude/**",
      ".github/linters/**",
    ],
  },

  js.configs.recommended,

  // Frontend: React + Vite (navegador)
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { react },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      // Sin PropTypes ni TypeScript en el proyecto.
      "react/prop-types": "off",
    },
  },
  reactHooks.configs.flat.recommended,
  {
    files: ["src/**/*.{js,jsx}"],
    rules: {
      // Regla del React Compiler, que el proyecto no usa; el patrón "latest ref"
      // (SignatureBox) es válido.
      "react-hooks/refs": "warn",
    },
  },

  // Backend: Express (Node)
  {
    files: ["server/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },

  // Configuración en la raíz (vite.config.js, eslint.config.js)
  {
    files: ["*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },

  // Reglas comunes
  {
    files: ["**/*.{js,jsx}"],
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
    },
  },
];
