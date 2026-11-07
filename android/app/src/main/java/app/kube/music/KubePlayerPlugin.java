package app.kube.music;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "KubePlayer")
public class KubePlayerPlugin extends Plugin {
    private ListenableFuture<MediaController> future;
    private MediaController controller;
    @Override public void load() {
        getActivity().runOnUiThread(() -> {
            SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), PlaybackService.class));
            future = new MediaController.Builder(getContext(), token).buildAsync();
            future.addListener(() -> { try { controller = future.get(); } catch (Exception ignored) {} }, ContextCompat.getMainExecutor(getContext()));
        });
    }
    private void withPlayer(PluginCall call, Runnable action) {
        getActivity().runOnUiThread(() -> {
            if (controller == null) { call.reject("Playback service is not connected yet. Please retry."); return; }
            try { action.run(); } catch (Exception e) { call.reject(e.getMessage(), e); }
        });
    }
    private MediaItem item(String url, String title, String artist, String id) {
        Uri uri = Uri.parse(url);
        if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null) throw new IllegalArgumentException("Only HTTPS streams are supported");
        return new MediaItem.Builder().setUri(uri).setMediaId(id).setMediaMetadata(new MediaMetadata.Builder().setTitle(title).setArtist(artist).build()).build();
    }
    @PluginMethod public void play(PluginCall call) {
        withPlayer(call, () -> {
            controller.setMediaItem(item(call.getString("url", ""), call.getString("title", ""), call.getString("artist", ""), call.getString("id", "")));
            controller.prepare(); controller.play(); call.resolve();
        });
    }
    @PluginMethod public void upcoming(PluginCall call) {
        withPlayer(call, () -> {
            try {
                JSONArray items = call.getArray("tracks", new com.getcapacitor.JSArray());
                List<MediaItem> next = new ArrayList<>();
                for (int i = 0; i < items.length(); i++) { JSONObject t = items.getJSONObject(i); next.add(item(t.getString("url"), t.getString("title"), t.getString("artist"), t.getString("id"))); }
                int current = controller.getCurrentMediaItemIndex();
                if (current + 1 < controller.getMediaItemCount()) controller.removeMediaItems(current + 1, controller.getMediaItemCount());
                controller.addMediaItems(next); call.resolve();
            } catch (Exception e) { call.reject("Invalid queue", e); }
        });
    }
    @PluginMethod public void repeat(PluginCall call) { withPlayer(call, () -> { String mode = call.getString("mode", "off"); controller.setRepeatMode("one".equals(mode) ? Player.REPEAT_MODE_ONE : "all".equals(mode) ? Player.REPEAT_MODE_ALL : Player.REPEAT_MODE_OFF); call.resolve(); }); }
    @PluginMethod public void resume(PluginCall call) { withPlayer(call, () -> { controller.play(); call.resolve(); }); }
    @PluginMethod public void pause(PluginCall call) { withPlayer(call, () -> { controller.pause(); call.resolve(); }); }
    @PluginMethod public void stop(PluginCall call) { withPlayer(call, () -> { controller.stop(); controller.clearMediaItems(); call.resolve(); }); }
    @PluginMethod public void seek(PluginCall call) { withPlayer(call, () -> { controller.seekTo((long)(Math.max(0, call.getDouble("seconds", 0.0)) * 1000)); call.resolve(); }); }
    @PluginMethod public void volume(PluginCall call) { withPlayer(call, () -> { controller.setVolume((float)Math.max(0, Math.min(1, call.getDouble("value", 1.0)))); call.resolve(); }); }
    @PluginMethod public void status(PluginCall call) {
        withPlayer(call, () -> {
            JSObject value = new JSObject();
            value.put("playing", controller.isPlaying());
            value.put("position", controller.getCurrentPosition() / 1000.0);
            value.put("duration", Math.max(0, controller.getDuration()) / 1000.0);
            value.put("ended", controller.getPlaybackState() == Player.STATE_ENDED);
            value.put("id", controller.getCurrentMediaItem() == null ? "" : controller.getCurrentMediaItem().mediaId);
            if (controller.getPlayerError() != null) value.put("error", controller.getPlayerError().getMessage());
            call.resolve(value);
        });
    }
    @PluginMethod public void exportBackup(PluginCall call) {
        String content = call.getString("content", "");
        if (content.length() > 20000000) { call.reject("Backup too large"); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, "kube-backup.json");
        startActivityForResult(call, intent, "backupCreated");
    }
    @ActivityCallback private void backupCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("Export cancelled"); return; }
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(result.getData().getData())) {
            if (stream == null) throw new IllegalStateException("Could not open destination");
            stream.write(call.getString("content", "").getBytes(StandardCharsets.UTF_8)); call.resolve();
        } catch (Exception e) { call.reject("Could not save backup", e); }
    }
    @Override protected void handleOnDestroy() { if (future != null) MediaController.releaseFuture(future); }
}
