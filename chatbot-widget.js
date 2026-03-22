// Rylem AI Assistant — embeddable chat widget
// Add to any page: <script src="chatbot-widget.js"></script>
(function() {
  const CHAT_API = 'https://chat.rylem.com/api/chat';
  const LEAD_API = 'https://chat.rylem.com/api/lead';
  const SESSION_ID = 'web-' + Math.random().toString(36).slice(2, 10);

  // Inject styles
  const style = document.createElement('style');
  style.textContent = `
    #rylem-chat-toggle{position:fixed;bottom:24px;right:24px;width:60px;height:60px;background:#2563eb;border-radius:50%;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(37,99,235,.4);z-index:9999;display:flex;align-items:center;justify-content:center;transition:all .3s}
    #rylem-chat-toggle:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(37,99,235,.5)}
    #rylem-chat-toggle svg{width:28px;height:28px;fill:#fff}
    #rylem-chat-toggle.open svg.chat-icon{display:none}
    #rylem-chat-toggle.open svg.close-icon{display:block}
    #rylem-chat-toggle svg.close-icon{display:none}
    #rylem-chat-panel{position:fixed;bottom:96px;right:24px;width:380px;max-height:520px;background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.18);z-index:9998;display:none;flex-direction:column;overflow:hidden;font-family:'Inter',-apple-system,sans-serif;animation:rylemSlideUp .3s ease}
    #rylem-chat-panel.visible{display:flex}
    @keyframes rylemSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    .rylem-header{background:#0c1829;padding:16px 20px;display:flex;align-items:center;gap:12px}
    .rylem-avatar{width:36px;height:36px;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;font-weight:700}
    .rylem-header-text h3{color:#fff;font-size:.9rem;font-weight:700;margin:0}
    .rylem-header-text p{color:rgba(255,255,255,.5);font-size:.7rem;margin:0}
    .rylem-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:260px;max-height:340px}
    .rylem-msg{max-width:85%;padding:10px 14px;border-radius:12px;font-size:.85rem;line-height:1.55;animation:rylemFade .3s ease}
    .rylem-msg.bot{background:#f1f5f9;color:#1a1a2e;align-self:flex-start;border-bottom-left-radius:4px}
    .rylem-msg.user{background:#2563eb;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
    @keyframes rylemFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    .rylem-typing{align-self:flex-start;padding:10px 14px;background:#f1f5f9;border-radius:12px;display:none}
    .rylem-typing span{display:inline-block;width:7px;height:7px;background:#c5c9d2;border-radius:50%;margin-right:3px;animation:rylemBounce .6s infinite}
    .rylem-typing span:nth-child(2){animation-delay:.1s}
    .rylem-typing span:nth-child(3){animation-delay:.2s;margin-right:0}
    @keyframes rylemBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
    .rylem-input{display:flex;border-top:1px solid #e5e7eb;padding:10px 12px;gap:6px}
    .rylem-input input{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:9px 12px;font-size:.85rem;font-family:inherit;outline:none;transition:border .2s}
    .rylem-input input:focus{border-color:#2563eb}
    .rylem-input button{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:.85rem;font-weight:600;cursor:pointer;transition:background .2s}
    .rylem-input button:hover{background:#1d4ed8}
    .rylem-input button:disabled{background:#94a3b8;cursor:not-allowed}
    @media(max-width:480px){#rylem-chat-panel{right:8px;left:8px;width:auto;bottom:88px;max-height:70vh}}
  `;
  document.head.appendChild(style);

  // Build widget HTML
  const toggle = document.createElement('button');
  toggle.id = 'rylem-chat-toggle';
  toggle.innerHTML = `
    <svg class="chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z"/></svg>
    <svg class="close-icon" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
  `;

  const panel = document.createElement('div');
  panel.id = 'rylem-chat-panel';
  panel.innerHTML = `
    <div class="rylem-header">
      <div class="rylem-avatar">R</div>
      <div class="rylem-header-text">
        <h3>Rylem's AI Assistant</h3>
        <p>Typically replies instantly</p>
      </div>
    </div>
    <div class="rylem-messages" id="rylem-messages">
      <div class="rylem-msg bot">Hey — welcome to Rylem. What are you trying to accomplish?</div>
    </div>
    <div class="rylem-typing" id="rylem-typing"><span></span><span></span><span></span></div>
    <div class="rylem-input">
      <input type="text" id="rylem-input" placeholder="Type a message..." autocomplete="off">
      <button id="rylem-send">Send</button>
    </div>
  `;

  document.body.appendChild(panel);
  document.body.appendChild(toggle);

  // Toggle
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('visible');
    toggle.classList.toggle('open', open);
    if (open) document.getElementById('rylem-input').focus();
  });

  // Send
  const input = document.getElementById('rylem-input');
  const sendBtn = document.getElementById('rylem-send');
  const messagesEl = document.getElementById('rylem-messages');
  const typingEl = document.getElementById('rylem-typing');

  function addMsg(text, role) {
    const div = document.createElement('div');
    div.className = `rylem-msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    sendBtn.disabled = true;
    addMsg(text, 'user');
    typingEl.style.display = 'block';
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID }),
      });
      const data = await res.json();
      typingEl.style.display = 'none';
      addMsg(data.reply || data.error || 'Something went wrong.', 'bot');
    } catch {
      typingEl.style.display = 'none';
      addMsg('Connection issue. Call us at (206) 777-7990.', 'bot');
    }
    sendBtn.disabled = false;
    input.focus();
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !sendBtn.disabled) send(); });

  // Tracking pixel — logs every page visit for company identification
  const tp = new Image();
  tp.src = 'https://chat.rylem.com/t.gif?p=' + encodeURIComponent(window.location.href) + '&_=' + Date.now();
})();
