// auth-guard.js — Supabase Auth guard for all Rylem Pulse pages
// Include AFTER the Supabase JS CDN script tag.
// Sets window.currentUser = { id, email, full_name, role, rep_name }
// Redirects to login.html if no session.

(function() {
  const SUPABASE_URL = 'https://ilbfbbcaaonxejvnkffi.supabase.co';
  const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsYmZiYmNhYW9ueGVqdm5rZmZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjI3MDQsImV4cCI6MjA5MDczODcwNH0.JeL849o9ehf9Dekh6n-sYa8qtgjcpOLGdBVQPL3fDgw';

  // Create or reuse the Supabase client
  if (!window._authDb) {
    window._authDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }

  window.currentUser = null;

  window.authReady = new Promise(async (resolve) => {
    const { data: { session } } = await window._authDb.auth.getSession();
    if (!session) {
      window.location.replace('login.html');
      return;
    }

    // Fetch profile
    const { data: profile } = await window._authDb
      .from('profiles')
      .select('full_name, email, role, rep_name')
      .eq('id', session.user.id)
      .single();

    window.currentUser = {
      id: session.user.id,
      email: session.user.email,
      full_name: profile?.full_name || session.user.email,
      role: profile?.role || 'sdr',
      rep_name: profile?.rep_name || session.user.email.split('@')[0]
    };

    // Clean up old hardcoded auth
    localStorage.removeItem('bdm_auth_v1');

    resolve(window.currentUser);
  });

  window.doLogout = async function() {
    await window._authDb.auth.signOut();
    localStorage.removeItem('bdm_auth_v1');
    window.location.replace('login.html');
  };
})();
