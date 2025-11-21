const token = localStorage.getItem("sp_access_token"); 

async function getNowPlaying() {
  if (!token) {
    document.getElementById("track").innerText = "Not logged in.";
    return;
  }

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: "Bearer " + token }
  });

  if (res.status === 204) return; // No music playing

  const data = await res.json();
  const track = data.item;

  document.getElementById("album").src = track.album.images[0].url;
  document.getElementById("track").innerText = track.name;
  document.getElementById("artist").innerText = track.artists.map(a => a.name).join(", ");

  // Progress bar
  const pct = (data.progress_ms / track.duration_ms) * 100;
  document.getElementById("bar").style.width = pct + "%";
}

// Update every second
setInterval(getNowPlaying, 1000);
getNowPlaying();
