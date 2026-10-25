package com.austin410203.seasontree;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the app process alive while ambience plays, so the WebView's Web Audio
 * keeps sounding with the screen off. The service only holds a notification and
 * a wake lock; the sound itself is still produced by the web layer.
 */
@CapacitorPlugin(name = "BackgroundAudio")
public class BackgroundAudioPlugin extends Plugin {

    private static BackgroundAudioPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent intent = new Intent(getContext(), AudioKeepAliveService.class);
        intent.putExtra("title", call.getString("title", "靜心時光"));
        intent.putExtra("text", call.getString("text", "播放中"));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (Exception e) {
            // Android 12+ refuses foreground services started from the background
            call.reject("cannot start background audio: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), AudioKeepAliveService.class));
        call.resolve();
    }

    /** Called by the service when the user taps "停止" on the notification. */
    static void emitStop() {
        if (instance != null) {
            instance.notifyListeners("stop", new JSObject());
        }
    }
}
