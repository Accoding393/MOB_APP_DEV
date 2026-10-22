# College Resource Management System — Android and web setup

## Implemented locally

- Capacitor Android project reusing the website interface, with bundled app code and Leaflet assets.
- Shared Express API, PostgreSQL database and student login credentials. Administration stays on the website.
- College selector on the login screen. Anonymous guest sessions require neither an email nor a database user account.
- Student requests continue through the existing approval flow. The event feed reads published events, never pending booking requests.
- Campus map starts first on Android. Venue search, live location marker, GPS accuracy circle, in-app walking route and instruction list are implemented.
- Website administrators can add other campus locations from Campus map → Add campus location. These are separate from bookable venues.
- Cached workspace data and offline shell. Logout clears the cached workspace. Offline mode is read-only. Map tiles and new routes require internet.
- Native Firebase event messages, locally scheduled five-minute reminders and notification countdowns. Rescheduling/cancellation updates reminders; reboot restores stored reminders.
- Database notification outbox records event changes transactionally and retries failed delivery while the server is running.

The local database schema has been migrated without resetting existing records. No cloud deployment has been performed. The generated debug APK has no backend URL or Firebase project yet; it is a build check, not the final connected app.

## What you need to do

### 1. Create the shared database on Neon

Create a free PostgreSQL project at https://neon.com and copy its connection string into the server's `DATABASE_URL` setting. Keep `sslmode=require` in the connection string.

To keep all current accounts, password hashes, venues and events, migrate the existing local PostgreSQL database using `pg_dump` and `pg_restore` into a fresh Neon database. Use PostgreSQL/pgAdmin's backup and restore tools; do not run the seed/reset scripts on existing data. Once restored, run `npm run db:migrate` against Neon. A new empty database will have no colleges or accounts until the data is restored.

### 2. Create the Firebase project for notifications

At https://console.firebase.google.com create a project and register an Android app with package name **edu.campus.crms**.

Download **google-services.json** into **android/app/google-services.json**. It is ignored by Git. Follow https://firebase.google.com/docs/android/setup.

In Project settings → Service accounts, generate a private key for the server. Put the complete JSON into the hosting environment variable **FIREBASE_SERVICE_ACCOUNT_JSON**. Keep this private JSON out of source control, chat messages and the Android app. Firebase is used for messaging; PostgreSQL remains the account and event database.

Guests and students subscribe to the selected college's public event topic. These topics contain public event information only. Switching college or logging out clears the old subscription/reminders. Notifications require the user's Android notification permission and Google Play services.

### 3. Get a walking directions key

Create a free account/key at https://openrouteservice.org and put the key into the server variable **ORS_API_KEY**. This stays on the backend. The app uses the **foot-walking** profile and displays its instructions inside the map. Without this key, the original keyless OSRM road-route preview remains available. This is explicitly labelled as a road preview, not verified walking guidance. Denied/unavailable GPS falls back to NITT Main Gate for NIT Trichy.

Check https://openrouteservice.org/services/ and https://openrouteservice.org/restrictions/ for available profiles and quotas. Public OpenStreetMap tiles are suitable for modest interactive use, not bulk offline downloads.

### 4. Deploy the website and API on Render

Put this repository in your GitHub account and create a Render web service from it, or use the included `render.yaml` blueprint at https://render.com.

- Runtime: Node; free instance.
- Build: `npm ci --omit=dev`
- Start: `npm run db:migrate && npm start`
- Health check: `/api/health`
- Environment: `NODE_ENV=production`, `DATABASE_URL`, a random `JWT_SECRET` of at least 32 characters, `ORS_API_KEY`, and `FIREBASE_SERVICE_ACCOUNT_JSON`.

The blueprint generates a JWT secret. For manual deployment generate one locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and save it in Render. Preserve it across deployments. Replace any demo account passwords before exposing the existing data publicly.

Render gives you an HTTPS URL. The same service serves the website and Android API. Free instances sleep after inactivity: https://render.com/docs/free. The first request may take time. Do not run a server-only five-minute timer on this free instance; the Android app schedules reminders locally. Push delivery itself can be delayed by network/device restrictions. A failed outbox delivery retries when the server is running or wakes for another request.

### 5. Build the connected Android APK

Android Studio and SDK are already present on this computer. Use **JDK 21** for Gradle (the machine also has other Java versions).

In the project root PowerShell terminal:

```powershell
$env:MOBILE_API_URL = 'https://YOUR-SERVICE.onrender.com'
npm install
npm run mobile:sync
npm run mobile:open
```

In Android Studio, set Gradle JDK to JDK 21 and build an APK. Or, on this computer:

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\.jdks\jbr-21.0.11"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
Set-Location android
.\gradlew.bat assembleDebug
```

Output: **android/app/build/outputs/apk/debug/app-debug.apk**. Install it on your phone, allowing installation from the file-sharing app you use. For ongoing distribution, use Android Studio's signed release APK flow and securely retain your signing key so future APKs can update the same installation.

The app bundles its interface; after web UI code changes, rebuild/sync a new APK. Database content changes appear on refresh in both clients without rebuilding.

### 6. Test these on an actual Android phone

1. Choose NIT Trichy and continue as guest without entering credentials. Check the map and events.
2. Tap Enable notifications and allow notifications and Alarms & reminders. Precise location is requested when starting navigation.
3. Log in with an existing student account and submit an event request. Confirm it is absent from the public event list until approved on the website.
4. Approve an event at least ten minutes in the future. Both a guest phone and a student phone should receive the new-event notification with the app closed normally.
5. Verify the reminder and countdown five minutes before start. Repeat with a rescheduled event and a cancelled event; the obsolete reminder must not appear.
6. Refresh, enable airplane mode, reopen the app and view saved events/venue information. New map tiles and route calculations require internet. Changes are disabled offline.
7. On campus, walk between the existing venue entrances. Check GPS accuracy, route legality and whether footpaths are actually connected.
8. Add a college on the website; log out on mobile and confirm it appears in the login selector. Add a campus location and verify it appears after refresh.

## Remaining external validation and limitations

- Firebase delivery, exact alarms and GPS tracking cannot be confirmed until your project configuration is supplied and the app is tested on a phone.
- Android force-stop, revoked permissions, aggressive battery settings or lack of connectivity can prevent or delay alerts. Offline phones cannot learn about a cancellation until they reconnect; cached reminders may therefore be stale.
- Full offline maps and offline route calculation are not included. Saved data and already scheduled reminders are available offline.
- Missing campus paths have **not** been invented or published. Verify path geometry and access rights on campus, then add legitimate missing paths to OpenStreetMap (routing providers may take time to import changes). Venue pins do not create walkable paths. A private campus routing graph would be a separate implementation if OSM coverage proves insufficient.
- Other campus locations can be added with verified coordinates; no unverified campus locations were seeded.
- The default Capacitor launcher artwork is still a placeholder; the app name is configured.

## Verification commands

```powershell
npm test
# With the local server running on port 4011:
$env:TEST_API_URL = 'http://localhost:4011/api'
$env:TEST_DATABASE = '1'
npm test
```

Database integration tests use a transaction and roll it back. They check pending requests emit no event notification, event changes populate the outbox, and guest API access remains read-only and college-scoped.

## Verification performed in this session

- Android `assembleDebug`: passed with JDK 21; debug APK generated.
- Five automated checks (including local API/database integration checks): passed.
- Browser guest entry, college selection display, 11 existing map pins and venue search: checked.
- Production dependency audit: zero reported vulnerabilities. Three moderate advisories remain in the development-only Capacitor CLI's iOS tooling dependency chain.
- Offline browser reopening in the embedded preview did not render successfully; it is not a verified browser-offline result. Android bundles the shell separately, but airplane-mode reopening still requires device testing.
- Firebase push, live GPS, exact alarms, route coverage and a fully configured APK remain unverified until account setup and phone testing.
