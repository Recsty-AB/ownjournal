package app.ownjournal;

import android.content.res.Configuration;
import android.graphics.Color;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Paints the native padding used by SystemBars on older WebViews. */
@CapacitorPlugin(name = "SystemChrome")
public class SystemChromePlugin extends Plugin {
    private Integer backgroundColor;

    @PluginMethod
    public void setBackgroundColor(PluginCall call) {
        final int color;
        try {
            color = Color.parseColor(call.getString("color", ""));
        } catch (IllegalArgumentException error) {
            call.reject("Invalid background color", error);
            return;
        }

        getBridge().executeOnMainThread(() -> {
            backgroundColor = color;
            applyBackgroundColor();
            call.resolve();
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration configuration) {
        super.handleOnConfigurationChanged(configuration);
        // Run after all plugin callbacks: SystemBars reapplies the OS theme on
        // rotation/night-mode changes, regardless of the plugin iteration order.
        getActivity().getWindow().getDecorView().post(this::applyBackgroundColor);
    }

    private void applyBackgroundColor() {
        if (backgroundColor != null) {
            getActivity().getWindow().getDecorView().setBackgroundColor(backgroundColor);
        }
    }
}
