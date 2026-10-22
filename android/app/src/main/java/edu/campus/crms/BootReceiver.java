package edu.campus.crms;
import android.content.*;
import org.json.JSONObject;

public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        for (var entry : EventReminders.prefs(context).getAll().entrySet()) {
            if (!entry.getKey().startsWith("event_")) continue;
            try { EventReminders.update(context, new JSONObject((String)entry.getValue()), false); }
            catch (Exception e) { android.util.Log.e("CRMS", "Restore reminder failed", e); }
        }
    }
}
