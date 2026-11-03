// Lyrics mode (?lyrics): the posters that take a name draw the words Spotify is singing right now, and the whole
// screen can be recorded with the song's audio. Local only: the words come from a Wordflow3d server on this
// machine (~/Documents/Coding/Wordflow3d, `python3 app.py`).
//
// The song's whole word timeline is buffered (GET /timeline), cut into groups ahead of time, and each group is
// shown whole, on the server's clock (GET /status: progress, polled and run forward locally between polls).
// So a group never grows while it is sung: the poster changes only when the next group starts.
//
//   ?lyrics                    live words from Wordflow3d
//   ?lyrics&demo               a fixed word list on a clock, for testing without Spotify (?demo=<ms> per word)
//   ?lyrics&p=<slug>           start on one poster (any poster that takes a name)
//   ?lyrics&words=1|2|3|auto   how many words the poster holds at once (also the Words control; remembered)
//   ?lyrics&lead=<ms>          show each group this much early, to cover the poster's redraw (default 60)
//
// Keys: H hides the controls, W cycles Words, F fullscreen, R starts / stops a recording, Space or the right arrow shuffles.

const SERVER = 'http://127.0.0.1:8888';
const POLL_MS = 100;                                       // the clock is re-anchored this often; it runs forward locally in between
const TICK_MS = 16;
const DEMO = ['Hello,', 'from', 'the', 'other', 'side', 'I', 'must', 'have', 'called', 'a', 'thousand', 'times'];

// One word a poster can set: letters, digits, apostrophes and hyphens only.
export function cleanWord(raw) {
  const w = String(raw ?? '').replace(/[’‘]/g, "'").replace(/[^\p{L}\p{M}0-9'-]/gu, '').replace(/^['-]+|['-]+$/g, '');
  return w.slice(0, 20);
}

// Words a phrase leans on: in Auto they never end a group, so "the" waits for "night" and "I" for "must".
const LEAN = new Set('a an the i i\'m i\'ll i\'d i\'ve to of in on at by for from with and but or so my your his her our their its me you we they is are was be no not if as that this like just oh'.split(' '));
const ENDS_OK = new Set('me you is are was be just like oh that this its not no'.split(' '));   // lean, but just as often close a phrase ("love you")
const AUTO = { maxWords: 3, maxChars: 16, gapMs: 700 };   // Auto: up to three words or 16 letters; a lyric line, punctuation or a pause starts a new group

// Credit lines some lyric sources put at the top (NetEase: 作词 lyricist, 作曲 composer...) are not sung.
const CREDIT = /^(作词|作曲|编曲|制作|监制|混音|母带|和声|录音|吉他|贝斯|鼓|词|曲)$|:$/u;

// Cuts a timeline ([{ start, end, text }], ms) into the groups the poster shows: [{ start, words: [...] }].
// mode is 1, 2, 3 or 'auto'. A new lyric line always starts a new group, so a group never straddles two lines.
export function groupTimeline(timeline, lineStarts = [], mode = 'auto') {
  const lines = new Set(lineStarts.map((t) => Math.round(t)));
  const groups = [];
  let group = null, prev = null, ended = false, credit = false;
  for (const e of timeline) {
    const lineStart = lines.has(Math.round(e.start));
    if (lineStart) credit = CREDIT.test(String(e.text).trim());
    const word = cleanWord(e.text);
    if (!word || credit) continue;
    const n = group ? group.words.length : 0;
    let fresh;
    if (!n) fresh = true;
    else if (mode === 'auto') {
      const last = group.words[n - 1].toLowerCase(), w = word.toLowerCase();
      const leaning = LEAN.has(last);
      const chars = group.words.join('').length + word.length;
      const opens = LEAN.has(w) && !ENDS_OK.has(w) && !leaning;            // "the", "I", "a" usually open the next phrase
      fresh = lineStart || ended || e.start - prev.end > AUTO.gapMs || opens
        || (!leaning && (n >= AUTO.maxWords || chars > AUTO.maxChars))
        || n >= AUTO.maxWords + 1;                                          // a leaning word may stretch a group to four, never more
    } else fresh = lineStart || n >= mode;
    if (fresh) groups.push(group = { start: e.start, words: [] });
    group.words.push(word);
    ended = /[.,!?;:…]$/.test(String(e.text).trim());                       // punctuation in the lyric ends the phrase
    prev = e;
  }
  return groups;
}

// The group showing at time t (ms): the last one that has started, or -1 before the first.
function groupAt(groups, t) {
  let lo = 0, hi = groups.length - 1, at = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (groups[mid].start <= t) { at = mid; lo = mid + 1; } else hi = mid - 1; }
  return at;
}

// setWord(words) redraws the poster (words joined by spaces, one line each); shuffle() moves to another poster; toast(msg) shows a short line.
export function startLyrics({ setWord, shuffle, toast, getSlug }) {
  const params = new URLSearchParams(location.search);
  const demo = params.has('demo');
  const LEAD = Number.isFinite(+params.get('lead')) && params.get('lead') !== null ? +params.get('lead') : 60;
  document.documentElement.dataset.lyrics = '';

  // ---------- the controls ----------
  const hud = document.createElement('div');
  hud.className = 'lyr-hud';
  hud.innerHTML = `
    <div class="lyr-row lyr-now"><span class="lyr-dot"></span><span class="lyr-track">Waiting for Spotify</span></div>
    <div class="lyr-row lyr-word" aria-live="off"></div>
    <div class="lyr-row lyr-modes" role="group" aria-label="Words at once">Words
      <button type="button" data-m="auto">Auto</button><button type="button" data-m="1">1</button><button type="button" data-m="2">2</button><button type="button" data-m="3">3</button>
    </div>
    <div class="lyr-row">
      <label>Audio <select class="lyr-audio"><option value="share">From the screen share</option><option value="none">No audio</option></select></label>
    </div>
    <div class="lyr-row lyr-btns">
      <button type="button" class="lyr-rec">● Record</button>
      <button type="button" class="lyr-full">Fullscreen</button>
      <button type="button" class="lyr-next">Next poster</button>
    </div>
    <div class="lyr-row lyr-keys">H hide · W words · F fullscreen · R record · Space next poster</div>`;
  document.body.appendChild(hud);
  const q = (s) => hud.querySelector(s);
  const trackEl = q('.lyr-track'), wordEl = q('.lyr-word'), dot = q('.lyr-dot'), audioSel = q('.lyr-audio'), recBtn = q('.lyr-rec');

  let hidden = false;
  const setHidden = (v) => { hidden = v; hud.classList.toggle('off', v); };

  // ---------- the buffer and the clock ----------
  let online = false, pending = null, applying = false;
  let track = null;                 // { id, timeline, lineStarts } once its words are buffered
  let groups = [], shown = -2;      // the groups for the current Words setting, and the one on screen
  let clock = null;                 // { progress, at, playing }: the server's position at performance.now() === at
  const MODES = ['auto', 1, 2, 3];
  const parseMode = (v) => (v === 'auto' ? 'auto' : MODES.includes(+v) ? +v : null);
  let saved = null;
  try { saved = localStorage.getItem('swt:lyrics-words'); } catch (e) { /* private mode */ }
  let mode = parseMode(params.get('words')) ?? parseMode(saved) ?? 'auto';
  function regroup() {
    groups = track ? groupTimeline(track.timeline, track.lineStarts, mode) : [];
    shown = -2;                                                             // redraw on the next tick
  }
  function setMode(m) {
    mode = m;
    try { localStorage.setItem('swt:lyrics-words', String(m)); } catch (e) { /* private mode */ }
    hud.querySelectorAll('.lyr-modes button').forEach((b) => b.classList.toggle('on', parseMode(b.dataset.m) === m));
    regroup();
  }
  hud.querySelectorAll('.lyr-modes button').forEach((b) => b.addEventListener('click', () => setMode(parseMode(b.dataset.m))));
  setMode(mode);

  async function apply(text) {
    pending = text;
    if (applying) return;                     // the newest group wins: a group that arrives while a poster mounts replaces the waiting one
    applying = true;
    while (pending !== null) { const w = pending; pending = null; try { await setWord(w); } catch (e) { console.error('[lyrics]', e); } }
    applying = false;
  }
  function setOnline(v, label) {
    online = v;
    dot.classList.toggle('on', v);
    trackEl.textContent = label;
  }
  const now = () => (clock ? clock.progress + (clock.playing ? performance.now() - clock.at : 0) : 0);

  // Every tick: which group should be on screen, and redraw only when that changes.
  setInterval(() => {
    if (!groups.length || !clock) return;
    const i = groupAt(groups, now() + LEAD);
    if (i === shown) return;
    shown = i;
    if (i < 0) return;                        // before the first sung word the poster keeps what it has
    const text = groups[i].words.join(' ');
    wordEl.textContent = text;
    apply(text);
  }, TICK_MS);

  async function getJSON(path) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(SERVER + path, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const j = await res.json();
      if (j.error) throw new Error(j.error);
      return j;
    } finally { clearTimeout(to); }
  }

  // The words of a new track arrive a second or so after it starts (Wordflow3d fetches them in the background).
  let loading = null, timelineMissing = false;
  async function loadTimeline(id) {
    if (loading === id) return;
    loading = id;
    try {
      const t = await getJSON('/timeline');
      if (t.track_id === id && t.words && t.words.length) {
        track = { id, timeline: t.words, lineStarts: t.line_starts || [] };
        regroup();
      }
    } catch (e) {
      if (String(e.message) === '404') timelineMissing = true;              // an older Wordflow3d without /timeline
    } finally { loading = null; }
  }

  async function poll() {
    const sentAt = performance.now();
    try {
      const s = await getJSON('/status');
      if (!s.playing || !s.track_id) { setOnline(false, 'Nothing playing in Spotify'); if (clock) clock.playing = false; return; }
      const at = (sentAt + performance.now()) / 2;                         // the server read its clock about halfway through the request
      clock = { progress: s.progress, at, playing: true };
      setOnline(true, `${s.track || ''} · ${s.artist || ''}`);
      if (!track || track.id !== s.track_id) {
        if (track && track.id !== s.track_id) { track = null; groups = []; shown = -2; }
        if (timelineMissing) { setOnline(true, 'Restart Wordflow3d: it has no /timeline yet'); return; }
        loadTimeline(s.track_id);
      }
    } catch (e) {
      setOnline(false, 'Wordflow3d is not running (python3 app.py)');
    }
  }
  const loop = async () => { await poll(); setTimeout(loop, POLL_MS); };

  if (demo) {                                 // the same path, with a made-up timeline on a local clock
    const step = +params.get('demo') || 650, t0 = performance.now();
    const timeline = [];
    for (let k = 0; k < 400; k++) timeline.push({ start: k * step, end: (k + 1) * step, text: DEMO[k % DEMO.length] });
    track = { id: 'demo', timeline, lineStarts: timeline.filter((_, k) => k % DEMO.length === 0).map((e) => e.start) };
    clock = { progress: 0, at: t0, playing: true };
    setOnline(true, 'Demo words');
    regroup();
  } else loop();

  // ---------- audio sources: the screen share's own audio, or an input device such as BlackHole ----------
  async function listInputs() {
    try {
      let devs = await navigator.mediaDevices.enumerateDevices();
      if (!devs.some((d) => d.kind === 'audioinput' && d.label)) {             // labels need one permission grant first
        const s = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
        if (s) { s.getTracks().forEach((t) => t.stop()); devs = await navigator.mediaDevices.enumerateDevices(); }
      }
      const inputs = devs.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications');
      for (const d of inputs) {
        const o = document.createElement('option');
        o.value = d.deviceId; o.textContent = d.label || 'Input';
        audioSel.insertBefore(o, audioSel.firstChild);
      }
      const bh = inputs.find((d) => /blackhole/i.test(d.label));
      audioSel.value = bh ? bh.deviceId : 'share';
    } catch (e) { /* no media devices: the share's own audio is the only choice */ }
  }
  // Device names need a microphone grant, so the list is filled the first time Audio or Record is used, not on load.
  let listed = null;
  const ensureInputs = () => (listed ||= listInputs());
  audioSel.addEventListener('pointerdown', ensureInputs);
  audioSel.addEventListener('focus', ensureInputs);

  // ---------- recording ----------
  let rec = null;
  function pickType() {
    const types = ['video/mp4;codecs=avc1.640033,mp4a.40.2', 'video/mp4;codecs=avc1,opus', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }
  async function startRec() {
    if (rec) return;
    if (!document.fullscreenElement) { try { await document.documentElement.requestFullscreen(); } catch (e) { /* the share still works windowed */ } }
    await ensureInputs();                                                  // picks BlackHole when it is installed
    const src = audioSel.value;
    let screen;
    try {
      screen = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', frameRate: { ideal: 60 }, width: { ideal: 3840 }, height: { ideal: 2160 } },
        audio: src === 'share',
        selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'include', monitorTypeSurfaces: 'include',
      });
    } catch (e) { toast('Recording cancelled'); return; }
    const tracks = [...screen.getVideoTracks()];
    let mic = null;
    if (src === 'share') {
      const a = screen.getAudioTracks();
      if (a.length) tracks.push(a[0]); else toast('The share has no audio: pick BlackHole under Audio', 4000);
    } else if (src !== 'none') {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: src }, echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2, sampleRate: 48000 } });
        tracks.push(mic.getAudioTracks()[0]);
      } catch (e) { toast('Could not open that audio input', 4000); }
    }
    const type = pickType();
    const mr = new MediaRecorder(new MediaStream(tracks), { mimeType: type || undefined, videoBitsPerSecond: 24e6, audioBitsPerSecond: 256e3 });
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      screen.getTracks().forEach((t) => t.stop());
      if (mic) mic.getTracks().forEach((t) => t.stop());
      const ext = (mr.mimeType || type).includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mr.mimeType || type });
      const name = `${(trackEl.textContent.split(' · ')[0] || 'lyrics').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'lyrics'}-${getSlug()}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      toast(`Saved ${name}`, 4000);
      rec = null;
      recBtn.textContent = '● Record';
      setHidden(false);
    };
    screen.getVideoTracks()[0].addEventListener('ended', () => stopRec());   // Chrome's own "Stop sharing" bar
    mr.start(1000);
    rec = mr;
    recBtn.textContent = '■ Stop';
    setHidden(true);                                                       // the controls stay out of the video
  }
  function stopRec() { if (rec && rec.state !== 'inactive') rec.stop(); }
  const toggleRec = () => (rec ? stopRec() : startRec());
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  recBtn.addEventListener('click', toggleRec);
  q('.lyr-full').addEventListener('click', toggleFull);
  q('.lyr-next').addEventListener('click', () => shuffle());
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, select, textarea'))) return;
    const k = e.key.toLowerCase();
    if (k === 'h') setHidden(!hidden);
    else if (k === 'w') setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
    else if (k === 'f') toggleFull();
    else if (k === 'r') toggleRec();
    else if (k === 'escape' && rec) stopRec();
  });

  return { get words() { return shown >= 0 && groups[shown] ? groups[shown].words.join(' ') : ''; }, get online() { return online; }, get recording() { return !!rec; } };
}
