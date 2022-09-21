module.exports = {
  "env": {
    "es6": true,
    "node": true
  },
  "ignorePatterns": [
    "node_modules/",
    "dist/",
    "bin/",
    "docs/",
    "vendor/",
    "webpack.config.js"
  ],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2018,
    "sourceType": "module"
  },
  "plugins": [
    "@typescript-eslint"
  ],
  "rules": {
    "indent": [
      "error",
      2
    ],
    "linebreak-style": [
      "error",
      "unix"
    ],
    "quotes": [
      "error",
      "double"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-unused-vars": "off",
    "react/prop-types": "off",
    "no-trailing-spaces": "error"
  }
};
