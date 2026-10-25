package com.austin410203.seasontree;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // local plugins must be registered before the bridge starts
        registerPlugin(BackgroundAudioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
