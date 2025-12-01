// ---------------------------
// Utility Functions
// ---------------------------

function cleanFilename(name) {
    return decodeURIComponent(
        name
            .replace("/Songs/", "")
            .replace("Songs/", "")
            .replace(".mp3", "")
            .replace(/\.[^/.]+$/, "")
    );
}

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function cleanHref(href, absolute = false) {
    href = href.replace(/^\/+/, "");
    return absolute 
        ? `http://127.0.0.1:5500/${href}`
        : href;
}



// ---------------------------
// MAIN PLAYER SCRIPT
// ---------------------------

document.addEventListener("DOMContentLoaded", async () => {

    // Elements
    const PLAYLIST_URL = "http://127.0.0.1:5500/Songs/";
    const playlistContainer = document.querySelector(".song-list");

    const playBtn = document.querySelector(".play-btn");
    const nextBtn = document.querySelector(".next-btn");
    const prevBtn = document.querySelector(".prev-btn");
    const shuffleBtn = document.querySelector(".shuffle-btn");

    const progressBar = document.querySelector(".progress-bar");
    const progressFill = document.querySelector(".progress");
    const currentTimeEl = document.querySelector(".current-time");
    const totalTimeEl = document.querySelector(".total-time");

    const albumArt = document.querySelector(".album-art");
    const titleEl = document.querySelector(".song-title");
    const artistEl = document.querySelector(".song-artist");



    // State
    let audio = new Audio();
    let songs = [];
    let currentIndex = 0;

    let playNextQueue = [];

    let isShuffle = false;
    let shuffleHistory = [];

    let isDragging = false;
    let wasPlaying = false;



    // ---------------------------
    // Load Songs From Directory
    // ---------------------------

    async function loadSongs() {
        const res = await fetch(PLAYLIST_URL);
        const html = await res.text();

        const doc = new DOMParser().parseFromString(html, "text/html");
        const links = [...doc.querySelectorAll("a")];

        songs = links
            .map(a => a.getAttribute("href"))
            .filter(name => name.endsWith(".mp3"))
            .map(name => ({
                title: cleanFilename(name),
                file: cleanHref(name),
                src: cleanHref(name, true),
                artist: "Unknown Artist",
                cover: `https://picsum.photos/300?random=${Math.random()}`
            }));

        renderPlaylist();
        loadSong(0);
    }



    // ---------------------------
    // Render Playlist
    // ---------------------------

    function renderPlaylist() {
        playlistContainer.innerHTML = "";

        songs.forEach((song, i) => {
            const li = document.createElement("li");
            li.classList.add("song-item");
            if (i === 0) li.classList.add("active");

            li.dataset.index = i;

            li.innerHTML = `
                <div class="song-item-info">
                    <div class="song-item-title">${song.title}</div>
                    <div class="song-item-artist">${song.artist}</div>
                </div>

                <div class="song-item-actions">
                    <button class="action-btn play-inline">Play</button>
                    <button class="action-btn play-next-btn">Play Next</button>
                </div>
            `;

            playlistContainer.appendChild(li);
        });

        attachPlaylistListeners();
    }



    // ---------------------------
    // Load Song Into Player
    // ---------------------------

    function loadSong(index) {
        currentIndex = index;

        const song = songs[index];
        audio.src = song.src;
        audio.load();

        titleEl.textContent = song.title;
        artistEl.textContent = song.artist;

        albumArt.innerHTML = `<img src="${song.cover}" alt="">`;

        highlightActiveSong();
    }

    function highlightActiveSong() {
        document.querySelectorAll(".song-item")
            .forEach(item => item.classList.remove("active"));

        document.querySelector(`.song-item[data-index="${currentIndex}"]`)
            .classList.add("active");
    }



    // ---------------------------
    // Playlist Item Logic
    // ---------------------------

    function attachPlaylistListeners() {

        // click whole item
        document.querySelectorAll(".song-item").forEach(item => {
            item.addEventListener("click", (e) => {
                if (e.target.classList.contains("action-btn")) return;
                loadSong(+item.dataset.index);
                audio.play();
            });
        });

        // inline play
        document.querySelectorAll(".play-inline").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                loadSong(+btn.closest(".song-item").dataset.index);
                audio.play();
            });
        });

        // play next queue
        document.querySelectorAll(".play-next-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const index = +btn.closest(".song-item").dataset.index;

                if (index === currentIndex) return;

                const pos = playNextQueue.indexOf(index);
                if (pos !== -1) playNextQueue.splice(pos, 1);

                playNextQueue.push(index);
                console.log("Queue now:", playNextQueue);
            });
        });
    }



    // ---------------------------
    // Player Controls
    // ---------------------------

    playBtn.addEventListener("click", () => {
        if (audio.paused) audio.play();
        else audio.pause();
    });

    nextBtn.addEventListener("click", () => {

        // queue first
        if (playNextQueue.length > 0) {
            loadSong(playNextQueue.shift());
            audio.play();
            return;
        }

        // shuffle enabled
        if (isShuffle) {
            shuffleHistory.push(currentIndex);
            currentIndex = getRandomSongIndex();
            loadSong(currentIndex);
            audio.play();
            return;
        }

        // normal next
        currentIndex = (currentIndex + 1) % songs.length;
        loadSong(currentIndex);
        audio.play();
    });

    prevBtn.addEventListener("click", () => {

        if (isShuffle && shuffleHistory.length > 0) {
            loadSong(shuffleHistory.pop());
            audio.play();
            return;
        }

        currentIndex = (currentIndex - 1 + songs.length) % songs.length;
        loadSong(currentIndex);
        audio.play();
    });

    shuffleBtn.addEventListener("click", () => {
        isShuffle = !isShuffle;
        shuffleBtn.classList.toggle("active");
        shuffleHistory = [];
    });



    // ---------------------------
    // Play/Pause UI Sync
    // ---------------------------

    audio.addEventListener("play", () => playBtn.textContent = "Pause");
    audio.addEventListener("pause", () => playBtn.textContent = "Play");
    audio.addEventListener("ended", () => playBtn.textContent = "Play");



    // ---------------------------
    // Progress Bar Logic
    // ---------------------------

    audio.addEventListener("timeupdate", () => {
        if (!isDragging && audio.duration > 0) {
            const percent = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = percent + "%";
        }
        currentTimeEl.textContent = formatTime(audio.currentTime);
    });

    audio.addEventListener("loadedmetadata", () => {
        if (!isNaN(audio.duration))
            totalTimeEl.textContent = formatTime(audio.duration);
    });

    progressBar.addEventListener("click", e => {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    });



    // DRAG LOGIC
    progressBar.addEventListener("mousedown", e => {
        isDragging = true;
        wasPlaying = !audio.paused;

        updateDrag(e);

        document.addEventListener("mousemove", updateDrag);
        document.addEventListener("mouseup", stopDrag);
    });

    function updateDrag(e) {
        const rect = progressBar.getBoundingClientRect();
        let x = e.clientX - rect.left;

        x = Math.max(0, Math.min(x, rect.width));
        const percent = x / rect.width;

        progressFill.style.width = percent * 100 + "%";
        currentTimeEl.textContent = formatTime(percent * audio.duration);
    }

    function stopDrag(e) {
        const rect = progressBar.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));

        audio.currentTime = (x / rect.width) * audio.duration;
        isDragging = false;

        if (wasPlaying) audio.play();

        document.removeEventListener("mousemove", updateDrag);
        document.removeEventListener("mouseup", stopDrag);
    }



    // ---------------------------
    // Shuffle Logic
    // ---------------------------

    function getRandomSongIndex() {
        if (songs.length <= 1) return currentIndex;

        let next = currentIndex;
        while (next === currentIndex) {
            next = Math.floor(Math.random() * songs.length);
        }
        return next;
    }

    audio.addEventListener("ended", () => {
        nextBtn.click();
    });

    // Load everything
    await loadSongs();
});
