const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to set android:screenOrientation="sensorLandscape"
 * in AndroidManifest.xml for MainActivity.
 * This ensures the app can freely rotate between both landscape orientations
 * (Landscape Left & Landscape Right / 180 degree flip) on tablets and phones.
 */
function withSensorLandscape(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    const mainApplication = androidManifest.application?.[0];
    if (mainApplication?.activity) {
      const mainActivity = mainApplication.activity.find(
        (a) => a['$']?.['android:name'] === '.MainActivity'
      );
      if (mainActivity) {
        mainActivity['$']['android:screenOrientation'] = 'sensorLandscape';
      }
    }
    return config;
  });
}

module.exports = withSensorLandscape;
