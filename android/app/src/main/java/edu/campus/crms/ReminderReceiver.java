package edu.campus.crms;
import android.content.*;
import org.json.JSONObject;

public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        try {
            String saved = EventReminders.prefs(context).getString("event_" + intent.getIntExtra("eventId", -1), null);
            if (saved != null) EventReminders.show(context, new JSONObject(saved), true);
        } catch (Exception e) { android.util.Log.e("CRMS", "Reminder failed", e); }
    }
}
