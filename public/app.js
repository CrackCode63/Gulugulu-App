const socket = io();

const STORAGE_KEYS = {
  uiTheme: 'meetflow.ui.theme',
  chatOpen: 'meetflow.ui.chatOpen',
  controlsHidden: 'meetflow.ui.controlsHidden',
  selfDragPos: 'meetflow.ui.selfDragPos',
};

const state = {
  userId: crypto.randomUUID(),
  userName: '',
  roomId: '',
  joined: false,
  localCameraStream: null,
  localScreenStream: null,
  localMediaState: {
    micEnabled: true,
    cameraEnabled: true,
    handRaised: false,
  },
  focusedOnSelf: false,
  chatOpen: false,
  darkMode: false,
  peers: new Map(),
  screenSenders: new Map(),
  remoteUsers: new Map(),
  remoteParticipantState: new Map(),
  localSpeaking: false,
  remoteSpeaking: new Map(),
  audioContext: null,
  speakingMonitors: new Map(),
  remoteMedia: new Map(),
  drag: {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    initialLeft: 0,
    initialTop: 0,
    userPositioned: false,
    savedLeft: null,
    savedTop: null,
  },
};

const elements = {
  nameInput: document.getElementById('nameInput'),
  roomInput: document.getElementById('roomInput'),
  createRoomBtn: document.getElementById('createRoomBtn'),
  joinRoomBtn: document.getElementById('joinRoomBtn'),
  leaveBtn: document.getElementById('leaveBtn'),
  shareBtn: document.getElementById('shareBtn'),
  swapBtn: document.getElementById('swapBtn'),
  micBtn: document.getElementById('micBtn'),
  camBtn: document.getElementById('camBtn'),
  handBtn: document.getElementById('handBtn'),
  inviteBtn: document.getElementById('inviteBtn'),
  menuBtn: document.getElementById('menuBtn'),
  controlsVisibilityBtn: document.getElementById('controlsVisibilityBtn'),
  overflowMenu: document.getElementById('overflowMenu'),
  copyCodeBtn: document.getElementById('copyCodeBtn'),
  shareLinkBtn: document.getElementById('shareLinkBtn'),
  roomCreatedBox: document.getElementById('roomCreatedBox'),
  shareAudioInput: document.getElementById('shareAudioInput'),
  themeBtn: document.getElementById('themeBtn'),
  chatToggleBtn: document.getElementById('chatToggleBtn'),
  statusText: document.getElementById('statusText'),
  localArea: document.getElementById('localArea'),
  remoteArea: document.getElementById('remoteArea'),
  callStage: document.getElementById('callStage'),
  screenLayout: document.getElementById('screenLayout'),
  screenArea: document.getElementById('screenArea'),
  participantArea: document.getElementById('participantArea'),
  chatPanel: document.getElementById('chatPanel'),
  chatMessages: document.getElementById('chatMessages'),
  chatForm: document.getElementById('chatForm'),
  chatInput: document.getElementById('chatInput'),
  sendChatBtn: document.getElementById('sendChatBtn'),
};

elements.roomInput.value = Math.random().toString(36).slice(2, 8).toUpperCase();

const urlParams = new URLSearchParams(window.location.search);
const roomFromUrl = urlParams.get('room');
const nameFromUrl = urlParams.get('name');
const autoJoinFromUrl = urlParams.get('autojoin') === '1';
if (roomFromUrl) {
  elements.roomInput.value = roomFromUrl.toUpperCase();
}
if (nameFromUrl) {
  elements.nameInput.value = nameFromUrl;
}

function setStatus(message) {
  elements.statusText.textContent = message;
}

function applyRoundFaviconFromImage(src) {
  const faviconLink = document.getElementById('appFavicon');
  if (!faviconLink) {
    return;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    try {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.clearRect(0, 0, size, size);
      context.save();
      context.beginPath();
      context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      context.closePath();
      context.clip();

      const sourceSize = Math.min(image.width, image.height);
      const sourceX = (image.width - sourceSize) / 2;
      const sourceY = (image.height - sourceSize) / 2;
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
      context.restore();

      faviconLink.type = 'image/png';
      faviconLink.href = canvas.toDataURL('image/png');
    } catch {
    }
  };
  image.src = src;
}

function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function setChatOpen(open) {
  state.chatOpen = Boolean(open);
  elements.chatPanel.classList.toggle('hidden', !state.chatOpen);
  localStorage.setItem(STORAGE_KEYS.chatOpen, state.chatOpen ? '1' : '0');
  setButtons();
}

function setOverflowOpen(open) {
  elements.overflowMenu.classList.toggle('hidden', !open);
}

function setControlsHidden(hidden) {
  const isHidden = Boolean(hidden);
  document.body.classList.toggle('controls-hidden', isHidden);
  elements.controlsVisibilityBtn.textContent = hidden ? '⌃' : '⌄';
  elements.controlsVisibilityBtn.title = hidden ? 'Show Controls' : 'Hide Controls';
  if (isHidden) {
    setOverflowOpen(false);
  }
  localStorage.setItem(STORAGE_KEYS.controlsHidden, isHidden ? '1' : '0');
}

function setTheme(darkMode) {
  state.darkMode = Boolean(darkMode);
  document.body.classList.toggle('dark-theme', state.darkMode);
  localStorage.setItem(STORAGE_KEYS.uiTheme, state.darkMode ? 'dark' : 'light');
  setButtons();
}

function saveSelfVideoPosition() {
  if (!state.drag.userPositioned || state.drag.savedLeft === null || state.drag.savedTop === null) {
    return;
  }

  localStorage.setItem(
    STORAGE_KEYS.selfDragPos,
    JSON.stringify({
      left: state.drag.savedLeft,
      top: state.drag.savedTop,
    })
  );
}

function loadUiPreferences() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.uiTheme);
  const savedChatOpen = localStorage.getItem(STORAGE_KEYS.chatOpen);
  const savedControlsHidden = localStorage.getItem(STORAGE_KEYS.controlsHidden);
  const savedDragPos = localStorage.getItem(STORAGE_KEYS.selfDragPos);

  setTheme(savedTheme === 'dark');
  setChatOpen(savedChatOpen === '1');
  setControlsHidden(savedControlsHidden === '1');

  if (savedDragPos) {
    try {
      const parsed = JSON.parse(savedDragPos);
      if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
        state.drag.userPositioned = true;
        state.drag.savedLeft = parsed.left;
        state.drag.savedTop = parsed.top;
      }
    } catch {
    }
  }
}

function hasRemoteParticipant() {
  return state.remoteMedia.size > 0;
}

function toggleFocusMode() {
  if (!state.joined || state.localScreenStream || !hasRemoteParticipant()) {
    return;
  }
  state.focusedOnSelf = !state.focusedOnSelf;
  updateLayoutMode();
}

function setButtons() {
  const setIconButton = (button, icon, tooltip) => {
    button.textContent = icon;
    button.title = tooltip;
    button.setAttribute('aria-label', tooltip);
  };

  elements.createRoomBtn.disabled = state.joined;
  elements.joinRoomBtn.disabled = state.joined;
  elements.leaveBtn.disabled = !state.joined;
  elements.shareBtn.disabled = !state.joined;
  elements.micBtn.disabled = !state.joined;
  elements.camBtn.disabled = !state.joined;
  elements.handBtn.disabled = !state.joined;
  elements.swapBtn.disabled = !state.joined || state.localScreenStream !== null || !hasRemoteParticipant();
  elements.sendChatBtn.disabled = !state.joined;

  setIconButton(elements.shareBtn, state.localScreenStream ? '🛑' : '🖥', state.localScreenStream ? 'Stop Share' : 'Share Screen');
  setIconButton(elements.micBtn, state.localMediaState.micEnabled ? '🎙' : '🔇', state.localMediaState.micEnabled ? 'Mic On' : 'Mic Off');
  setIconButton(elements.camBtn, state.localMediaState.cameraEnabled ? '📷' : '🚫', state.localMediaState.cameraEnabled ? 'Cam On' : 'Cam Off');
  setIconButton(elements.chatToggleBtn, '💬', state.chatOpen ? 'Close Chat' : 'Open Chat');
  setIconButton(elements.leaveBtn, '⏻', 'Leave Call');
  setIconButton(elements.menuBtn, '⋯', 'More Controls');

  elements.themeBtn.textContent = state.darkMode ? '☀ Day Mode' : '🌙 Dark Mode';
  elements.handBtn.textContent = state.localMediaState.handRaised ? '✋ Hand Up' : '✋ Raise Hand';
}

function createVideoCard(title) {
  const card = document.createElement('article');
  card.className = 'video-card';

  const heading = document.createElement('h3');
  heading.textContent = title;

  const video = document.createElement('video');
  video.autoplay = true;
  video.playsInline = true;

  card.append(heading, video);
  return { card, video, heading };
}

function getUserLabel(userId) {
  return state.remoteUsers.get(userId) || 'Guest';
}

function getRemoteParticipantState(userId) {
  return (
    state.remoteParticipantState.get(userId) || {
      micEnabled: true,
      cameraEnabled: true,
      handRaised: false,
    }
  );
}

function buildStatusSuffix({ micEnabled, cameraEnabled, handRaised }, speaking) {
  const tokens = [];
  if (handRaised) {
    tokens.push('✋');
  }
  if (!micEnabled) {
    tokens.push('🔇');
  }
  if (!cameraEnabled) {
    tokens.push('📷 Off');
  }
  if (speaking) {
    tokens.push('Speaking');
  }
  return tokens.length ? ` • ${tokens.join(' ')}` : '';
}

function ensureAudioContext() {
  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioContext;
}

function startSpeakingMonitor(key, stream, onSpeakChange) {
  if (state.speakingMonitors.has(key) || !stream.getAudioTracks().length) {
    return;
  }

  try {
    const audioContext = ensureAudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastSpeaking = false;

    const intervalId = window.setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      let avg = 0;
      for (let i = 0; i < dataArray.length; i += 1) {
        avg += dataArray[i];
      }
      avg /= dataArray.length;
      const speakingNow = avg > 20;
      if (speakingNow !== lastSpeaking) {
        lastSpeaking = speakingNow;
        onSpeakChange(speakingNow);
      }
    }, 300);

    state.speakingMonitors.set(key, {
      source,
      analyser,
      intervalId,
    });
  } catch {
  }
}

function stopSpeakingMonitor(key) {
  const monitor = state.speakingMonitors.get(key);
  if (!monitor) {
    return;
  }

  window.clearInterval(monitor.intervalId);
  try {
    monitor.source.disconnect();
    monitor.analyser.disconnect();
  } catch {
  }
  state.speakingMonitors.delete(key);
}

function appendChatMessage({ userName, message, sentAt, isSelf }) {
  const item = document.createElement('div');
  item.className = 'chat-item';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const time = new Date(sentAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  meta.textContent = `${isSelf ? 'You' : userName || 'Guest'} • ${time}`;

  const text = document.createElement('div');
  text.className = 'message';
  text.textContent = message;

  item.append(meta, text);
  elements.chatMessages.appendChild(item);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function buildInviteLink() {
  const roomId = (state.roomId || elements.roomInput.value.trim()).toUpperCase();
  if (!roomId) {
    return null;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('room', roomId);
  url.searchParams.set('autojoin', '1');
  const name = elements.nameInput.value.trim();
  if (name) {
    url.searchParams.set('name', name);
  }
  return url.toString();
}

async function copyInviteLink() {
  const link = buildInviteLink();
  if (!link) {
    setStatus('Enter Room ID first to copy invite link.');
    return;
  }

  await navigator.clipboard.writeText(link);
  setStatus('Invite link copied. Share it with participants.');
}

async function shareInviteLink() {
  const link = buildInviteLink();
  if (!link) {
    setStatus('Room code required to share link.');
    return;
  }

  if (navigator.share) {
    await navigator.share({
      title: 'Join my room',
      text: 'Use this link to join the room',
      url: link,
    });
    setStatus('Room link shared.');
    return;
  }

  await navigator.clipboard.writeText(link);
  setStatus('Share API not available. Link copied instead.');
}

function clearElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function setupLocalPreview() {
  clearElement(elements.localArea);

  const cameraTitle = `${state.userName || 'You'} (Camera)${buildStatusSuffix(
    state.localMediaState,
    state.localSpeaking
  )}`;
  const cameraCard = createVideoCard(cameraTitle);
  if (state.localSpeaking) {
    cameraCard.card.classList.add('speaking');
  }
  cameraCard.video.muted = true;
  cameraCard.video.srcObject = state.localCameraStream;
  elements.localArea.appendChild(cameraCard.card);

  if (state.localScreenStream) {
    const screenCard = createVideoCard(`${state.userName || 'You'} (Screen)`);
    screenCard.video.muted = true;
    screenCard.video.srcObject = state.localScreenStream;
    elements.localArea.appendChild(screenCard.card);
  }

  updateLayoutMode();
}

function hasAnyScreenShare() {
  if (state.localScreenStream) {
    return true;
  }

  for (const remote of state.remoteMedia.values()) {
    if (remote.screenStream.getVideoTracks().length > 0) {
      return true;
    }
  }

  return false;
}

function getActiveScreenSource() {
  if (state.localScreenStream && state.localScreenStream.getVideoTracks().length > 0) {
    return {
      label: `${state.userName || 'You'} (Screen)`,
      stream: state.localScreenStream,
      muted: true,
    };
  }

  for (const [remoteUserId, remote] of state.remoteMedia.entries()) {
    if (remote.screenStream.getVideoTracks().length > 0) {
      return {
        label: `${getUserLabel(remoteUserId)} (Screen)${buildStatusSuffix(
          getRemoteParticipantState(remoteUserId),
          state.remoteSpeaking.get(remoteUserId)
        )}`,
        stream: remote.screenStream,
        muted: false,
      };
    }
  }

  return null;
}

function getParticipantStreams() {
  const participants = [];

  if (state.localCameraStream && state.localCameraStream.getVideoTracks().length > 0) {
    participants.push({
      label: `${state.userName || 'You'} (You)`,
      stream: state.localCameraStream,
      muted: true,
    });
  }

  for (const [remoteUserId, remote] of state.remoteMedia.entries()) {
    if (remote.cameraStream.getVideoTracks().length > 0) {
      const remoteState = getRemoteParticipantState(remoteUserId);
      participants.push({
        label: `${getUserLabel(remoteUserId)}${buildStatusSuffix(
          remoteState,
          state.remoteSpeaking.get(remoteUserId)
        )}`,
        stream: remote.cameraStream,
        muted: false,
        speaking: Boolean(state.remoteSpeaking.get(remoteUserId)),
      });
    }
  }

  return participants;
}

function renderScreenShareLayout() {
  clearElement(elements.screenArea);
  clearElement(elements.participantArea);

  const source = getActiveScreenSource();
  if (source) {
    const screenCard = createVideoCard(source.label);
    screenCard.video.srcObject = source.stream;
    screenCard.video.muted = source.muted;
    elements.screenArea.appendChild(screenCard.card);
  }

  const participants = getParticipantStreams();
  for (const participant of participants) {
    const tile = document.createElement('article');
    tile.className = 'participant-tile';
    if (participant.speaking) {
      tile.classList.add('speaking');
    }

    const heading = document.createElement('h3');
    heading.textContent = participant.label;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = participant.muted;
    video.srcObject = participant.stream;

    tile.append(heading, video);
    elements.participantArea.appendChild(tile);
  }
}

function getPrimaryRemote() {
  for (const remote of state.remoteMedia.values()) {
    if (remote.cameraStream.getVideoTracks().length > 0) {
      return remote;
    }
  }
  return state.remoteMedia.values().next().value;
}

function updateLayoutMode() {
  const screenShareMode = hasAnyScreenShare();

  elements.screenLayout.classList.toggle('hidden', !screenShareMode);
  elements.remoteArea.classList.toggle('hidden', screenShareMode);
  elements.localArea.classList.toggle('hidden', screenShareMode);

  if (screenShareMode) {
    state.focusedOnSelf = false;
    renderScreenShareLayout();
    elements.localArea.classList.remove('floating-self');
    elements.localArea.classList.remove('self-full');
    elements.remoteArea.classList.remove('floating-peer');
    elements.remoteArea.classList.remove('gallery-mode');
    elements.localArea.classList.remove('dragging');
    for (const remote of state.remoteMedia.values()) {
      remote.wrap.style.display = '';
      remote.cameraCard.card.style.display = '';
      if (remote.screenStream.getVideoTracks().length > 0) {
        remote.screenCard.card.style.display = '';
      }
    }
    return;
  }

  if (!hasRemoteParticipant()) {
    state.focusedOnSelf = false;
  }

  elements.remoteArea.classList.add('gallery-mode');
  elements.remoteArea.classList.remove('theater-mode');
  elements.localArea.classList.toggle('floating-self', !state.focusedOnSelf);
  elements.localArea.classList.toggle('self-full', state.focusedOnSelf);
  elements.remoteArea.classList.toggle('floating-peer', state.focusedOnSelf);

  if (!state.focusedOnSelf) {
    if (state.drag.userPositioned && state.drag.savedLeft !== null && state.drag.savedTop !== null) {
      elements.localArea.style.left = `${state.drag.savedLeft}px`;
      elements.localArea.style.top = `${state.drag.savedTop}px`;
      elements.localArea.style.right = 'auto';
      elements.localArea.style.bottom = 'auto';
    } else {
      elements.localArea.style.left = '';
      elements.localArea.style.top = '';
      elements.localArea.style.right = '16px';
      elements.localArea.style.bottom = '16px';
    }
    for (const remote of state.remoteMedia.values()) {
      remote.wrap.style.display = '';
      remote.cameraCard.card.style.display = '';
      remote.screenCard.card.style.display = 'none';
    }
  } else {
    const primary = getPrimaryRemote();
    for (const remote of state.remoteMedia.values()) {
      const isPrimary = remote === primary;
      remote.wrap.style.display = isPrimary ? '' : 'none';
      remote.cameraCard.card.style.display = '';
      remote.screenCard.card.style.display = 'none';
    }
    elements.localArea.style.left = '';
    elements.localArea.style.top = '';
    elements.localArea.style.right = '';
    elements.localArea.style.bottom = '';
  }

  setButtons();
}

function clampFloatingPosition() {
  const stageRect = elements.callStage.getBoundingClientRect();
  const localRect = elements.localArea.getBoundingClientRect();

  const maxLeft = Math.max(0, stageRect.width - localRect.width - 8);
  const maxTop = Math.max(0, stageRect.height - localRect.height - 8);

  const currentLeft = parseFloat(elements.localArea.style.left || `${maxLeft}`);
  const currentTop = parseFloat(elements.localArea.style.top || `${maxTop}`);

  const clampedLeft = Math.min(Math.max(0, currentLeft), maxLeft);
  const clampedTop = Math.min(Math.max(0, currentTop), maxTop);

  elements.localArea.style.left = `${clampedLeft}px`;
  elements.localArea.style.top = `${clampedTop}px`;
  elements.localArea.style.right = 'auto';
  elements.localArea.style.bottom = 'auto';

  if (state.drag.userPositioned) {
    state.drag.savedLeft = clampedLeft;
    state.drag.savedTop = clampedTop;
    saveSelfVideoPosition();
  }
}

function attachFloatingDrag() {
  elements.localArea.addEventListener('pointerdown', (event) => {
    if (!elements.localArea.classList.contains('floating-self')) {
      return;
    }

    const localRect = elements.localArea.getBoundingClientRect();
    const nearResizeCorner =
      event.clientX > localRect.right - 24 && event.clientY > localRect.bottom - 24;
    if (nearResizeCorner) {
      return;
    }

    elements.localArea.setPointerCapture(event.pointerId);
    state.drag.active = true;
    state.drag.pointerId = event.pointerId;
    state.drag.startX = event.clientX;
    state.drag.startY = event.clientY;

    const stageRect = elements.callStage.getBoundingClientRect();
    state.drag.initialLeft = localRect.left - stageRect.left;
    state.drag.initialTop = localRect.top - stageRect.top;

    elements.localArea.classList.add('dragging');
  });

  elements.localArea.addEventListener('pointermove', (event) => {
    if (!state.drag.active || state.drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - state.drag.startX;
    const deltaY = event.clientY - state.drag.startY;

    elements.localArea.style.left = `${state.drag.initialLeft + deltaX}px`;
    elements.localArea.style.top = `${state.drag.initialTop + deltaY}px`;
    elements.localArea.style.right = 'auto';
    elements.localArea.style.bottom = 'auto';
    clampFloatingPosition();
  });

  const stopDrag = (event) => {
    if (!state.drag.active || state.drag.pointerId !== event.pointerId) {
      return;
    }
    state.drag.active = false;
    state.drag.pointerId = null;
    elements.localArea.classList.remove('dragging');

    state.drag.userPositioned = true;
    state.drag.savedLeft = parseFloat(elements.localArea.style.left || '0');
    state.drag.savedTop = parseFloat(elements.localArea.style.top || '0');
    saveSelfVideoPosition();
  };

  elements.localArea.addEventListener('pointerup', stopDrag);
  elements.localArea.addEventListener('pointercancel', stopDrag);
  window.addEventListener('resize', clampFloatingPosition);
}

async function ensureLocalCamera() {
  if (state.localCameraStream) {
    return;
  }
  state.localCameraStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  startSpeakingMonitor('local', state.localCameraStream, (speaking) => {
    state.localSpeaking = speaking;
    setupLocalPreview();
  });
  setupLocalPreview();
}

function addScreenSender(remoteUserId, sender) {
  const senders = state.screenSenders.get(remoteUserId) || [];
  senders.push(sender);
  state.screenSenders.set(remoteUserId, senders);
}

function createPeerConnection(remoteUserId) {
  if (state.peers.has(remoteUserId)) {
    return state.peers.get(remoteUserId);
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  state.localCameraStream.getTracks().forEach((track) => {
    pc.addTrack(track, state.localCameraStream);
  });

  if (state.localScreenStream) {
    state.localScreenStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, state.localScreenStream);
      addScreenSender(remoteUserId, sender);
    });
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        targetUserId: remoteUserId,
        candidate: event.candidate,
      });
    }
  };

  pc.ontrack = (event) => {
    addRemoteTrack(remoteUserId, event.track);
  };

  pc.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
      removeRemoteUser(remoteUserId);
      closePeer(remoteUserId);
    }
  };

  state.peers.set(remoteUserId, pc);
  return pc;
}

function getOrCreateRemoteView(remoteUserId) {
  if (state.remoteMedia.has(remoteUserId)) {
    return state.remoteMedia.get(remoteUserId);
  }

  const wrap = document.createElement('div');
  wrap.dataset.userId = remoteUserId;

  const cameraCard = createVideoCard(`${getUserLabel(remoteUserId)} (Camera)`);
  const screenCard = createVideoCard(`${getUserLabel(remoteUserId)} (Screen)`);
  screenCard.card.style.display = 'none';

  wrap.append(cameraCard.card, screenCard.card);
  elements.remoteArea.appendChild(wrap);

  const remote = {
    wrap,
    cameraCard,
    screenCard,
    cameraStream: new MediaStream(),
    screenStream: new MediaStream(),
  };

  cameraCard.video.srcObject = remote.cameraStream;
  screenCard.video.srcObject = remote.screenStream;

  state.remoteMedia.set(remoteUserId, remote);
  return remote;
}

function refreshRemoteLabels(remoteUserId) {
  const remote = state.remoteMedia.get(remoteUserId);
  if (!remote) {
    return;
  }

  const name = getUserLabel(remoteUserId);
  const remoteState = getRemoteParticipantState(remoteUserId);
  const speaking = Boolean(state.remoteSpeaking.get(remoteUserId));
  const suffix = buildStatusSuffix(remoteState, speaking);
  remote.cameraCard.heading.textContent = `${name} (Camera)${suffix}`;
  remote.screenCard.heading.textContent = `${name} (Screen)${suffix}`;

  remote.cameraCard.card.classList.toggle('speaking', speaking);
  remote.screenCard.card.classList.toggle('speaking', speaking);
}

function setRemoteUserName(remoteUserId, userName) {
  if (!remoteUserId) {
    return;
  }

  state.remoteUsers.set(remoteUserId, userName || 'Guest');
  if (!state.remoteParticipantState.has(remoteUserId)) {
    state.remoteParticipantState.set(remoteUserId, {
      micEnabled: true,
      cameraEnabled: true,
      handRaised: false,
    });
  }
  refreshRemoteLabels(remoteUserId);
}

function setRemoteParticipantState(remoteUserId, partialState) {
  if (!remoteUserId) {
    return;
  }

  const current = getRemoteParticipantState(remoteUserId);
  state.remoteParticipantState.set(remoteUserId, {
    ...current,
    ...partialState,
  });
  refreshRemoteLabels(remoteUserId);
  updateLayoutMode();
}

function addRemoteTrack(remoteUserId, track) {
  const remote = getOrCreateRemoteView(remoteUserId);

  if (track.kind === 'audio') {
    remote.cameraStream.addTrack(track);
    startSpeakingMonitor(`remote:${remoteUserId}`, remote.cameraStream, (speaking) => {
      state.remoteSpeaking.set(remoteUserId, speaking);
      refreshRemoteLabels(remoteUserId);
      updateLayoutMode();
    });
    return;
  }

  if (remote.cameraStream.getVideoTracks().length === 0) {
    remote.cameraStream.addTrack(track);
  } else {
    remote.screenStream.addTrack(track);
    remote.screenCard.card.style.display = '';

    track.addEventListener('ended', () => {
      remote.screenStream.removeTrack(track);
      if (remote.screenStream.getVideoTracks().length === 0) {
        remote.screenCard.card.style.display = 'none';
      }
      updateLayoutMode();
    });
  }

  updateLayoutMode();
}

function removeRemoteUser(remoteUserId) {
  const remote = state.remoteMedia.get(remoteUserId);
  if (!remote) {
    return;
  }

  remote.wrap.remove();
  state.remoteUsers.delete(remoteUserId);
  state.remoteParticipantState.delete(remoteUserId);
  state.remoteSpeaking.delete(remoteUserId);
  stopSpeakingMonitor(`remote:${remoteUserId}`);
  state.remoteMedia.delete(remoteUserId);
  if (!hasRemoteParticipant()) {
    state.focusedOnSelf = false;
  }
  updateLayoutMode();
}

function closePeer(remoteUserId) {
  const pc = state.peers.get(remoteUserId);
  if (pc) {
    pc.close();
  }
  state.peers.delete(remoteUserId);
  state.screenSenders.delete(remoteUserId);
}

function resetRemoteConnections() {
  for (const remoteUserId of Array.from(state.peers.keys())) {
    closePeer(remoteUserId);
  }

  for (const remoteUserId of Array.from(state.remoteMedia.keys())) {
    removeRemoteUser(remoteUserId);
  }
}

function emitJoinRoom(allowCreate = true) {
  if (!state.roomId || !state.userId || !socket.connected) {
    return;
  }

  socket.emit('join-room', {
    roomId: state.roomId,
    userId: state.userId,
    userName: state.userName || 'Guest',
    allowCreate,
  });
}

function emitLocalMediaState() {
  if (!state.joined || !socket.connected) {
    return;
  }

  socket.emit('media-state', {
    micEnabled: state.localMediaState.micEnabled,
    cameraEnabled: state.localMediaState.cameraEnabled,
  });
}

function emitLocalHandState() {
  if (!state.joined || !socket.connected) {
    return;
  }

  socket.emit('raise-hand', {
    handRaised: state.localMediaState.handRaised,
  });
}

function toggleMic() {
  if (!state.localCameraStream) {
    return;
  }

  const enabled = !state.localMediaState.micEnabled;
  state.localMediaState.micEnabled = enabled;
  state.localCameraStream.getAudioTracks().forEach((track) => {
    track.enabled = enabled;
  });
  setButtons();
  setupLocalPreview();
  emitLocalMediaState();
}

function toggleCamera() {
  if (!state.localCameraStream) {
    return;
  }

  const enabled = !state.localMediaState.cameraEnabled;
  state.localMediaState.cameraEnabled = enabled;
  state.localCameraStream.getVideoTracks().forEach((track) => {
    track.enabled = enabled;
  });
  setButtons();
  setupLocalPreview();
  emitLocalMediaState();
}

function toggleHandRaise() {
  state.localMediaState.handRaised = !state.localMediaState.handRaised;
  setButtons();
  setupLocalPreview();
  emitLocalHandState();
}

function sendChatMessage() {
  const message = elements.chatInput.value.trim();
  if (!message || !state.joined || !socket.connected) {
    return;
  }

  socket.emit('chat-message', { message });
  elements.chatInput.value = '';
}

function rejoinCurrentRoom(reasonText) {
  if (!state.joined || !state.roomId) {
    return;
  }

  resetRemoteConnections();
  emitJoinRoom(true);
  setStatus(`${reasonText}: rejoining room ${state.roomId}...`);
}

async function sendOffer(remoteUserId) {
  const pc = createPeerConnection(remoteUserId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('offer', {
    targetUserId: remoteUserId,
    sdp: pc.localDescription,
  });
}

async function renegotiateAllPeers() {
  for (const remoteUserId of state.peers.keys()) {
    await sendOffer(remoteUserId);
  }
}

async function startScreenShare() {
  state.localScreenStream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: Boolean(elements.shareAudioInput.checked),
  });

  const [screenTrack] = state.localScreenStream.getVideoTracks();
  if (screenTrack) {
    screenTrack.addEventListener('ended', async () => {
      await stopScreenShare();
    });
  }

  for (const [remoteUserId, pc] of state.peers.entries()) {
    state.localScreenStream.getTracks().forEach((track) => {
      const sender = pc.addTrack(track, state.localScreenStream);
      addScreenSender(remoteUserId, sender);
    });
  }

  setupLocalPreview();
  setButtons();
  updateLayoutMode();
  await renegotiateAllPeers();
}

async function stopScreenShare() {
  if (!state.localScreenStream) {
    return;
  }

  state.localScreenStream.getTracks().forEach((track) => track.stop());

  for (const [remoteUserId, senders] of state.screenSenders.entries()) {
    const pc = state.peers.get(remoteUserId);
    if (!pc) {
      continue;
    }

    for (const sender of senders) {
      if (sender) {
        pc.removeTrack(sender);
      }
    }
  }

  state.screenSenders.clear();
  state.localScreenStream = null;

  setupLocalPreview();
  setButtons();
  updateLayoutMode();
  await renegotiateAllPeers();
}

async function joinRoom({ roomCode, allowCreate }) {
  if (state.joined) {
    return;
  }

  const roomId = String(roomCode || elements.roomInput.value || '').trim().toUpperCase();
  const userName = elements.nameInput.value.trim() || 'Guest';
  if (!roomId) {
    setStatus('Please enter room code.');
    return;
  }

  state.roomId = roomId;
  state.userName = userName;
  await ensureLocalCamera();

  if (!socket.connected) {
    socket.connect();
  }

  emitJoinRoom(allowCreate);

  state.joined = true;
  elements.roomCreatedBox.classList.add('hidden');
  setButtons();
  setStatus(`Connected to room: ${roomId}`);
  setupLocalPreview();
  updateLayoutMode();
  emitLocalMediaState();
  emitLocalHandState();
}

function validateRoomCode(roomCode) {
  return new Promise((resolve) => {
    socket.emit('validate-room', { roomId: roomCode }, ({ isValid }) => {
      resolve(Boolean(isValid));
    });
  });
}

async function createRoomFlow() {
  if (state.joined) {
    return;
  }

  const userCode = window.prompt('Enter Room Key (leave blank for auto):', elements.roomInput.value);
  if (userCode === null) {
    return;
  }

  const roomCode = (userCode.trim() || generateRoomCode()).toUpperCase();
  elements.roomInput.value = roomCode;
  await joinRoom({ roomCode, allowCreate: true });
  elements.roomCreatedBox.classList.remove('hidden');
  setStatus(`Room Created Successfully: ${roomCode}`);
}

async function joinRoomFlow() {
  if (state.joined) {
    return;
  }

  const enteredCode = window.prompt('Enter Room Code to join:', elements.roomInput.value);
  if (enteredCode === null) {
    return;
  }

  const roomCode = enteredCode.trim().toUpperCase();
  if (!roomCode) {
    setStatus('Room code is required.');
    return;
  }

  if (!socket.connected) {
    socket.connect();
  }

  const isValid = await validateRoomCode(roomCode);
  if (!isValid) {
    setStatus('Invalid room code. Please check and try again.');
    return;
  }

  elements.roomInput.value = roomCode;
  await joinRoom({ roomCode, allowCreate: false });
}

async function leaveRoom() {
  if (!state.joined) {
    return;
  }

  if (state.localScreenStream) {
    await stopScreenShare();
  }

  for (const remoteUserId of state.peers.keys()) {
    closePeer(remoteUserId);
  }

  for (const remoteUserId of state.remoteMedia.keys()) {
    removeRemoteUser(remoteUserId);
  }

  if (socket.connected) {
    socket.emit('leave-room');
  }

  state.joined = false;
  elements.roomCreatedBox.classList.add('hidden');
  setButtons();
  setStatus('Left call');
  updateLayoutMode();
}

socket.on('existing-users', async (users) => {
  setStatus(`Connected to room: ${state.roomId}`);
  for (const user of users) {
    if (user.userId === state.userId) {
      continue;
    }
    setRemoteUserName(user.userId, user.userName);
    setRemoteParticipantState(user.userId, {
      micEnabled: user.micEnabled,
      cameraEnabled: user.cameraEnabled,
      handRaised: user.handRaised,
    });
    createPeerConnection(user.userId);
    await sendOffer(user.userId);
  }
});

socket.on('user-joined', ({ userId, userName }) => {
  if (userId === state.userId) {
    return;
  }
  setRemoteUserName(userId, userName);
  setRemoteParticipantState(userId, {
    micEnabled: true,
    cameraEnabled: true,
    handRaised: false,
  });
  createPeerConnection(userId);
});

socket.on('offer', async ({ fromUserId, fromUserName, sdp }) => {
  setRemoteUserName(fromUserId, fromUserName);
  const pc = createPeerConnection(fromUserId);
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit('answer', {
    targetUserId: fromUserId,
    sdp: pc.localDescription,
  });
});

socket.on('answer', async ({ fromUserId, sdp }) => {
  const pc = state.peers.get(fromUserId);
  if (!pc) {
    return;
  }
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on('ice-candidate', async ({ fromUserId, candidate }) => {
  const pc = state.peers.get(fromUserId);
  if (!pc) {
    return;
  }
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch {
  }
});

socket.on('user-left', ({ userId }) => {
  removeRemoteUser(userId);
  closePeer(userId);
});

socket.on('media-state', ({ userId, micEnabled, cameraEnabled }) => {
  setRemoteParticipantState(userId, { micEnabled, cameraEnabled });
});

socket.on('raise-hand', ({ userId, handRaised }) => {
  if (userId === state.userId) {
    state.localMediaState.handRaised = Boolean(handRaised);
    setButtons();
    setupLocalPreview();
    return;
  }
  setRemoteParticipantState(userId, { handRaised });
});

socket.on('chat-message', ({ userId, userName, message, sentAt }) => {
  appendChatMessage({
    userName,
    message,
    sentAt,
    isSelf: userId === state.userId,
  });
});

socket.on('join-error', ({ message }) => {
  state.joined = false;
  setButtons();
  setStatus(message || 'Unable to join room.');
});

socket.on('connect', () => {
  if (!state.joined) {
    return;
  }
  rejoinCurrentRoom('Connection restored');
  emitLocalMediaState();
  emitLocalHandState();
});

socket.on('disconnect', () => {
  if (!state.joined) {
    return;
  }
  setStatus('Connection lost. Trying to reconnect...');
});

socket.io.on('reconnect_attempt', () => {
  if (state.joined) {
    setStatus('Reconnecting...');
  }
});

socket.io.on('reconnect_failed', () => {
  if (state.joined) {
    setStatus('Reconnection failed. Please check internet and wait...');
  }
});

window.addEventListener('offline', () => {
  if (state.joined) {
    setStatus('You are offline. Waiting for internet...');
  }
});

window.addEventListener('online', () => {
  if (!state.joined) {
    return;
  }

  setStatus('Internet back. Reconnecting...');
  if (!socket.connected) {
    socket.connect();
  } else {
    rejoinCurrentRoom('Internet back');
  }
});

elements.createRoomBtn.addEventListener('click', () => {
  createRoomFlow().catch((error) => {
    setStatus(`Create room failed: ${error.message}`);
  });
  setOverflowOpen(false);
});

elements.joinRoomBtn.addEventListener('click', () => {
  joinRoomFlow().catch((error) => {
    setStatus(`Join room failed: ${error.message}`);
  });
  setOverflowOpen(false);
});

elements.leaveBtn.addEventListener('click', () => {
  leaveRoom().catch((error) => {
    setStatus(`Leave failed: ${error.message}`);
  });
});

elements.shareBtn.addEventListener('click', () => {
  const action = state.localScreenStream ? stopScreenShare : startScreenShare;
  action().catch((error) => {
    setStatus(`Screen share error: ${error.message}`);
  });
  setOverflowOpen(false);
});

elements.swapBtn.addEventListener('click', () => {
  toggleFocusMode();
  setOverflowOpen(false);
});

elements.micBtn.addEventListener('click', () => {
  toggleMic();
});

elements.camBtn.addEventListener('click', () => {
  toggleCamera();
});

elements.handBtn.addEventListener('click', () => {
  toggleHandRaise();
  setOverflowOpen(false);
});

elements.inviteBtn.addEventListener('click', () => {
  copyInviteLink().catch((error) => {
    setStatus(`Invite copy failed: ${error.message}`);
  });
  setOverflowOpen(false);
});

elements.copyCodeBtn.addEventListener('click', () => {
  const roomCode = state.roomId || elements.roomInput.value.trim().toUpperCase();
  if (!roomCode) {
    setStatus('No room code available.');
    return;
  }

  navigator.clipboard
    .writeText(roomCode)
    .then(() => setStatus('Room code copied.'))
    .catch((error) => setStatus(`Copy failed: ${error.message}`));
});

elements.shareLinkBtn.addEventListener('click', () => {
  shareInviteLink().catch((error) => {
    setStatus(`Share link failed: ${error.message}`);
  });
  setOverflowOpen(false);
});

elements.themeBtn.addEventListener('click', () => {
  setTheme(!state.darkMode);
  setOverflowOpen(false);
});

elements.chatToggleBtn.addEventListener('click', () => {
  setChatOpen(!state.chatOpen);
});

elements.menuBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  const isHidden = elements.overflowMenu.classList.contains('hidden');
  setOverflowOpen(isHidden);
});

elements.controlsVisibilityBtn.addEventListener('click', () => {
  const hidden = document.body.classList.contains('controls-hidden');
  setControlsHidden(!hidden);
});

elements.overflowMenu.addEventListener('click', (event) => {
  event.stopPropagation();
});

document.addEventListener('click', () => {
  setOverflowOpen(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (!elements.overflowMenu.classList.contains('hidden')) {
    setOverflowOpen(false);
    return;
  }

  if (state.chatOpen) {
    setChatOpen(false);
  }
});

elements.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendChatMessage();
});

elements.localArea.addEventListener('click', () => {
  if (!state.localScreenStream && hasRemoteParticipant() && !state.focusedOnSelf) {
    toggleFocusMode();
  }
});

elements.remoteArea.addEventListener('click', () => {
  if (!state.localScreenStream && hasRemoteParticipant() && state.focusedOnSelf) {
    toggleFocusMode();
  }
});

window.addEventListener('beforeunload', () => {
  if (socket.connected) {
    socket.emit('leave-room');
  }
});

attachFloatingDrag();
setButtons();
applyRoundFaviconFromImage('/icon.jpg');
loadUiPreferences();

if (roomFromUrl && autoJoinFromUrl) {
  window.setTimeout(() => {
    joinRoom({ roomCode: roomFromUrl.toUpperCase(), allowCreate: false }).catch((error) => {
      setStatus(`Auto join failed: ${error.message}`);
    });
  }, 300);
}
