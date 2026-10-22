package edu.campus.crms;

import android.Manifest;
import android.app.AlarmManager;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.*;

@CapacitorPlugin(name = "CampusNotifications", permissions = @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }))
public class CampusNotificationsPlugin extends Plugin {
    @PluginMethod public void enable(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "permissionResult"); return;
        }
        finishEnable(call);
    }
    @PermissionCallback private void permissionResult(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) { call.reject("Allow notifications in Android settings to receive event alerts."); return; }
        finishEnable(call);
    }
    private void finishEnable(PluginCall call) {
        if (FirebaseApp.getApps(getContext()).isEmpty()) { call.reject("Firebase is not configured in this APK. Add google-services.json and rebuild."); return; }
        if (Build.VERSION.SDK_INT >= 31 && !((AlarmManager)getContext().getSystemService(Context.ALARM_SERVICE)).canScheduleExactAlarms()) {
            getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getContext().getPackageName())));
        }
        call.resolve();
    }
    @PluginMethod public void clear(PluginCall call) {
        int old = EventReminders.prefs(getContext()).getInt("college", -1);
        if (!FirebaseApp.getApps(getContext()).isEmpty() && old > 0) FirebaseMessaging.getInstance().unsubscribeFromTopic("college_" + old);
        EventReminders.clear(getContext());
        EventReminders.prefs(getContext()).edit().putInt("college", -1).apply();
        call.resolve();
    }
    @PluginMethod public void sync(PluginCall call) {
        try {
            int college = call.getInt("collegeId", -1);
            if (college < 1) { call.reject("Select a college first."); return; }
            int old = EventReminders.prefs(getContext()).getInt("college", -1);
            boolean firebase = !FirebaseApp.getApps(getContext()).isEmpty();
            if (old != college) {
                if (firebase && old > 0) FirebaseMessaging.getInstance().unsubscribeFromTopic("college_" + old);
                EventReminders.clear(getContext());
            }
            EventReminders.prefs(getContext()).edit().putInt("college", college).apply();
            if (firebase) FirebaseMessaging.getInstance().subscribeToTopic("college_" + college);
            JSONArray events = call.getArray("events", new JSArray());
            java.util.Set<Integer> ids = new java.util.HashSet<>();
            for (int i = 0; i < events.length(); i++) {
                JSONObject item = events.getJSONObject(i);
                ids.add(item.getInt("id"));
                JSONObject e = new JSONObject().put("id",item.getInt("id")).put("collegeId",college)
                    .put("title",item.getString("title")).put("startAt",item.getString("start_at"))
                    .put("status",item.getString("status")).put("updatedAt",item.getString("updated_at"));
                EventReminders.update(getContext(), e, false);
            }
            for (String key : EventReminders.prefs(getContext()).getAll().keySet()) {
                if (key.startsWith("event_") && !ids.contains(Integer.parseInt(key.substring(6)))) EventReminders.cancel(getContext(), Integer.parseInt(key.substring(6)));
            }
            call.resolve(new JSObject().put("pushConfigured",firebase));
        } catch (Exception e) { call.reject("Could not synchronize event reminders", e); }
    }
}
