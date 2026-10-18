package app.ownjournal;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemChromePlugin.class);
        super.onCreate(savedInstanceState);
        // Use AndroidX for consistent edge-to-edge behavior before Android 15 too.
        // Capacitor SystemBars delivers the insets to the web UI and handles IME resizing.
        EdgeToEdge.enable(this);
    }
}
