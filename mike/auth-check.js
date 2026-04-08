// auth-check.js — Supabase Auth guard for all Rylem Pulse pages
// Include AFTER the Supabase JS CDN <script> tag.
//
// Exposes:
//   window.rylemDb    = Supabase client
//   window.rylemUser  = { id, email, full_name, role, rep_key, reports_to }
//   window.rylemAuthReady = Promise<user>
//   window.doLogout()

(function () {
  const SUPABASE_URL  = 'https://ilbfbbcaaonxejvnkffi.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYmZiYmNhYW9ueGVqdm5rZmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjI3MDQsImV4cCI6MjA5MDczODcwNH0.JeL849o9ehf9Dekh6n-sYa8qtgjcpOLGdBVQPL3fDgw';

  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  window.rylemDb = db;
  window.rylemUser = null;

  window.rylemAuthReady = new Promise(function (resolve) {
    (async function () {
      var sess = await db.auth.getSession();
      var session = sess.data.session;

      if (!session) {
        window.location.replace('login.html');
        return; // never resolves — page is navigating away
      }

      // Fetch profile
      var prof = await db
        .from('profiles')
        .select('full_name, email, role, rep_name, rep_key, reports_to')
        .eq('id', session.user.id)
        .single();

      var p = prof.data;
      var user = {
        id:         session.user.id,
        email:      session.user.email,
        full_name:  p ? p.full_name : session.user.email,
        role:       p ? p.role : 'sdr',
        rep_key:    p ? p.rep_key : session.user.email.split('@')[0],
        reports_to: p ? p.reports_to : null
      };

      window.rylemUser = user;

      // Compute allowed rep_keys based on role
      // admin: all reps, manager: self + reports, sdr: self only
      if (user.role === 'admin') {
        user.allowedReps = null; // null = no filter (all)
      } else if (user.role === 'manager') {
        var reportsRes = await db
          .from('profiles')
          .select('rep_key')
          .eq('reports_to', user.email);
        var reportKeys = (reportsRes.data || []).map(function(r) { return r.rep_key; });
        user.allowedReps = [user.rep_key].concat(reportKeys);
      } else {
        user.allowedReps = [user.rep_key];
      }

      // Clean up legacy password gates
      localStorage.removeItem('bdm_auth_v1');
      localStorage.removeItem('bdm_auth_v2');

      resolve(user);
    })();
  });

  window.doLogout = async function () {
    try { await db.auth.signOut(); } catch(e) { console.warn('signOut error:', e); }
    localStorage.removeItem('bdm_auth_v1');
    localStorage.removeItem('bdm_auth_v2');
    localStorage.removeItem('bdm_rep');
    window.location.replace('login.html');
  };
})();
