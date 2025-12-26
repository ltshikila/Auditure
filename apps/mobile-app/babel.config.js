module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
    ],
    plugins: [
      // Required for Reanimated (MUST BE LAST)
      "react-native-reanimated/plugin",
    ],
    env: {
      production: {
        plugins: [
          "react-native-paper/babel",
          "react-native-reanimated/plugin",
        ],
      },
    },
  };
};