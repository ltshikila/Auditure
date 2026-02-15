const { withMainActivity } = require("expo/config-plugins");

/**
 * Expo config plugin that clears FLAG_SECURE from the MainActivity.
 * This allows app content to be visible during screen share/recording.
 */
module.exports = function clearFlagSecurePlugin(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    // Add WindowManager import if not present
    if (!contents.includes("import android.view.WindowManager")) {
      contents = contents.replace(
        "import android.os.Bundle",
        "import android.os.Bundle\nimport android.view.WindowManager"
      );
    }

    // Add clearFlags call after super.onCreate(null)
    if (!contents.includes("clearFlags(WindowManager.LayoutParams.FLAG_SECURE)")) {
      contents = contents.replace(
        "super.onCreate(null)",
        "super.onCreate(null)\n    // Allow app content to be visible during screen share/recording\n    window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)"
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};
