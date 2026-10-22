package edu.campus.crms;
import com.google.firebase.messaging.*;
import org.json.JSONObject;

public class CampusMessagingService extends FirebaseMessagingService {
    @Override public void onMessageReceived(RemoteMessage message) {
        try {
            String event = message.getData().get("event");
            if (event != null) EventReminders.update(this, new JSONObject(event), true);
        } catch (Exception e) { android.util.Log.e("CRMS", "Push processing failed", e); }
    }
    @Override public void onNewToken(String token) {
        int college = EventReminders.prefs(this).getInt("college", -1);
        if (college > 0) FirebaseMessaging.getInstance().subscribeToTopic("college_" + college);
    }
}
