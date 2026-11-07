package app.kube.music;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KubePlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
