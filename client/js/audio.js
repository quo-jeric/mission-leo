// Edit paths and per-clip levels here. Master volume and mute live in localStorage.
const AUDIO_CONFIG = {
  music: {
    landing: { src: '/assets/audio/landing.mp3', volume: 0.5 },
    missionSelect: { src: '/assets/audio/mission_select.mp3', volume: 0.5 },
  },
  sfx: {
    uiClick: { src: '/assets/audio/ui_click.wav', volume: 0.7 },
  },
};

const SETTINGS_KEY = 'leo_audio_settings_v1';
const FADE_MS = 400;
const PRIMARY_BUTTON = 'nav button, button.action';

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.min(1, Math.max(0, number));
}

function readSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    return {
      muted: parsed?.muted === true,
      volume: clamp01(parsed?.volume ?? 1),
    };
  } catch {
    return { muted: false, volume: 1 };
  }
}

function createManager() {
  const initial = readSettings();
  let muted = initial.muted;
  let volume = initial.volume;
  let unlocked = false;
  let queuedTrack = null;
  let currentId = null;
  let active = null;
  const watchers = new Set();
  const music = new Map();
  const sfx = new Map();

  for (const [id, spec] of Object.entries(AUDIO_CONFIG.music)) {
    const el = new Audio(spec.src);
    el.preload = 'auto';
    el.loop = true;
    el.volume = 0;
    music.set(id, { ...spec, el });
  }

  for (const [id, spec] of Object.entries(AUDIO_CONFIG.sfx)) {
    const el = new Audio(spec.src);
    el.preload = 'auto';
    el.loop = false;
    sfx.set(id, { ...spec, el });
  }

  function notify(saved, fromUser = false) {
    for (const watcher of watchers) watcher({ muted, volume, saved, fromUser });
  }

  function persist() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ muted, volume }));
      return true;
    } catch {
      return false;
    }
  }

  function levelFor(spec) {
    return muted ? 0 : spec.volume * volume;
  }

  function fade(el, getTarget) {
    const ramp = (el._ramp || 0) + 1;
    el._ramp = ramp;
    const start = el.volume;
    const began = performance.now();
    const done = new Promise((resolve) => {
      const step = (now) => {
        if (el._ramp !== ramp) {
          resolve(false);
          return;
        }
        // A callback in the current frame can predate a fade started mid-frame.
        const t = clamp01((now - began) / FADE_MS);
        const target = getTarget();
        el.volume = clamp01(start + (target - start) * t);
        if (t < 1) requestAnimationFrame(step);
        else {
          el.volume = getTarget();
          resolve(true);
        }
      };
      requestAnimationFrame(step);
    });
    return { ramp, done };
  }

  function startTrack(trackId) {
    const spec = music.get(trackId);
    if (!spec) return;
    queuedTrack = trackId;
    if (currentId === trackId && active === spec.el && !spec.el.paused) {
      applyLevel();
      return;
    }

    const outgoing = active && active !== spec.el ? active : null;
    currentId = trackId;
    active = spec.el;
    spec.el.loop = true;

    if (spec.el.paused) {
      spec.el.volume = 0;
      spec.el.play().catch(() => {});
    }

    fade(spec.el, () => levelFor(spec));

    if (outgoing) {
      const fadeOut = fade(outgoing, () => 0);
      fadeOut.done.then((finished) => {
        if (!finished || outgoing._ramp !== fadeOut.ramp || active === outgoing) return;
        outgoing.pause();
      });
    }
  }

  function playMusic(trackId) {
    if (!music.has(trackId)) return;
    queuedTrack = trackId;
    if (!unlocked) return;
    startTrack(trackId);
  }

  function stopMusic() {
    queuedTrack = null;
    const outgoing = active;
    active = null;
    currentId = null;
    if (!outgoing) return;
    const fadeOut = fade(outgoing, () => 0);
    fadeOut.done.then((finished) => {
      if (!finished || outgoing._ramp !== fadeOut.ramp || active === outgoing) return;
      outgoing.pause();
    });
  }

  function playSfx(sfxId) {
    const spec = sfx.get(sfxId);
    if (!spec || !unlocked || muted || volume === 0) return;
    const cue = new Audio(spec.src);
    cue.loop = false;
    cue.volume = spec.volume * volume;
    cue.play().catch(() => {});
  }

  function applyLevel() {
    if (!active || !currentId) return;
    const spec = music.get(currentId);
    if (!spec) return;
    active._ramp = (active._ramp || 0) + 1;
    active.volume = levelFor(spec);
  }

  function setMuted(value) {
    muted = Boolean(value);
    const saved = persist();
    if (!muted && unlocked && queuedTrack) startTrack(queuedTrack);
    else applyLevel();
    notify(saved, true);
  }

  function setVolume(value) {
    volume = clamp01(value);
    const saved = persist();
    applyLevel();
    notify(saved, true);
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  function onGesture() {
    if (unlocked) return;
    unlocked = true;
    document.removeEventListener('pointerdown', onGesture, true);
    document.removeEventListener('click', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
    if (queuedTrack) startTrack(queuedTrack);
  }

  document.addEventListener('pointerdown', onGesture, true);
  document.addEventListener('click', onGesture, true);
  document.addEventListener('keydown', onGesture, true);

  return {
    playMusic,
    stopMusic,
    playSfx,
    setMuted,
    setVolume,
    toggleMute,
    subscribe(watcher) {
      watchers.add(watcher);
      watcher({ muted, volume, saved: true });
      return () => watchers.delete(watcher);
    },
    get muted() { return muted; },
    get volume() { return volume; },
  };
}

export const audioManager = createManager();

let interfaceReady = false;

function syncSettings(state) {
  const mute = document.querySelector('#sfx-mute');
  const musicEnabled = document.querySelector('#music-enabled');
  const musicVolume = document.querySelector('#music-volume');
  const sfxVolume = document.querySelector('#sfx-volume');
  const musicOutput = document.querySelector('#music-value');
  const sfxOutput = document.querySelector('#sfx-value');
  const percent = String(Math.round(state.volume * 100));
  if (mute) mute.checked = state.muted;
  if (musicEnabled) musicEnabled.checked = !state.muted;
  if (musicVolume && document.activeElement !== musicVolume) musicVolume.value = percent;
  if (sfxVolume && document.activeElement !== sfxVolume) sfxVolume.value = percent;
  if (musicOutput) musicOutput.value = `${musicVolume?.value ?? percent}%`;
  if (sfxOutput) sfxOutput.value = `${sfxVolume?.value ?? percent}%`;
  const hint = document.querySelector('#settings-dialog .hint');
  if (hint && state.fromUser) {
    hint.textContent = state.saved
      ? 'Your preferences are saved on this device.'
      : 'Audio preference applied for this session. Device storage is unavailable.';
  }
}

function paintToggle(button, state) {
  const on = !state.muted;
  button.setAttribute('aria-pressed', String(state.muted));
  button.setAttribute('aria-label', on ? 'Audio on' : 'Audio off');
  button.title = on ? 'Audio on' : 'Audio off';
  button.classList.toggle('is-muted', state.muted);
}

export function mountAudioUi() {
  if (interfaceReady) return;
  interfaceReady = true;

  const button = document.querySelector('#audio-toggle');
  if (button) {
    audioManager.subscribe((state) => paintToggle(button, state));
    button.addEventListener('click', () => audioManager.toggleMute());
  }

  document.addEventListener('click', (event) => {
    const control = event.target.closest(PRIMARY_BUTTON);
    if (!control || control.disabled || control.id === 'audio-toggle') return;
    audioManager.playSfx('uiClick');
  });

  const mute = document.querySelector('#sfx-mute');
  const musicEnabled = document.querySelector('#music-enabled');
  const musicVolume = document.querySelector('#music-volume');
  const sfxVolume = document.querySelector('#sfx-volume');
  mute?.addEventListener('change', () => audioManager.setMuted(mute.checked));
  musicEnabled?.addEventListener('change', () => audioManager.setMuted(!musicEnabled.checked));
  const onVolume = (input) => audioManager.setVolume(Number(input.value) / 100);
  musicVolume?.addEventListener('input', () => onVolume(musicVolume));
  sfxVolume?.addEventListener('input', () => onVolume(sfxVolume));

  audioManager.subscribe((state) => syncSettings(state));
}
