// Super-linter v9 busca stylelint.config.mjs (no .stylelintrc.json).
// El proyecto usa Tailwind v4: se permiten sus at-rules y se acepta @import "..." con cadena.
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: ["theme", "source", "utility", "variant", "custom-variant", "plugin", "config", "apply", "reference"],
      },
    ],
    "import-notation": "string",
    "custom-property-empty-line-before": null,
  },
};
