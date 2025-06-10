// Elements
const darkModeToggle = document.getElementById('darkModeToggle');
const body = document.body;
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const replayBtn = document.getElementById('replayBtn');
const channelInput = document.getElementById('channelInput');
const twitchPlayer = document.getElementById('twitchPlayer');
const nowPlaying = document.getElementById('nowPlaying');
const loading = document.getElementById('loading');
const channelHistoryEl = document.getElementById('channelHistory');
const sidebar = document.getElementById('sidebar');
const openSidebarBtn = document.getElementById('openSidebarBtn');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const installBtn = document.getElementById('installBtn');
const sleepTimerInput = document.getElementById('sleepTimer');
const startSleepTimerBtn = document.getElementById('startSleepTimer');
const cancelSleepTimerBtn = document.getElementById('cancelSleepTimer');
const sleepTimerCountdown = document.getElementById('sleepTimerCountdown');
const visualizer = document.getElementById('visualizer');

// App State
let isDarkMode = false;
let isMuted = false;
let isPlaying = false;
let sleepTimerId = null;
let sleepTimerEnd = null;
let deferredPrompt = null;
let audioContext = null;
let analyser = null;
let dataArray = null;
let source = null;
let animationFrameId = null;

const CHANNEL_HISTORY_KEY = 'twaudio_channel_history';
const LAST_CHANNEL_KEY = 'twaudio_last_channel';
const DARK_MODE_KEY = 'twaudio_dark_mode';
const PLAYER_STATE_KEY = 'twaudio_player_state';

// Utility to get Twitch thumbnail URL for a channel
function getThumbnailUrl(channel) {
  return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channel}-440x248.jpg`;
}

// Load saved channel history or initialize
let channelHistory = JSON.parse(localStorage.getItem(CHANNEL_HISTORY_KEY)) || [];

// Initialize app on load
window.addEventListener('load', () => {
  // Load dark mode
  isDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
  updateDarkMode();

  // Load last played channel and player state
  const savedState = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY));
  if (savedState) {
    channelInput.value = savedState.channel || '';
    isMuted = savedState.muted || false;
    isPlaying = savedState.playing || false;
    updateMuteBtn();
    if (isPlaying && savedState.channel) {
      playChannel(savedState.channel);
    }
  } else {
    // Load last channel from history
    const lastChannel = localStorage.getItem(LAST_CHANNEL_KEY);
    if (lastChannel) {
      channelInput.value = lastChannel;
      playChannel(lastChannel);
    }
  }

  renderChannelHistory();
  updateSidebarVisibility(false);

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
  }
});

// Play channel function
function playChannel(channel) {
  if (!channel) return;
  channel = channel.toLowerCase();
  showLoading(true);
  twitchPlayer.src = `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}&muted=${isMuted ? 'true' : 'false'}`;
  twitchPlayer.style.display = 'block';

  nowPlaying.textContent = '';
  loading.classList.remove('hidden');

  // After iframe loads, hide loading and show now playing
  twitchPlayer.onload = () => {
    showLoading(false);
    nowPlaying.innerHTML = `▶️ Now playing: <strong>${channel}</strong>`;

    // Save player state
    isPlaying = true;
    savePlayerState(channel, isMuted, isPlaying);

    addToHistory(channel);
    renderChannelHistory();

    startVisualizer();

    // Enable pause button, disable play button
    playBtn.disabled = true;
    pauseBtn.disabled = false;
  };

  // Save last channel
  localStorage.setItem(LAST_CHANNEL_KEY, channel);
  channelInput.value = channel;
}

// Pause player by removing iframe src
function pauseChannel() {
  twitchPlayer.src = '';
  twitchPlayer.style.display = 'none';
  nowPlaying.textContent = '';
  isPlaying = false;
  savePlayerState(channelInput.value, isMuted, isPlaying);
  stopVisualizer();
  playBtn.disabled = false;
  pauseBtn.disabled = true;
}

// Mute/unmute toggle
function toggleMute() {
  isMuted = !isMuted;
  updateMuteBtn();

  // To mute/unmute Twitch iframe, reload with muted param
  if (isPlaying) {
    playChannel(channelInput.value);
  }
}

function updateMuteBtn() {
  muteBtn.textContent = isMuted ? '🔇' : '🔊';
}

// Add channel to history (keep max 10)
function addToHistory(channel) {
  if (channelHistory.includes(channel)) {
    // Move to front
    channelHistory = channelHistory.filter(c => c !== channel);
  }
  channelHistory.unshift(channel);
  if (channelHistory.length > 10) channelHistory.pop();
  localStorage.setItem(CHANNEL_HISTORY_KEY, JSON.stringify(channelHistory));
}

// Render history sidebar list
function renderChannelHistory() {
  channelHistoryEl.innerHTML = '';
  if (channelHistory.length === 0) {
    channelHistoryEl.innerHTML = '<li>No recent channels</li>';
    return;
  }
  channelHistory.forEach(channel => {
    const li = document.createElement('li');
    li.tabIndex = 0;

    // Thumbnail image - load live preview from Twitch
    const img = document.createElement('img');
    img.src = getThumbnailUrl(channel);
    img.alt = `${channel} thumbnail`;
    img.onerror = () => { img.style.display = 'none'; }; // Hide if no live preview

    const span = document.createElement('span');
    span.textContent = channel;

    li.appendChild(img);
    li.appendChild(span);

    li.addEventListener('click', () => {
      playChannel(channel);
      updateSidebarVisibility(false);
    });
    li.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        playChannel(channel);
        updateSidebarVisibility(false);
      }
    });

    channelHistoryEl.appendChild(li);
  });
}

// Save player state to localStorage
function savePlayerState(channel, muted, playing) {
  const state = { channel, muted, playing };
  localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
}

// Dark mode toggle
darkModeToggle.addEventListener('click', () => {
  isDarkMode = !isDarkMode;
  updateDarkMode();
});

function updateDarkMode() {
  if (isDarkMode) {
    body.classList.add('light');
    darkModeToggle.textContent = '🌞';
  } else {
    body.classList.remove('light');
    darkModeToggle.textContent = '🌙';
  }
  localStorage.setItem(DARK_MODE_KEY, isDarkMode);
}

// Play button
playBtn.addEventListener('click', () => {
  const channel = channelInput.value.trim().toLowerCase();
  if (channel) {
    playChannel(channel);
  }
});

// Pause button
pauseBtn.addEventListener('click', pauseChannel);

// Mute button
muteBtn.addEventListener('click', toggleMute);

// Replay button
replayBtn.addEventListener('click', () => {
  if (isPlaying) {
    playChannel(channelInput.value);
  }
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.target === channelInput) return
