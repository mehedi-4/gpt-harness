package com.mehedi.gptharness;

import android.animation.ValueAnimator;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.content.res.Configuration;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.animation.PathInterpolator;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONException;
import org.json.JSONObject;

public final class MainActivity extends ComponentActivity {
    private static final long MAX_DOWNLOAD = 20L * 1024 * 1024;
    private final OriginPolicy policy = new OriginPolicy(BuildConfig.APP_ORIGIN);
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private FrameLayout root;
    private WebView web;
    private WebView printWeb;
    private LinearLayout cover;
    private TextView heading;
    private TextView explanation;
    private Button retry;
    private ProgressBar progress;
    private boolean failed;
    private boolean shown;
    private ValueCallback<Uri[]> fileCallback;
    private PendingSave pendingSave;

    private final ActivityResultLauncher<Intent> pickFiles = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), result -> {
            if (fileCallback == null) return;
            Uri[] uris = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
            // User-selected content providers grant access without broad storage permissions.
            if (uris != null) {
                for (Uri uri : uris) if (!"content".equals(uri.getScheme())) { uris = null; break; }
            }
            fileCallback.onReceiveValue(uris);
            fileCallback = null;
        });

    private final ActivityResultLauncher<Intent> saveFile = registerForActivityResult(
        new ActivityResultContracts.StartActivityForResult(), result -> {
            PendingSave save = pendingSave;
            pendingSave = null;
            Uri destination = result.getData() == null ? null : result.getData().getData();
            if (save == null || result.getResultCode() != Activity.RESULT_OK || destination == null || !"content".equals(destination.getScheme())) return;
            io.execute(() -> {
                try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                    if (output == null) throw new java.io.IOException("No destination");
                    if (save.bytes != null) output.write(save.bytes);
                    else copyPrivateFile(save, output);
                    runOnUiThread(() -> toast(R.string.saved));
                } catch (Exception error) { runOnUiThread(() -> toast(R.string.save_failed)); }
            });
        });

    @Override protected void onCreate(Bundle state) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(state);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        splash.setOnExitAnimationListener(provider -> provider.getView().animate()
            .alpha(0f).setDuration(motion(160)).withEndAction(provider::remove).start());
        createLayout();
        configureWebView();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { handleBack(); }
        });
        if (state == null || web.restoreState(state) == null) web.loadUrl(BuildConfig.APP_ORIGIN + "/");
    }

    private void createLayout() {
        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.app_background));
        setContentView(root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            // The native container has consumed these areas. Avoid double keyboard / safe-area padding.
            return new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime(), Insets.NONE).build();
        });
        web = new WebView(this);
        web.setAlpha(0f);
        web.setBackgroundColor(getColor(R.color.app_background));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));

        cover = new LinearLayout(this);
        cover.setGravity(Gravity.CENTER);
        cover.setOrientation(LinearLayout.VERTICAL);
        cover.setPadding(dp(28), dp(28), dp(28), dp(28));
        cover.setBackgroundColor(getColor(R.color.app_background));
        root.addView(cover, new FrameLayout.LayoutParams(-1, -1));
        ImageView mark = new ImageView(this);
        mark.setImageResource(R.drawable.ic_mark);
        mark.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        cover.addView(mark, new LinearLayout.LayoutParams(dp(88), dp(88)));
        heading = new TextView(this);
        heading.setText(R.string.app_name);
        heading.setTextColor(getColor(R.color.app_foreground));
        heading.setTextSize(24);
        heading.setTypeface(null, android.graphics.Typeface.BOLD);
        heading.setGravity(Gravity.CENTER);
        cover.addView(heading);
        explanation = new TextView(this);
        explanation.setText(R.string.connecting);
        explanation.setTextColor(getColor(R.color.app_secondary));
        explanation.setTextSize(15);
        explanation.setGravity(Gravity.CENTER);
        explanation.setPadding(0, dp(10), 0, dp(22));
        cover.addView(explanation);
        progress = new ProgressBar(this);
        progress.setIndeterminateTintList(ColorStateList.valueOf(Color.rgb(16, 163, 127)));
        cover.addView(progress, new LinearLayout.LayoutParams(dp(24), dp(24)));
        retry = new Button(this);
        retry.setText(R.string.retry);
        retry.setAllCaps(false);
        retry.setVisibility(View.GONE);
        retry.setOnClickListener(view -> {
            failed = false;
            shown = false;
            heading.setText(R.string.app_name);
            explanation.setText(R.string.connecting);
            retry.setVisibility(View.GONE);
            progress.setVisibility(View.VISIBLE);
            web.loadUrl(BuildConfig.APP_ORIGIN + "/");
        });
        cover.addView(retry);
        applyTheme((getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Only explicit file-picker grants; local file URLs remain blocked.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setUserAgentString(settings.getUserAgentString() + " GPTHarnessAndroid/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "GptHarnessAndroid", Collections.singleton(BuildConfig.APP_ORIGIN),
                (view, message, sourceOrigin, isMainFrame, reply) -> {
                    if (!isMainFrame || !policy.isTrusted(sourceOrigin.toString()) || !policy.isTrusted(view.getUrl())) return;
                    String data = message.getData();
                    if (data == null || data.length() > 2_000_000) return;
                    try { receive(new JSONObject(data)); } catch (JSONException ignored) { /* Invalid bridge messages have no effect. */ }
                });
        } else {
            showFailure(R.string.update_webview);
        }
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                String url = request.getUrl().toString();
                if (policy.isTrusted(url)) return false;
                openExternal(url);
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!policy.isTrusted(url)) { view.stopLoading(); showFailure(R.string.connection_help); }
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (failed || !policy.isTrusted(url)) return;
                CookieManager.getInstance().flush();
                reveal();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showFailure(R.string.connection_help);
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 400) showFailure(R.string.connection_help);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { pickFiles.launch(params.createIntent()); }
                catch (ActivityNotFoundException error) { fileCallback.onReceiveValue(null); fileCallback = null; toast(R.string.picker_unavailable); }
                return true;
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, android.os.Message message) {
                if (!userGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView child, WebResourceRequest request) {
                        openExternal(request.getUrl().toString());
                        child.post(child::destroy);
                        return true;
                    }
                });
                ((WebView.WebViewTransport) message.obj).setWebView(popup);
                message.sendToTarget();
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            if (!policy.isPrivateFile(url)) return;
            requestSave(new PendingSave(url, null, CookieManager.getInstance().getCookie(url)),
                URLUtil.guessFileName(url, disposition, mime), mime == null ? "application/octet-stream" : mime);
        });
    }

    private void receive(JSONObject message) {
        switch (message.optString("type")) {
            case "theme": applyTheme(message.optBoolean("dark")); break;
            case "copy":
                ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("", message.optString("text")));
                break;
            case "saveText":
                requestSave(new PendingSave(null, message.optString("text").getBytes(StandardCharsets.UTF_8), null),
                    message.optString("filename", "conversation.txt"), message.optString("mime", "text/plain"));
                break;
            case "print": printDocument(message.optString("html"), message.optString("title", "Conversation")); break;
            default: break;
        }
    }

    private void applyTheme(boolean dark) {
        int background = dark ? Color.BLACK : Color.WHITE;
        root.setBackgroundColor(background);
        web.setBackgroundColor(background);
        WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightStatusBars(!dark);
        WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightNavigationBars(!dark);
    }

    private void reveal() {
        if (shown) return;
        shown = true;
        web.animate().alpha(1f).setDuration(motion(260)).setInterpolator(new PathInterpolator(.16f, 1f, .3f, 1f)).start();
        cover.animate().alpha(0f).setDuration(motion(200)).withEndAction(() -> cover.setVisibility(View.GONE)).start();
    }

    private void showFailure(int text) {
        failed = true;
        cover.animate().cancel();
        cover.setAlpha(1f);
        cover.setVisibility(View.VISIBLE);
        heading.setText(R.string.connection_error);
        explanation.setText(text);
        progress.setVisibility(View.GONE);
        retry.setVisibility(View.VISIBLE);
    }

    private void handleBack() {
        WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(root);
        if (insets != null && insets.isVisible(WindowInsetsCompat.Type.ime())) {
            WindowCompat.getInsetsController(getWindow(), root).hide(WindowInsetsCompat.Type.ime());
            return;
        }
        // Close the active web surface before leaving the app; keep chat and stream state intact.
        web.evaluateJavascript("(function(){var surface=document.querySelector('[aria-modal=\"true\"],.ui-popover[data-state=\"open\"],.ui-sidebar[data-state=\"open\"],textarea[aria-label=\"Edit prompt\"]');if(!surface)return false;(document.activeElement||document).dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));return true;})()", handled -> {
            if ("true".equals(handled)) return;
            if (web.canGoBack()) web.goBack(); else moveTaskToBack(true);
        });
    }

    private void openExternal(String value) {
        if (!policy.isExternalLink(value)) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(value)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException error) { toast(R.string.link_unavailable); }
    }

    private void requestSave(PendingSave save, String filename, String mime) {
        if (pendingSave != null) return;
        pendingSave = save;
        String safeName = filename.replaceAll("[\\p{Cntrl}/\\\\]", "_");
        try {
            saveFile.launch(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType(mime).putExtra(Intent.EXTRA_TITLE, safeName.substring(0, Math.min(120, safeName.length()))));
        } catch (ActivityNotFoundException error) { pendingSave = null; toast(R.string.save_failed); }
    }

    private void copyPrivateFile(PendingSave save, OutputStream output) throws Exception {
        if (!policy.isPrivateFile(save.url)) throw new java.io.IOException("Invalid origin");
        HttpURLConnection connection = (HttpURLConnection) new URL(save.url).openConnection();
        connection.setInstanceFollowRedirects(false); // Never forward session cookies to another host.
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(30_000);
        if (save.cookie != null) connection.setRequestProperty("Cookie", save.cookie);
        try {
            if (connection.getResponseCode() != 200) throw new java.io.IOException("Download failed");
            try (InputStream input = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                long total = 0;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > MAX_DOWNLOAD) throw new java.io.IOException("File too large");
                    output.write(buffer, 0, count);
                }
            }
        } finally { connection.disconnect(); }
    }

    private void printDocument(String html, String title) {
        if (printWeb != null) printWeb.destroy();
        printWeb = new WebView(this);
        printWeb.getSettings().setJavaScriptEnabled(false);
        printWeb.getSettings().setAllowFileAccess(false);
        printWeb.getSettings().setAllowContentAccess(false);
        printWeb.setWebViewClient(new WebViewClient() {
            private boolean printed;
            @Override public void onPageFinished(WebView view, String url) {
                if (printed) return;
                printed = true;
                ((PrintManager) getSystemService(PRINT_SERVICE)).print(title, view.createPrintDocumentAdapter(title), new PrintAttributes.Builder().build());
            }
        });
        printWeb.loadDataWithBaseURL(BuildConfig.APP_ORIGIN + "/", html, "text/html", "UTF-8", null);
    }

    @Override protected void onSaveInstanceState(Bundle state) { super.onSaveInstanceState(state); web.saveState(state); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        web.stopLoading();
        ((ViewGroup) web.getParent()).removeView(web);
        web.destroy();
        if (printWeb != null) printWeb.destroy();
        io.shutdown();
        super.onDestroy();
    }

    private long motion(long duration) { return ValueAnimator.areAnimatorsEnabled() ? duration : 0; }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private void toast(int text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }
    private static final class PendingSave {
        final String url;
        final byte[] bytes;
        final String cookie;
        PendingSave(String url, byte[] bytes, String cookie) { this.url = url; this.bytes = bytes; this.cookie = cookie; }
    }
}
