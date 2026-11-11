"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

type Emotion = "neutral" | "happy" | "calm" | "anger" | "empathy";
type PanelMode = "camera" | "avatar" | "echo";
type FlowStep = "avatar-choice" | "camera-choice" | "main";
type CameraState = "off" | "requesting" | "on" | "denied" | "unavailable" | "error";
type ChatMessage = { id: number; sender: "echo" | "user"; text: string; safety?: boolean };
type AvatarOption = { id: string; label: string; image: string; video: string; alt: string };

type EmotionDefinition = { id: Emotion; label: string; confidence: number | null; cue: string };

const NEUTRAL_STATE: EmotionDefinition = {
  id: "neutral",
  label: "Neutral",
  confidence: null,
  cue: "Calm readiness",
};

const EMOTIONS: EmotionDefinition[] = [
  { id: "happy", label: "Happy", confidence: 91, cue: "Warm recognition" },
  { id: "calm", label: "Calm", confidence: 88, cue: "Calm attunement" },
  { id: "anger", label: "Anger", confidence: 84, cue: "Steady empathic presence" },
  { id: "empathy", label: "Empathy", confidence: 87, cue: "Gentle attunement" },
];

const AVATAR_STATES: EmotionDefinition[] = [NEUTRAL_STATE, ...EMOTIONS];

const AVATARS: AvatarOption[] = [
  { id: "avatar-1", label: "Mira", image: "/avatars/avatar-1.jpg", video: "/echoai-avatar-alpha.webm", alt: "3D companion with a dark braid and yellow jacket" },
  { id: "avatar-2", label: "Neo", image: "/avatars/avatar-2.jpg", video: "/avatars/avatar-2.webm", alt: "3D companion wearing a cap, headphones, and glowing glasses" },
  { id: "avatar-3", label: "Elliot", image: "/avatars/avatar-3.png", video: "/avatars/avatar-3.webm", alt: "Illustrated companion with dark hair and glasses" },
  { id: "avatar-4", label: "Amara", image: "/avatars/avatar-4.png", video: "/avatars/avatar-4.webm", alt: "3D companion with long curls and a yellow top" },
  { id: "avatar-5", label: "Lumi", image: "/avatars/avatar-5.png", video: "/avatars/avatar-5.webm", alt: "3D companion with purple hair, glasses, and a pink hoodie" },
];

const EMOTION_MEDIA: Partial<Record<Emotion, { video: string; audio: string; label: string }>> = {
  happy: { video: "/emotions/happy-sphere.mp4", audio: "/emotions/happy-music.mp3", label: "Happy" },
  calm: { video: "/emotions/calm-sphere.mp4", audio: "/emotions/calm-music.mp3", label: "Calm" },
  anger: { video: "/emotions/anger-sphere.mp4", audio: "/emotions/anger-music.mp3", label: "Anger" },
  empathy: { video: "/emotions/empathy-sphere.mp4", audio: "/emotions/empathy-music.mp3", label: "Empathy" },
};

const STAR_FIELD = Array.from({ length: 120 }, (_, index) => ({
  id: index,
  x: (index * 47 + 11) % 100,
  y: (index * 73 + 7) % 100,
  size: 1 + ((index * 13) % 3),
  delay: -((index * 0.37) % 6),
  duration: 2.8 + ((index * 19) % 40) / 10,
}));

function EchoMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function AvatarOptions({
  onChoose,
  selectedId,
  compact = false,
}: {
  onChoose: (avatar: AvatarOption) => void;
  selectedId?: string;
  compact?: boolean;
}) {
  return (
    <div className={`avatar-choice-grid${compact ? " avatar-choice-grid-compact" : ""}`} role="group" aria-label="Available avatars">
      {AVATARS.map((avatar) => (
        <button
          key={avatar.id}
          className="avatar-choice"
          data-avatar={avatar.id}
          data-selected={selectedId === avatar.id || undefined}
          type="button"
          onClick={() => onChoose(avatar)}
          aria-label={`Choose ${avatar.label}: ${avatar.alt}`}
        >
          <span className="avatar-choice-glow" aria-hidden="true" />
          <span className="avatar-choice-figure" aria-hidden="true">
            <img src={avatar.image} alt="" />
          </span>
          <span className="avatar-choice-label">{avatar.label}<i aria-hidden="true">→</i></span>
        </button>
      ))}
    </div>
  );
}

function AvatarChooser({ onChoose }: { onChoose: (avatar: AvatarOption) => void }) {
  return (
    <main className="avatar-chooser-shell">
      <header className="chooser-topbar">
        <a className="brand" href="/" aria-label="Reset EchoAI"><EchoMark /><span>EchoAI</span></a>
        <span className="chooser-privacy"><i />Private demo</span>
      </header>
      <section className="avatar-chooser" aria-labelledby="avatar-chooser-title">
        <div className="chooser-intro">
          <p>Begin with a presence that feels right</p>
          <h1 id="avatar-chooser-title">Choose Your Avatar</h1>
          <span>You can change your companion at any time.</span>
        </div>
        <AvatarOptions onChoose={onChoose} />
      </section>
    </main>
  );
}

function CameraChoice({ avatar, onYes, onNo }: { avatar: AvatarOption; onYes: () => void; onNo: () => void }) {
  return (
    <main className="camera-choice-shell">
      <header className="chooser-topbar">
        <a className="brand" href="/" aria-label="Reset EchoAI"><EchoMark /><span>EchoAI</span></a>
        <span className="chooser-privacy"><i />Private demo</span>
      </header>
      <section className="camera-choice-content" aria-labelledby="camera-choice-title">
        <div className="camera-choice-presence" data-avatar={avatar.id} aria-hidden="true">
          <span className="camera-choice-halo" />
          <img src={avatar.image} alt="" />
        </div>
        <div className="camera-choice-card">
          <p>One optional step</p>
          <h1 id="camera-choice-title">Would you like to turn on your camera?</h1>
          <span>Your preview stays in this browser and is never recorded.</span>
          <div className="camera-choice-actions">
            <button className="camera-choice-yes" type="button" onClick={onYes}>Yes</button>
            <button className="camera-choice-no" type="button" onClick={onNo}>No</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function AvatarPickerModal({ selected, onChoose, onClose }: { selected: AvatarOption; onChoose: (avatar: AvatarOption) => void; onClose: () => void }) {
  return (
    <div className="avatar-picker-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="avatar-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title">
        <div className="avatar-picker-heading">
          <div><p>Companion gallery</p><h2 id="avatar-picker-title">Choose a different avatar</h2></div>
          <button type="button" onClick={onClose} aria-label="Close avatar picker">×</button>
        </div>
        <AvatarOptions compact selectedId={selected.id} onChoose={onChoose} />
      </section>
    </div>
  );
}

function AnimatedAvatar({ emotion, avatar }: { emotion: Emotion; avatar: AvatarOption }) {
  return (
    <div
      className="avatar-stage avatar-stage-raster"
      data-emotion={emotion}
      data-avatar={avatar.id}
      aria-label={`Three-dimensional animated companion showing ${AVATAR_STATES.find((item) => item.id === emotion)?.cue.toLowerCase()}`}
      role="img"
    >
      <div className="ambient-orbit orbit-one" />
      <div className="ambient-orbit orbit-two" />
      <div className="avatar-halo" aria-hidden="true" />
      <div className="avatar-ground-shadow" />

      <div className="avatar-perspective">
        <div className="avatar-orientation">
          <div className="avatar-life">
            <div className="avatar-body-motion">
              <div className="avatar-cutout" aria-hidden="true">
                <video
                  key={avatar.video}
                  className="avatar-video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                >
                  <source src={avatar.video} type="video/webm" />
                </video>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmotionSphere({
  emotion,
  videoRef,
  musicPlaying,
  onToggleMusic,
}: {
  emotion: Emotion;
  videoRef: RefObject<HTMLVideoElement | null>;
  musicPlaying: boolean;
  onToggleMusic: () => void;
}) {
  const media = EMOTION_MEDIA[emotion];

  return (
    <section
      className="sphere-space"
      data-sphere-emotion={emotion}
      aria-label={media ? `${media.label} Emotion Sphere with ambient music` : "Neutral Emotion Sphere with a silent field of stars"}
    >
      {media ? (
        <>
          <video
            key={media.video}
            ref={videoRef}
            className="sphere-video"
            src={media.video}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label={`${media.label} Emotion Sphere animation`}
          />
          <div className="sphere-media-status">
            <span><i />{media.label} sphere</span>
            <button type="button" onClick={onToggleMusic} aria-label={musicPlaying ? "Pause emotion music" : "Play emotion music"}>
              <span aria-hidden="true">{musicPlaying ? "Ⅱ" : "▶"}</span>
              {musicPlaying ? "Music on" : "Music off"}
            </button>
          </div>
        </>
      ) : (
        <div className="neutral-cosmos" aria-hidden="true">
          <div className="stars stars-soft">
            {STAR_FIELD.map((star) => (
              <span
                key={star.id}
                style={{
                  "--star-x": `${star.x}%`,
                  "--star-y": `${star.y}%`,
                  "--star-size": `${star.size}px`,
                  "--star-delay": `${star.delay}s`,
                  "--star-duration": `${star.duration}s`,
                } as CSSProperties}
              />
            ))}
          </div>
          <div className="neutral-center-glow" />
        </div>
      )}
    </section>
  );
}

const CAMERA_STATUS_COPY: Record<CameraState, string> = {
  off: "Camera off",
  requesting: "Requesting camera access…",
  on: "Camera on",
  denied: "Camera access was not allowed",
  unavailable: "Camera is unavailable in this browser",
  error: "The camera could not be started",
};

function CameraView({
  status,
  videoRef,
  onToggle,
}: {
  status: CameraState;
  videoRef: RefObject<HTMLVideoElement | null>;
  onToggle: () => void;
}) {
  const cameraOn = status === "on";
  const requesting = status === "requesting";

  return (
    <section className="camera-view" aria-labelledby="camera-title">
      <div className="mode-heading">
        <p className="mode-kicker">Private preview</p>
        <h2 id="camera-title">See yourself here.</h2>
        <p>Your camera stays in this browser and is never recorded.</p>
      </div>
      <div className="camera-frame" data-camera-state={status}>
        <video ref={videoRef} className="camera-feed" autoPlay muted playsInline aria-label="Live camera preview" />
        {!cameraOn && <span className="camera-placeholder" aria-hidden="true" />}
        <span className="camera-state"><i />{CAMERA_STATUS_COPY[status]}</span>
      </div>
      <button className="camera-button" type="button" onClick={onToggle} disabled={requesting}>
        <span className="camera-button-icon" aria-hidden="true" />
        {cameraOn ? "Turn off camera" : requesting ? "Requesting access…" : "Turn on camera"}
      </button>
      {(status === "denied" || status === "error" || status === "unavailable") && (
        <p className="camera-help" role="status">{CAMERA_STATUS_COPY[status]}. You can keep using Avatar or Echo without it.</p>
      )}
    </section>
  );
}

const JOURNAL_STARTERS = [
  "Help me unpack today",
  "I need space to vent",
  "Guide me through a reset",
  "Help me name what I feel",
];

const CRISIS_PATTERN = /\b(suicid|kill myself|end my life|want to die|don'?t want to live|self[- ]?harm|hurt myself)\b/i;

const FEELING_PATTERNS = [
  {
    name: "anger",
    pattern: /\b(angry|anger|mad|furious|irritated|resentful|frustrated)\b/i,
    reflection: "There’s real energy in this anger, and it may be pointing to a boundary or value that feels crossed.",
  },
  {
    name: "anxiety",
    pattern: /\b(anxious|anxiety|worried|nervous|panic|afraid|scared|uncertain)\b/i,
    reflection: "It sounds like your mind is working hard to anticipate what could go wrong.",
  },
  {
    name: "sadness",
    pattern: /\b(sad|down|hurt|grief|grieving|heartbroken|empty|crying|loss)\b/i,
    reflection: "This sounds tender and painful. You don’t need to make the sadness smaller for me.",
  },
  {
    name: "overwhelm",
    pattern: /\b(overwhelmed|exhausted|burned out|burnt out|too much|stressed|drained)\b/i,
    reflection: "You’ve been carrying a lot at once, and it makes sense that your system feels overloaded.",
  },
  {
    name: "loneliness",
    pattern: /\b(lonely|alone|isolated|left out|ignored|unseen)\b/i,
    reflection: "Feeling unseen or alone can ache in a very particular way. I’m glad you put words to it here.",
  },
  {
    name: "joy",
    pattern: /\b(happy|joy|joyful|excited|proud|grateful|relieved|good news)\b/i,
    reflection: "There’s something worth savoring here. Let’s give this good feeling a little room instead of rushing past it.",
  },
  {
    name: "calm",
    pattern: /\b(calm|peaceful|grounded|settled|content|at ease)\b/i,
    reflection: "You’re noticing a steadier moment. Paying attention to what supports it can make it easier to return to later.",
  },
];

function createEchoReply(message: string, turn: number) {
  if (CRISIS_PATTERN.test(message)) {
    return {
      safety: true,
      text: "I’m really glad you told me. I’m not equipped to keep you safe in a crisis. If you might act on this now, call emergency services; in the U.S. or Canada, call or text 988. Move away from anything you could use to hurt yourself and contact someone you trust who can stay with you. Are you in immediate danger right now?",
    };
  }

  const feeling = FEELING_PATTERNS.find((item) => item.pattern.test(message));
  const intense = /\b(very|really|extremely|completely|totally|so much|can'?t handle)\b/i.test(message);
  const asksForAdvice = /\b(what should i do|advice|help me decide|how do i fix|solution)\b/i.test(message);
  const isVent = /\b(vent|just listen|don'?t fix)\b/i.test(message);

  const opening = feeling?.reflection ?? "I’m hearing that this matters to you, even if the feeling is still hard to name.";
  const intensityLine = intense ? " It sounds especially intense right now." : "";

  if (isVent) {
    return { safety: false, text: `${opening}${intensityLine} I won’t rush into solutions. What else needs to be said without being edited or softened?` };
  }

  if (asksForAdvice) {
    return { safety: false, text: `${opening}${intensityLine} Before we choose a next step, what outcome would feel most aligned with what you need—not just what others expect?` };
  }

  const followUps = [
    "What happened just before you noticed this feeling most clearly?",
    `If this ${feeling?.name ?? "feeling"} could ask for one thing, what might it need?`,
    "What part of this feels within your control, even if it is very small?",
    "What would you want your future self to remember about this moment?",
    "Is there a belief about yourself underneath this that deserves a gentler look?",
  ];

  return { safety: false, text: `${opening}${intensityLine} ${followUps[(turn - 1) % followUps.length]}` };
}

function EchoChat() {
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, sender: "echo", text: "Hi, I’m Echo. We can slow down, name what’s here, and make space for the parts of your day that still feel unfinished. Where would you like to begin?" },
  ]);
  const messageId = useRef(1);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);

  const userTurns = messages.filter((message) => message.sender === "user").length;

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typing]);

  useEffect(() => () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
  }, []);

  const submitText = (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || typing) return;
    const reply = createEchoReply(cleanText, userTurns + 1);
    const userMessage: ChatMessage = { id: ++messageId.current, sender: "user", text: cleanText };
    const replyId = ++messageId.current;
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setTyping(true);
    replyTimer.current = setTimeout(() => {
      setMessages((current) => [...current, { id: replyId, sender: "echo", text: reply.text, safety: reply.safety }]);
      setTyping(false);
      replyTimer.current = null;
    }, reply.safety ? 250 : 650);
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitText(draft);
  };

  const handleComposerKey = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const startNewReflection = () => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setTyping(false);
    setDraft("");
    setMessages([{ id: ++messageId.current, sender: "echo", text: "A fresh page. Take a breath, and start wherever your attention keeps returning." }]);
  };

  return (
    <section className="echo-chat" aria-labelledby="echo-title">
      <div className="echo-chat-header">
        <span className="echo-orb" aria-hidden="true"><i /><i /><i /></span>
        <div><h2 id="echo-title">Echo</h2><p><span />Reflective journal</p></div>
        <button className="new-reflection" type="button" onClick={startNewReflection}>New</button>
      </div>
      <div className="chat-messages" aria-live="polite" aria-label="Conversation with Echo">
        {messages.map((message) => (
          <div key={message.id} className="chat-message" data-sender={message.sender} data-safety={message.safety || undefined}>
            {message.sender === "echo" && <span className="message-avatar" aria-hidden="true">E</span>}
            <p>{message.text}</p>
          </div>
        ))}
        {userTurns === 0 && (
          <div className="journal-starters" aria-label="Journal starters">
            {JOURNAL_STARTERS.map((starter) => <button key={starter} type="button" onClick={() => submitText(starter)}>{starter}</button>)}
          </div>
        )}
        {typing && (
          <div className="chat-message typing-message" data-sender="echo" aria-label="Echo is reflecting">
            <span className="message-avatar" aria-hidden="true">E</span>
            <p><i /><i /><i /></p>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>
      <form className="chat-composer" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="echo-message">Message Echo</label>
        <textarea id="echo-message" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKey} placeholder="Write what you’re noticing…" autoComplete="off" />
        <button type="submit" aria-label="Send message" disabled={!draft.trim() || typing}><span aria-hidden="true">↑</span></button>
      </form>
      <p className="chat-note">Private prototype · Not therapy or crisis support</p>
    </section>
  );
}

export default function Home() {
  const [flowStep, setFlowStep] = useState<FlowStep>("avatar-choice");
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [emotion, setEmotion] = useState<Emotion>("neutral");
  const [autoDemo, setAutoDemo] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("avatar");
  const [cameraState, setCameraState] = useState<CameraState>("off");
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const autoIndex = useRef(0);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraPromptedRef = useRef(false);
  const sphereVideoRef = useRef<HTMLVideoElement>(null);
  const emotionAudioRef = useRef<HTMLAudioElement>(null);

  const runSignal = useCallback((nextEmotion: Emotion) => {
    setEmotion(nextEmotion);
    if (sphereVideoRef.current) sphereVideoRef.current.currentTime = 0;

    const audio = emotionAudioRef.current;
    const media = EMOTION_MEDIA[nextEmotion];
    if (!audio || !media) {
      audio?.pause();
      if (audio) audio.currentTime = 0;
      setMusicPlaying(false);
      return;
    }

    if (audio.getAttribute("src") !== media.audio) {
      audio.src = media.audio;
      audio.load();
    }
    audio.currentTime = 0;
    if (!musicEnabled) {
      audio.pause();
      setMusicPlaying(false);
      return;
    }
    void audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
  }, [musicEnabled]);

  useEffect(() => {
    if (!autoDemo) return;
    const interval = setInterval(() => {
      runSignal(EMOTIONS[autoIndex.current].id);
      autoIndex.current = (autoIndex.current + 1) % EMOTIONS.length;
    }, 12000);
    return () => clearInterval(interval);
  }, [autoDemo, runSignal]);

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameraState("off");
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      return;
    }

    setCameraState("requesting");
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
      stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => {
        if (cameraStreamRef.current !== stream) return;
        cameraStreamRef.current = null;
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
        setCameraState("off");
      }, { once: true }));
      setCameraState("on");
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
      setCameraState(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error");
    }
  }, []);

  useEffect(() => {
    const stream = cameraStreamRef.current;
    const video = cameraVideoRef.current;
    if (flowStep !== "main" || !selectedAvatar || !stream || !video) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [flowStep, selectedAvatar, panelMode, cameraState]);

  const chooseAvatar = (avatar: AvatarOption) => {
    setSelectedAvatar(avatar);
    setFlowStep("camera-choice");
  };

  const enterWithCamera = () => {
    cameraPromptedRef.current = true;
    void startCamera();
    setFlowStep("main");
  };

  const enterWithoutCamera = () => {
    cameraPromptedRef.current = true;
    setFlowStep("main");
  };

  const changeActiveAvatar = (avatar: AvatarOption) => {
    setSelectedAvatar(avatar);
    setPanelMode("avatar");
    setAvatarPickerOpen(false);
  };

  const selectPanelMode = (nextMode: PanelMode) => {
    setPanelMode(nextMode);
    if (nextMode === "camera" && cameraState === "on") void cameraVideoRef.current?.play();
  };

  const toggleEmotionMusic = () => {
    const audio = emotionAudioRef.current;
    if (!audio) return;
    if (audio.paused) {
      setMusicEnabled(true);
      void audio.play().then(() => setMusicPlaying(true)).catch(() => setMusicPlaying(false));
    } else {
      setMusicEnabled(false);
      audio.pause();
    }
  };

  useEffect(() => {
    if (!avatarPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAvatarPickerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [avatarPickerOpen]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  if (flowStep === "avatar-choice" || !selectedAvatar) return <AvatarChooser onChoose={chooseAvatar} />;
  if (flowStep === "camera-choice") return <CameraChoice avatar={selectedAvatar} onYes={enterWithCamera} onNo={enterWithoutCamera} />;

  return (
    <main className="experience-shell" data-emotion={emotion} data-avatar-picker={avatarPickerOpen || undefined}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Reset EchoAI"><EchoMark /><span>EchoAI</span></a>
        <div className="header-actions">
          <button className="change-avatar-button" type="button" onClick={() => setAvatarPickerOpen(true)}><span aria-hidden="true">↺</span>Change avatar</button>
          <div className="header-status" data-camera-state={cameraState} aria-label="Prototype privacy status"><span className="privacy-dot" /><span>{cameraState === "on" ? "Camera on" : cameraState === "requesting" ? "Camera connecting" : "Camera off"}</span><span className="status-divider" /><span>Private demo</span></div>
        </div>
      </header>

      <EmotionSphere emotion={emotion} videoRef={sphereVideoRef} musicPlaying={musicPlaying} onToggleMusic={toggleEmotionMusic} />
      <audio ref={emotionAudioRef} loop preload="none" onPlay={() => setMusicPlaying(true)} onPause={() => setMusicPlaying(false)} />

      <aside className="companion-panel" aria-label="EchoAI interaction panel">
        <div className="panel-tabs" role="tablist" aria-label="Choose a companion view">
          {(["camera", "avatar", "echo"] as PanelMode[]).map((mode) => (
            <button
              key={mode}
              id={`${mode}-tab`}
              type="button"
              role="tab"
              aria-selected={panelMode === mode}
              aria-controls={`${mode}-panel`}
              tabIndex={panelMode === mode ? 0 : -1}
              onClick={() => selectPanelMode(mode)}
            >
              <span className={`tab-icon tab-icon-${mode}`} aria-hidden="true" />
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <div id="avatar-panel" className="panel-mode panel-mode-avatar" role="tabpanel" aria-labelledby="avatar-tab" hidden={panelMode !== "avatar"}>
          <div className="panel-heading">
            <h1 id="companion-title">I’m here with you.</h1>
          </div>
          <AnimatedAvatar emotion={emotion} avatar={selectedAvatar} />
        </div>

        <div id="camera-panel" className="panel-mode" role="tabpanel" aria-labelledby="camera-tab" hidden={panelMode !== "camera"}>
          <CameraView status={cameraState} videoRef={cameraVideoRef} onToggle={cameraState === "on" ? stopCamera : startCamera} />
        </div>

        <div id="echo-panel" className="panel-mode" role="tabpanel" aria-labelledby="echo-tab" hidden={panelMode !== "echo"}>
          <EchoChat />
        </div>
      </aside>

      <section className="demo-console" aria-labelledby="demo-title">
        <div className="console-label"><span className="console-pulse" /><div><p id="demo-title">Emotion preview</p><small>Prototype controls only</small></div></div>
        <div className="emotion-controls" role="group" aria-label="Test avatar response">
          {EMOTIONS.map((item) => (
            <button key={item.id} className="emotion-button" data-emotion={item.id} data-active={item.id === emotion} type="button" onClick={() => { setAutoDemo(false); runSignal(item.id); }}>
              <span className="emotion-swatch" />{item.label}
            </button>
          ))}
        </div>
        <button
          className="auto-button"
          type="button"
          aria-pressed={autoDemo}
          onClick={() => {
            if (autoDemo) { setAutoDemo(false); return; }
            const currentIndex = EMOTIONS.findIndex((item) => item.id === emotion);
            autoIndex.current = (currentIndex + 1) % EMOTIONS.length;
            runSignal(emotion);
            setAutoDemo(true);
          }}
        >
          <span aria-hidden="true">{autoDemo ? "Ⅱ" : "▶"}</span>{autoDemo ? "Pause demo" : "Auto demo"}
        </button>
      </section>

      <p className="prototype-note">Nonverbal acknowledgement · No diagnosis · No recording</p>
      {avatarPickerOpen && <AvatarPickerModal selected={selectedAvatar} onChoose={changeActiveAvatar} onClose={() => setAvatarPickerOpen(false)} />}
    </main>
  );
}
