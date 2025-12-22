// apps/mobile-app/babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      'nativewind/babel',
      // If you are using Reanimated, ensure it is listed LAST
      'react-native-reanimated/plugin', 
    ],
  };
};