import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration scaffold for native iOS/Android shells of APEX.
 *
 * To activate:
 *   1. pnpm add -D @capacitor/cli @capacitor/core
 *   2. pnpm add @capacitor/ios @capacitor/android @capacitor/preferences
 *   3. pnpm exec cap init "APEX" "im.manus.apex" --web-dir=dist/public
 *   4. pnpm build
 *   5. pnpm exec cap add ios && pnpm exec cap add android
 *   6. pnpm exec cap sync
 *
 * Native plugins relevant to APEX:
 *   - @capacitor/preferences for offline draft sync
 *   - @capacitor/voice-recorder for native audio capture (better than Web Speech)
 *   - @capacitor/push-notifications for daily focus push
 *   - @capacitor/share for native board pack sharing
 */
const config: CapacitorConfig = {
  appId: "im.manus.apex",
  appName: "APEX",
  webDir: "dist/public",
  bundledWebRuntime: false,
  server: {
    // For dev, point at the running Vite server. For prod builds, omit.
    // url: "http://192.168.1.5:5173",
    // cleartext: true,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#060B14",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#060B14",
    },
  },
};

export default config;
