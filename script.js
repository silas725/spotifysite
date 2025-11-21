const clientId = "6f835ac6515e4555bdc4ab07955a2d80";
const redirectUri = "https://silas725.github.io/spotifysite/callback";
const scope = "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state";

// Parse token from URL if exists
const params = new URLSearchParams(window.location.search);
const accessToken = params.get("access_token");

document.getElementById("loginBtn").onclick = () => {
    const authUrl =
        "https://accounts.spotify.com/authorize" +
        "?response_type=token" +
        "&client_id=" + clientId +
        "&scope=" + encodeURIComponent(scope) +
        "&redirect_uri=" + encodeURIComponent(redirectUri);

    window.location.href = authUrl;
};

if (accessToken) {
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("playerInfo").innerText = "Logged in! Loading player...";

    window.onSpotifyWebPlaybackSDKReady = () => {
        const player = new Spotify.Player({
            name: "Web Player",
            getOAuthToken: cb => cb(accessToken)
        });

        player.addListener("ready", ({ device_id }) => {
            document.getElementById("playerInfo").innerText =
                "Player ready! Device ID: " + device_id;
        });

        player.connect();
    };

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(script);
}
