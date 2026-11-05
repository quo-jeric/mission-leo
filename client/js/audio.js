import { read, write, PREFERENCE_KEY, SAVE_KEY } from './storage.js';

// Original procedural cues: no audio downloads or autoplay on page load.
export function setupMenuAudio() {
  const preferences = read(PREFERENCE_KEY) || {};
  const volume = document.querySelector('#sfx-volume');
  const mute = document.querySelector('#sfx-mute');
  const output = document.querySelector('#sfx-value');
  const preview = document.querySelector('#sfx-preview');
  // A cached/older page may not yet contain the new audio controls.
  if (!volume || !mute || !output || !preview) return;
  const stored = preferences.sfxVolume ?? read(SAVE_KEY)?.settings?.sfxVolume ?? .45;
  volume.value = String(Math.round((Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : .45) * 100));
  mute.checked = preferences.sfxMuted === true;
  let context, master, unlocked = false, lastHover = 0, keyboard = false;
  const musicEnabled = document.querySelector('#music-enabled');
  const musicVolume = document.querySelector('#music-volume');
  const musicOutput = document.querySelector('#music-value');
  musicEnabled.checked = preferences.musicEnabled === true;
  const initialMusic = preferences.musicVolume ?? .25;
  musicVolume.value = String(Math.round((Number.isFinite(initialMusic) ? Math.max(0, Math.min(1, initialMusic)) : .25) * 100));
  let musicBus, musicTimer, voices = [];
  let chord = 0;
  const chords = [[130.81, 196, 246.94], [110, 164.81, 220], [87.31, 130.81, 174.61], [98, 146.83, 196]];
  function stopMusic() {
    clearTimeout(musicTimer);
    musicTimer = undefined;
    if (!context) return;
    for (const voice of voices) {
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.setTargetAtTime(0, context.currentTime, .08);
      try { voice.oscillator.stop(context.currentTime + .5); } catch {}
    }
    voices = [];
  }
  function nextChord() {
    if (!musicEnabled.checked || document.hidden || context?.state !== 'running') { stopMusic(); return; }
    const start = context.currentTime;
    for (const frequency of chords[chord++ % chords.length]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.045, start + 2);
      gain.gain.linearRampToValueAtTime(.035, start + 6);
      gain.gain.linearRampToValueAtTime(0, start + 9);
      oscillator.connect(gain); gain.connect(musicBus);
      const voice = { oscillator, gain };
      voices.push(voice);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices = voices.filter(item => item !== voice); };
      oscillator.start(start); oscillator.stop(start + 9.1);
    }
    musicTimer = setTimeout(nextChord, 7000);
  }
  function updateMusic() {
    musicOutput.value = `${musicVolume.value}%`;
    if (!context) return;
    if (!musicBus) { musicBus = context.createGain(); musicBus.connect(context.destination); }
    musicBus.gain.setTargetAtTime(Number(musicVolume.value) / 100, context.currentTime, .1);
    if (!musicEnabled.checked || document.hidden || Number(musicVolume.value) === 0) stopMusic();
    else if (context.state === 'running' && musicTimer === undefined) nextChord();
  }
  function activateAudio() {
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        master = context.createGain(); master.connect(context.destination); update();
      }
      unlocked = true;
      if (context.state === 'suspended') context.resume().then(updateMusic).catch(() => {});
      else updateMusic();
    } catch { /* Audio stays optional. */ }
  }
  function saveMusic() {
    const saved = write(PREFERENCE_KEY, { ...read(PREFERENCE_KEY), musicEnabled: musicEnabled.checked, musicVolume: Number(musicVolume.value) / 100 });
    activateAudio(); updateMusic();
    document.querySelector('#settings-dialog .hint').textContent = saved ? 'Your preferences are saved on this device.' : 'Music preference applied for this session.';
  }
  musicEnabled.addEventListener('change', saveMusic);
  musicVolume.addEventListener('input', saveMusic);
  document.addEventListener('pointerdown', event => { if (event.isTrusted) activateAudio(); }, { once: true });
  document.addEventListener('keydown', event => { if (event.isTrusted) activateAudio(); }, { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopMusic(); if (context?.state === 'running') context.suspend().catch(() => {}); }
    else if (unlocked && context) context.resume().then(updateMusic).catch(() => {});
  });
  window.addEventListener('pagehide', () => { stopMusic(); context?.close().catch(() => {}); }, { once: true });
  updateMusic();
  const cues = {
    hover: [[880, 1050, 0, .035, .055]],
    click: [[620, 820, 0, .075, .12]],
    launch: [[520, 680, 0, .09, .12], [780, 1040, .085, .15, .1]],
    back: [[540, 330, 0, .1, .1]],
    locked: [[240, 210, 0, .08, .09], [210, 180, .11, .09, .07]],
  };
  function update() {
    output.value = `${volume.value}%`;
    if (master && context) master.gain.setTargetAtTime(mute.checked ? 0 : Number(volume.value) / 100, context.currentTime, .015);
  }
  function persist() {
    update();
    const saved = write(PREFERENCE_KEY, { ...read(PREFERENCE_KEY), sfxVolume: Number(volume.value) / 100, sfxMuted: mute.checked });
    document.querySelector('#settings-dialog .hint').textContent = saved
      ? 'Your preferences are saved on this device.'
      : 'Preferences applied for this session. Device storage is unavailable.';
  }
  function play(name, activate = false) {
    if (mute.checked || Number(volume.value) === 0) return;
    try {
      if (!context) {
        if (!activate) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        master = context.createGain();
        master.connect(context.destination);
        update();
      }
      if (activate) unlocked = true;
      if (!unlocked || document.hidden) return;
      const schedule = () => {
        if (context.state !== 'running' || document.hidden || mute.checked) return;
        for (const [from, to, delay, duration, level] of cues[name]) {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          const start = context.currentTime + delay;
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(from, start);
          oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
          envelope.gain.setValueAtTime(0, start);
          envelope.gain.linearRampToValueAtTime(level, start + .006);
          envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
          oscillator.connect(envelope);
          envelope.connect(master);
          oscillator.start(start);
          oscillator.stop(start + duration + .01);
          oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
        }
      };
      if (context.state === 'suspended' && activate) context.resume().then(schedule).catch(() => {});
      else schedule();
    } catch { /* Audio is optional; navigation must always remain usable. */ }
  }
  document.addEventListener('pointerdown', () => { keyboard = false; }, true);
  document.addEventListener('keydown', event => { if (event.key === 'Tab' || event.key.startsWith('Arrow')) keyboard = true; }, true);
  function hover(button) {
    const now = performance.now();
    if (!button || button.disabled || now - lastHover < 90) return;
    lastHover = now;
    play('hover');
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const button = event.target.closest('button');
    if (button && !button.contains(event.relatedTarget)) hover(button);
  });
  document.addEventListener('focusin', event => { if (keyboard) hover(event.target.closest('button')); });
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const button = event.target.closest('button');
    if (!button || button.disabled || button.id === 'sfx-preview') return;
    const back = button.classList.contains('close') || button.id === 'mission-back' || button.closest('form[method="dialog"]') && !button.id;
    play(button.dataset.locked === 'true' ? 'locked' : ['play', 'begin-mission'].includes(button.id) ? 'launch' : back ? 'back' : 'click', true);
  }, true);
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('cancel', event => {
    if (event.isTrusted) play('back', true);
  }));
  volume.addEventListener('input', persist);
  volume.addEventListener('change', () => play('click', true));
  mute.addEventListener('change', persist);
  preview.addEventListener('click', () => play('launch', true));
  update();
}
