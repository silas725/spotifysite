const clientId = "618cb87ab4eb47c282c7a1c8b27f56ef";
const redirectUri = "https://silas725.github.io/spotifysite/callback";
const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state"
];

const loginBtn = document.getElementById("login");
const logoutBtn = document.getElementById("logout");
const statusDiv = document.getElementById("status");

function getToken() {
  const token = localStorage.getItem("sp_token");
  const expires = localStorage.getItem("sp_token_expires");
  if (!token || !expires) return null;
  if (Date.now() > Number(expires)) {
    localStorage.removeItem("sp_token");
    localStorage.removeItem("sp_token_expires");
    return null;
  }
  return token;
}

function logout() {
  localStorage.removeItem("sp_token");
  localStorage.removeItem("sp_token_expires");
  updateUI();
}

function doLogin() {
  const authUrl =
    "https://accounts.spotify.com/authorize" +
    "?response_type=token" +
    "&client_id=" + encodeURIComponent(clientId) +
    "&scope=" + encodeURIComponent(scopes.join(" ")) +
    "&redirect_uri=" + encodeURIComponent(redirectUri);
  window.location.href = authUrl;
}

loginBtn.onclick = doLogin;
logoutBtn.onclick = logout;

function updateUI() {
  const token = getToken();
  if (token) {
    statusDiv.textContent = "Logged in (token present)";
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";

    fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: "Bearer " + token }
    })
      .then(r => r.json())
      .then(profile => {
        statusDiv.textContent = "Logged in as: " + profile.display_name;
      })
      .catch(err => {
        console.error(err);
        statusDiv.textContent = "Logged in but API call failed.";
      });
  } else {
    statusDiv.textContent = "Not logged in";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
  }
}

updateUI();
