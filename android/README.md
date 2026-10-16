# GPT Harness for Android

An Android WebView frontend for **https://gpt-harness.pages.dev**, using the existing Cloudflare Pages/Worker, D1 accounts/history, and private R2 files. The Android app loads the live mobile UI, so deployed frontend updates appear without reinstalling the APK. An internet connection is required. No API keys or account credentials are embedded in the APK.

The app supports Android 8.0+ (API 26), targets Android 16 (API 36), and uses the same login and manually entered API key. WebView has its own account-scoped storage, so sign in and enter your API key once in the app. Browser keys are not copied into the app.

The shell adds a short launch crossfade, keyboard-aware layout, matching system bars, Android Back handling, the system file picker, native clipboard, private image downloads, and document/PDF saving. Animation speed follows Android's animation settings; web animations also respect reduced-motion preferences.

## Build

Install JDK 17 or 21 and Android SDK platform/build-tools 36. Point `ANDROID_HOME` to your SDK, or create an ignored `android/local.properties` containing `sdk.dir=/path/to/Android/Sdk`.

From the repository root:

```sh
npm run android:build
```

The command runs Android unit tests, lint, and the APK build. With local release signing configured, it writes `artifacts/gpt-harness-android.apk`. Otherwise it builds an installable debug APK at `artifacts/gpt-harness-android-debug.apk`.

## Release signing

Private signing material belongs in the ignored `.local/android-signing/` directory. The local release configuration reads `.local/android-signing/signing.properties` with the standard properties `storeFile`, `storePassword`, `keyAlias`, and `keyPassword`. `storeFile` is resolved relative to `android/`. Keep the directory private and back it up securely: future APK updates must use the same signing key. Do not commit or upload these files. APKs and build directories are also ignored.

For the initial local build, signing material is already generated in that ignored directory. The release APK is signed locally; no Play Store upload is performed.

## Security boundaries

Only the exact HTTPS production origin can stay inside the main WebView or send native messages. The bridge also rejects iframe messages. External web links open in a browser; `file:`, `javascript:`, `intent:`, and untrusted download URLs cannot reach native handlers. Native downloads resolve only `/api/files/` URLs on the same server, include the current session cookie, refuse redirects, and enforce the server's 20 MB file limit. HTTP, mixed content, third-party cookies, backups, and release WebView debugging are disabled. No camera, microphone, broad file-storage, or location permission is requested.

References: [Android WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [WebView window insets](https://developer.android.com/develop/ui/views/layout/webapps/understand-window-insets), [origin-scoped web messages](https://developer.android.com/reference/androidx/webkit/WebViewCompat).
