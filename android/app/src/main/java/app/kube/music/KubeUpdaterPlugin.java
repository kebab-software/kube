package app.kube.music;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

@CapacitorPlugin(name = "KubeUpdater")
public class KubeUpdaterPlugin extends Plugin {
    private static final String FEED = "https://github.com/getkube/kube/releases/latest/download/android-update.json";
    private static final long MAX_APK_BYTES = 250L * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile String phase = BuildConfig.KUBE_AUTO_UPDATE ? "idle" : "unavailable";
    private volatile String message = BuildConfig.KUBE_AUTO_UPDATE ? "Updates download automatically. Android asks before installing." : "Install a signed release build to enable automatic updates.";
    private volatile String version = "";
    private volatile int progress = 0;
    private volatile boolean busy = false;
    private File ready;

    private JSObject snapshot() {
        JSObject state = new JSObject(); state.put("platform", "android"); state.put("currentVersion", BuildConfig.VERSION_NAME);
        state.put("status", phase); state.put("message", message); state.put("version", version); state.put("progress", progress); return state;
    }
    @PluginMethod public void status(PluginCall call) { call.resolve(snapshot()); }
    @PluginMethod public synchronized void check(PluginCall call) {
        if (!BuildConfig.KUBE_AUTO_UPDATE || busy || "ready".equals(phase)) { call.resolve(snapshot()); return; }
        busy = true; phase = "checking"; message = "Checking for updates…"; call.resolve(snapshot());
        worker.execute(() -> { try { downloadUpdate(); } catch (Exception e) { phase = "error"; message = "Could not download a verified update. The release may still be building; try again later."; } finally { busy = false; } });
    }
    private HttpURLConnection connection(String input) throws Exception {
        URL url = new URL(input);
        for (int i = 0; i < 6; i++) {
            String host = url.getHost();
            if (!"https".equals(url.getProtocol()) || !(host.equals("github.com") || host.equals("release-assets.githubusercontent.com") || host.equals("objects.githubusercontent.com"))) throw new IOException("Untrusted download host");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setInstanceFollowRedirects(false); conn.setConnectTimeout(15000); conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "Kube-Updater/" + BuildConfig.VERSION_NAME);
            int status = conn.getResponseCode();
            if (status >= 300 && status < 400) { String location = conn.getHeaderField("Location"); conn.disconnect(); if (location == null) throw new IOException("No redirect destination"); url = new URL(url, location); continue; }
            if (status != 200) { conn.disconnect(); throw new IOException("HTTP " + status); }
            return conn;
        }
        throw new IOException("Too many redirects");
    }
    private void downloadUpdate() throws Exception {
        HttpURLConnection metadata = connection(FEED);
        byte[] json;
        try (InputStream stream = metadata.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096]; int count;
            while ((count = stream.read(buffer)) != -1) { if (out.size() + count > 65536) throw new IOException("Metadata too large"); out.write(buffer, 0, count); }
            json = out.toByteArray();
        } finally { metadata.disconnect(); }
        JSONObject update = new JSONObject(new String(json, StandardCharsets.UTF_8));
        long code = update.getLong("versionCode");
        if (code <= BuildConfig.VERSION_CODE) { phase = "current"; message = "Kube is up to date."; return; }
        version = update.getString("version");
        String url = update.getString("url"), hash = update.getString("sha256");
        if (!version.matches("[0-9]+\\.[0-9]+\\.[0-9]+") || !hash.matches("[0-9a-f]{64}") || !url.startsWith("https://github.com/getkube/kube/releases/download/") || !url.endsWith(".apk")) throw new IOException("Invalid update manifest");
        File folder = new File(getContext().getCacheDir(), "updates"); if (!folder.exists() && !folder.mkdirs()) throw new IOException("No update cache");
        File partial = new File(folder, "pending-update.apk");
        phase = "downloading"; progress = 0; message = "Downloading Kube " + version + "…";
        HttpURLConnection download = connection(url);
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); long total = 0, expected = download.getContentLengthLong();
        try (InputStream in = download.getInputStream(); OutputStream out = new FileOutputStream(partial)) {
            byte[] buffer = new byte[65536]; int count;
            while ((count = in.read(buffer)) != -1) { total += count; if (total > MAX_APK_BYTES) throw new IOException("Update exceeds size limit"); out.write(buffer, 0, count); digest.update(buffer, 0, count); if (expected > 0) progress = (int)Math.min(99, total * 100 / expected); }
        } catch (Exception e) { partial.delete(); throw e; } finally { download.disconnect(); }
        StringBuilder actual = new StringBuilder(); for (byte b : digest.digest()) actual.append(String.format("%02x", b & 255));
        if (!hash.equals(actual.toString())) { partial.delete(); throw new IOException("Update checksum mismatch"); }
        verifyPackage(partial, code);
        ready = new File(folder, "kube-update.apk"); if (ready.exists() && !ready.delete()) throw new IOException("Cannot replace cached update");
        if (!partial.renameTo(ready)) throw new IOException("Cannot save update");
        progress = 100; message = "Kube " + version + " is ready. Tap Install update to confirm with Android."; phase = "ready";
    }
    @SuppressWarnings("deprecation") private void verifyPackage(File apk, long expectedVersion) throws Exception {
        PackageManager pm = getContext().getPackageManager(); int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageInfo candidate = pm.getPackageArchiveInfo(apk.getAbsolutePath(), flags);
        PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
        if (candidate == null || !getContext().getPackageName().equals(candidate.packageName)) throw new IOException("Wrong update package");
        long code = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
        if (code != expectedVersion || code <= BuildConfig.VERSION_CODE) throw new IOException("Wrong update version");
        Signature[] oldSigners = Build.VERSION.SDK_INT >= 28 ? installed.signingInfo.getApkContentsSigners() : installed.signatures;
        Signature[] newSigners = Build.VERSION.SDK_INT >= 28 ? candidate.signingInfo.getApkContentsSigners() : candidate.signatures;
        if (!Arrays.equals(oldSigners, newSigners)) throw new IOException("Update signer does not match installed app");
    }
    @PluginMethod public void install(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (!"ready".equals(phase) || ready == null || !ready.exists()) { call.reject("No verified update is ready"); return; }
                if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    message = "Allow updates from Kube in Android settings, then return and tap Install update again.";
                    getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()))); call.resolve(); return;
                }
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", ready);
                Intent installer = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                getActivity().startActivity(installer); call.resolve();
            } catch (Exception e) { call.reject("Could not open Android's package installer", e); }
        });
    }
    @PluginMethod public void openReleases(PluginCall call) {
        getActivity().runOnUiThread(() -> { try { getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://github.com/getkube/kube/releases"))); call.resolve(); } catch (Exception e) { call.reject("Could not open release notes", e); } });
    }
    @Override protected void handleOnDestroy() { worker.shutdownNow(); }
}
