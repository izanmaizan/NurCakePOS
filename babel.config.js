// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Removed deprecated plugins - babel-preset-expo handles these in SDK 51
    ],
  };
};
