import globals from "globals";
import pluginJs from "@eslint/js";


export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script"
    }
  },
  {
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    rules: {
      "no-unused-vars": [
        "error",
        {
          caughtErrors: "none"
        }
      ]
    }
  },
  pluginJs.configs.recommended
];
