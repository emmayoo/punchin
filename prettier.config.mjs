/** @type {import('prettier').Config} */
const config = {
  semi: true,
  // singleQuote: true,
  trailingComma: "all",
  printWidth: 100,

  importOrder: [
    "<BUILTIN_MODULES>",
    "",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@/(?!.+\\.(css|scss)$).+$",
    "",
    "^(?!.+\\.(css|scss)$)[./].*$",
    "",
    ".+\\.(css|scss)$",
  ],
  importOrderParserPlugins: ["typescript", "jsx"],
  importOrderTypeScriptVersion: "5.0.0",
  importOrderSafeSideEffects: ["^.*\\.(css|scss)$"],

  plugins: ["@ianvs/prettier-plugin-sort-imports"],
};

export default config;
