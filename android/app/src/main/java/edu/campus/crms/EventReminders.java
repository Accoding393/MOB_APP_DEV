package edu.campus.crms;

import android.app.*;
import android.content.*;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import org.json.*;
import java.time.Instant;
import java.util.Iterator;

final class EventReminders {
    static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("campus-reminders", Context.MODE_PRIVATE); }
    static PendingIntent alarmIntent(Context c, int id) {
        return PendingIntent.getBroadcast(c, id, new Intent(c, ReminderReceiver.class).putExtra("eventId", id), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void cancel(Context c, int id) {
        ((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).cancel(alarmIntent(c, id));
        ((NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE)).cancel(id);
        prefs(c).edit().remove("event_" + id).apply();
    }
    static void clear(Context c) {
        for (String key : prefs(c).getAll().keySet()) if (key.startsWith("event_")) cancel(c, Integer.parseInt(key.substring(6)));
    }
    static void update(Context c, JSONObject e, boolean announce) throws JSONException {
        if (e.optInt("collegeId") != prefs(c).getInt("college", -1)) return;
        int id = e.getInt("id");
        long version = Instant.parse(e.getString("updatedAt")).toEpochMilli();
        if (prefs(c).getLong("version_" + id, 0) > version) return;
        prefs(c).edit().putLong("version_" + id, version).apply();
        ((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).cancel(alarmIntent(c, id));
        long start = Instant.parse(e.getString("startAt")).toEpochMilli();
        if (e.optString("status").equals("cancelled") || start <= System.currentTimeMillis()) { cancel(c, id); return; }
        prefs(c).edit().putString("event_" + id, e.toString()).apply();
        long trigger = start - 300000;
        AlarmManager alarms = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if (trigger > System.currentTimeMillis()) {
            if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, alarmIntent(c, id));
            else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, trigger, alarmIntent(c, id));
        } else {
            show(c, e, true);
        }
        if (announce && !e.optString("updatedAt").equals(prefs(c).getString("announced_" + id, ""))) {
            show(c, e, false);
            prefs(c).edit().putString("announced_" + id, e.optString("updatedAt")).apply();
        }
    }
    static void show(Context c, JSONObject e, boolean countdown) throws JSONException {
        NotificationManager manager = (NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel("events", "College events", NotificationManager.IMPORTANCE_HIGH));
        PendingIntent open = PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, "events")
            .setSmallIcon(R.drawable.ic_notification).setContentTitle(e.getString("title"))
            .setContentText(countdown ? "Event starts soon" : e.optBoolean("isNew") ? "New approved college event" : "Event details updated")
            .setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(true);
        if (countdown) {
            long start = Instant.parse(e.getString("startAt")).toEpochMilli();
            b.setWhen(start).setUsesChronometer(true).setChronometerCountDown(true).setTimeoutAfter(Math.max(1000, start - System.currentTimeMillis()));
            prefs(c).edit().putString("shown_" + e.getInt("id"), e.getString("startAt")).apply();
        }
        try { manager.notify(e.getInt("id"), b.build()); } catch (SecurityException ignored) { /* User denied notifications. */ }
    }
}
