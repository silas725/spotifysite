const CLIENT_ID = "6f835ac6515e4555bdc4ab07955a2d80";
const REDIRECT_URI = "https://silas725.github.io/spotifysite/callback";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state"
];

const statusEl = document.getElementById("status");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const nowEl = document.getElementById("now");

function bufToBase64Url(buffer) {
  let bytes = new Uint8Array(buffer);
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePKCECodes() {
  const array = new Uint8Array(64);
  window.crypto.getRandomValues(array);
  let v = btoa(String.fromCharCode.apply(null, Array.from(array))).replace(/\W/g, '').slice(0, 128);
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(v));
  const challenge = bufToBase64Url(digest);
  return { verifier: v, challenge };
}

function saveItem(k, v) { localStorage.setItem(k, v); }
function getItem(k) { return localStorage.getItem(k); }
function removeItem(k) { localStorage.removeItem(k); }

btnLogin.addEventListener('click', async () => {
  const { verifier, challenge } = await generatePKCECodes();
  saveItem('pkce_verifier', verifier);
  const state = Math.random().toString(36).substring(2, 12);
  saveItem('pkce_state', state);

  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('state', state);

  window.location = authUrl.toString();
});

btnLogout.addEventListener('click', () => {
  removeItem('sp_access_token');
  removeItem('sp_refresh_token');
  removeItem('sp_token_expires');
  removeItem('pkce_verifier');
  removeItem('pkce_state');
  updateUI();
});

function parseQuery(qs) {
  if (!qs) return {};
  return qs.replace(/^\?/, '').split('&').reduce((acc, p) => {
    const [k, v] = p.split('=');
    acc[decodeURIComponent(k)] = decodeURIComponent(v || '');
    return acc;
  }, {});
}

async function exchangeCodeForToken(code, verifier) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier
  });

  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('Token exchange failed: ' + resp.status + ' ' + txt);
  }
  return await resp.json();
}

function saveTokenResponse(json) {
  const expiresAt = Date.now() + (json.expires_in || 3600) * 1000;
  saveItem('sp_access_token', json.access_token);
  if (json.refresh_token) saveItem('sp_refresh_token', json.refresh_token);
  saveItem('sp_token_expires', expiresAt);
}

function getToken() {
  const t = getItem('sp_access_token');
  const exp = getItem('sp_token_expires');
  if (!t || !exp) return null;
  if (Date.now() > Number(exp)) { removeItem('sp_access_token'); removeItem('sp_token_expires'); return null; }
  return t;
}

async function handleRedirectCallback() {
  const qs = window.location.search;
  if (!qs) return false;
  const params = parseQuery(qs);
  if (params.error) { statusEl.textContent = 'Auth error: ' + params.error; return true; }
  if (params.code) {
    const code = params.code;
    const state = params.state;
    const savedState = getItem('pkce_state');
    if (!savedState || savedState !== state) { statusEl.textContent = 'State mismatch'; return true; }
    const verifier = getItem('pkce_verifier');
    if (!verifier) { statusEl.textContent = 'Missing PKCE verifier'; return true; }

    statusEl.textContent = 'Exchanging code for token...';
    try {
      const tokenJson = await exchangeCodeForToken(code, verifier);
      saveTokenResponse(tokenJson);
      history.replaceState({}, document.title, '/spotifysite/');
      return true;
    } catch (err) {
      statusEl.textContent = 'Token exchange failed: ' + err.message;
      console.error(err);
      return true;
    }
  }
  return false;
}

let progressInterval;

function postToOverlayBridge(nowPlaying) {
  fetch('http://localhost:3131/track', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(nowPlaying)
  }).catch(()=>{});
}

function showNowPlaying(state) {
  if (!state) {
    nowEl.innerHTML = "";
    if (progressInterval) clearInterval(progressInterval);
    localStorage.removeItem('overlay_nowplaying');
    // Bridge update (clear info)
    postToOverlayBridge({});
    return;
  }

  const track = state.track_window.current_track;
  const artists = track.artists.map(a => a.name).join(", ");
  const duration = track.duration_ms;
  let position = state.position;

  const nowPlaying = {
    name: track.name,
    artists: artists,
    albumArt: track.album.images[0].url,
    duration: duration,
    position: position,
    timestamp: Date.now()
  };
  localStorage.setItem('overlay_nowplaying', JSON.stringify(nowPlaying));
  // Send to Node bridge!
  postToOverlayBridge(nowPlaying);

  nowEl.innerHTML = `
    <div style="width:100%; max-width:260px; margin:auto; text-align:center; font-family:sans-serif;">
      <img src="${track.album.images[0].url}"
           style="width:100%; border-radius:12px; margin-bottom:12px;">
      <div style="font-size:16px; font-weight:600;">${track.name}</div>
      <div style="font-size:13px; color:#888; margin-bottom:8px;">${artists}</div>
      <div id="progress-container"
           style="width:100%; height:6px; background:#ccc; border-radius:4px; overflow:hidden;">
        <div id="progress-bar"
             style="height:100%; width:0%; background:#1DB954;"></div>
      </div>
    </div>
  `;

  const bar = document.getElementById("progress-bar");

  if (progressInterval) clearInterval(progressInterval);

  progressInterval = setInterval(() => {
    position += 1000;
    const pct = Math.min(position / duration, 1) * 100;
    bar.style.width = pct + "%";
  }, 1000);
  
}
 
function initPlayer(token) {
  if (!token) return;
  if (typeof Spotify === 'undefined') {
    const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; document.body.appendChild(s);
  }

  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: 'PKCE Web Player',
      getOAuthToken: cb => cb(token),
      volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
      statusEl.textContent = 'Player ready — device id: ' + device_id;
      fetch('https://api.spotify.com/v1/me/player', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_ids: [device_id], play: false })
      }).catch(() => { });
    });

    player.addListener('player_state_changed', state => showNowPlaying(state));
    player.connect();
  };
}

async function updateUI() {
  const token = getToken();
  if (token) {
    btnLogin.style.display = 'none'; btnLogout.style.display = 'inline-block';
    try {
      const me = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
      statusEl.textContent = 'Logged in as ' + (me.display_name || me.id);
    } catch (e) { statusEl.textContent = 'Logged in (API call failed)'; }
    initPlayer(token);
  } else {
    btnLogin.style.display = 'inline-block'; btnLogout.style.display = 'none'; statusEl.textContent = 'Not logged in';
  }
}

(async () => {
  const handled = await handleRedirectCallback();
  if (!handled) await updateUI();
  else await updateUI();
})();
