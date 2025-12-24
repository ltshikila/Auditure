module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      // Required for Reanimated (must be last)
      "react-native-reanimated/plugin",
    ],
  };
};