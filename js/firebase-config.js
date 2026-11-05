/* ---------------------------------------------------------------------------
   CLOUD MODE (logins + shared data) — fill this in to switch it on.

   1. Go to https://console.firebase.google.com → Add project (free "Spark" plan is enough).
   2. Build → Authentication → Get started → enable "Email/Password".
   3. Build → Firestore Database → Create database (production mode).
      Then open the "Rules" tab, paste the contents of firestore.rules from this repo, Publish.
   4. Project settings (gear) → General → "Your apps" → Web app (</>) → register.
      Copy the firebaseConfig values it shows into the object below and commit this file.
   5. Authentication → Settings → Authorized domains → add  sajeevds91.github.io

   Leave it as null to keep using the site in local / demo mode.
   (These values are not secret — security comes from firestore.rules.)
--------------------------------------------------------------------------- */
window.FIREBASE_CONFIG = null;
/* Example:
window.FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "stc-rowing.firebaseapp.com",
  projectId: "stc-rowing",
  storageBucket: "stc-rowing.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
*/
