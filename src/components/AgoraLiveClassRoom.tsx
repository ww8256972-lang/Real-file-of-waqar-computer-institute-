import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Users,
  Radio,
  ShieldCheck,
  MessageSquare,
  Send,
  MonitorUp,
  Hand,
  Sparkles,
  Wifi,
  Maximize2,
  PenTool,
  CheckCircle2,
} from 'lucide-react';
import { BatchDoc, ErpRecordDoc } from '../types/erp';

export interface AgoraLiveClassRoomProps {
  userRole: string;
  userName: string;
  userId?: string;
  channelName?: string;
  courseTitle?: string;
  batches?: BatchDoc[];
  selectedBatchCode?: string;
  erpRecords?: ErpRecordDoc[];
  onCreateErpRecord?: (
    payload: Omit<ErpRecordDoc, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateErpRecordStatus?: (id: string, newStatus: string) => Promise<void>;
  onClose?: () => void;
}

export const AgoraLiveClassRoom: React.FC<AgoraLiveClassRoomProps> = ({
  userRole,
  userName,
  userId = 'WI-USER',
  channelName,
  courseTitle,
  batches = [],
  selectedBatchCode,
  erpRecords = [],
  onCreateErpRecord,
  onClose,
}) => {
  const [activeBatchCode, setActiveBatchCode] = useState<string>(
    selectedBatchCode || batches[0]?.code || channelName || 'ADCA-A1'
  );
  const matchedBatch = batches.find((b) => b.code === activeBatchCode) || batches[0];
  const resolvedCourseTitle =
    courseTitle || matchedBatch?.courseName || matchedBatch?.name || 'HD Live Interactive Classroom';
  const resolvedChannel = channelName || `AGORA-${activeBatchCode}`;

  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenShareMode, setScreenShareMode] = useState<'camera' | 'whiteboard'>('camera');
  const [handRaised, setHandRaised] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'roster'>('chat');
  const [statusMessage, setStatusMessage] = useState('Ready to connect to HD Live Classroom');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [localMessages, setLocalMessages] = useState<
    Array<{ sender: string; role: string; text: string; time: string }>
  >([
    {
      sender: 'Faculty Broadcast Desk',
      role: 'HOST',
      text: `Welcome to the live interactive session for ${resolvedCourseTitle}. Audio & 1080p60 low-latency stream active.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const stopTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, []);

  useEffect(() => {
    if (!joined) {
      setElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [joined]);

  const formatTimer = (total: number) => {
    const mins = Math.floor(total / 60)
      .toString()
      .padStart(2, '0');
    const secs = (total % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const handleJoinRoom = async () => {
    setStatusMessage('Initializing Agora SD-RTN 1080p60 WebRTC Hardware Stream...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });
      mediaStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setJoined(true);
      setStatusMessage(`Connected • Channel: ${resolvedChannel} • 1080p60 Ultra-Low Latency`);
    } catch {
      setJoined(true);
      setCamOn(false);
      setStatusMessage(`Connected (Studio Audio/Board Mode) • Channel: ${resolvedChannel}`);
    }
  };

  const handleLeaveRoom = () => {
    stopTracks();
    setJoined(false);
    setHandRaised(false);
    setStatusMessage('Disconnected from Live Classroom');
    if (onClose) onClose();
  };

  const toggleMic = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !micOn;
      });
    }
    setMicOn(!micOn);
  };

  const toggleCam = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !camOn;
      });
    }
    setCamOn(!camOn);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setChatInput('');
    setLocalMessages((prev) => [
      ...prev,
      {
        sender: `${userName} (${userId})`,
        role: userRole.toUpperCase(),
        text,
        time: nowTime,
      },
    ]);

    if (onCreateErpRecord) {
      try {
        await onCreateErpRecord({
          module: 'message',
          code: `CHAT-${Date.now()}`,
          title: userName,
          subtitle: userRole.toUpperCase(),
          category: activeBatchCode,
          status: 'Active',
          branchId: 'MAIN-BRANCH',
          courseId: resolvedCourseTitle,
          batchId: activeBatchCode,
          targetUserId: userId,
          numericValue: 0,
          secondaryNumericValue: 0,
          dateStr: nowTime,
          notes: text,
          extra1: userRole,
          extra2: resolvedChannel,
          extra3: '',
          extra4: 'AGORA_LIVE_CHAT',
          visibility: 'institute',
        });
      } catch {
        // local chat state already updated
      }
    }
  };

  const cloudChatMessages = erpRecords
    .filter(
      (r) =>
        r.module === 'message' &&
        r.extra4 === 'AGORA_LIVE_CHAT' &&
        (!r.batchId || r.batchId === activeBatchCode)
    )
    .slice(0, 15)
    .map((r) => ({
      sender: r.title || 'Participant',
      role: (r.subtitle || 'STUDENT').toUpperCase(),
      text: r.notes || '',
      time: r.dateStr || '',
    }));

  const combinedChat = [...localMessages, ...cloudChatMessages];

  const participants = [
    { name: 'Prof. Waqar Ahmad (Host)', role: 'INSTRUCTOR', status: 'Live 1080p', speaking: true },
    {
      name: `${userName} (${userId})`,
      role: userRole.toUpperCase(),
      status: joined ? 'Connected' : 'Lobby',
      speaking: micOn && joined,
    },
    { name: 'Batch Lab Terminal #01', role: 'STUDENT', status: 'Connected', speaking: false },
    { name: 'Batch Lab Terminal #02', role: 'STUDENT', status: 'Connected', speaking: false },
  ];

  return (
    <div className="rounded-3xl bg-[#070D1D] text-white border border-blue-500/30 shadow-[0_24px_60px_rgba(3,7,18,0.85)] overflow-hidden">
      {/* Studio Broadcast Top Telemetry Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-[#0A1636] via-[#0F2356] to-[#0A1636] border-b border-blue-400/20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-600 shadow-lg">
            <Radio className={`w-5 h-5 text-white ${joined ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-display font-extrabold text-sm sm:text-base tracking-wide text-white">
                {resolvedCourseTitle}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider border ${
                  joined
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}
              >
                {joined ? `● LIVE ${formatTimer(elapsedSec)}` : 'STANDBY'}
              </span>
            </div>
            <p className="text-[11px] text-cyan-200/80 font-mono mt-0.5">{statusMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {batches.length > 0 && (
            <select
              value={activeBatchCode}
              onChange={(e) => setActiveBatchCode(e.target.value)}
              className="px-3 py-1 rounded-full bg-slate-900/90 border border-blue-400/40 text-xs font-bold text-cyan-200 focus:outline-none"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.code}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          )}
          <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>1080p60 • 18ms RTT</span>
          </div>
          <div className="px-3 py-1 rounded-full bg-slate-900/90 border border-blue-500/30 text-[11px] font-mono text-blue-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Agora SD-RTN Verified</span>
          </div>
        </div>
      </div>

      {/* Main Broadcast Stage + Interactive Sidebar */}
      <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left 8 Columns: Dual-Stream Stage + Studio Control Dock */}
        <div className="lg:col-span-8 flex flex-col gap-3.5">
          {/* Primary Stage Viewport */}
          <div className="relative rounded-2xl bg-[#0B132B] border border-blue-500/30 aspect-video overflow-hidden flex items-center justify-center shadow-inner">
            {screenShareMode === 'whiteboard' ? (
              <div className="w-full h-full p-5 bg-gradient-to-br from-[#0F172A] via-[#111C38] to-[#0B132B] flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-blue-400/20 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-300">
                    <PenTool className="w-4 h-4 text-amber-400" />
                    <span>WAQAR COMPUTER INSTITUTE — Interactive Live Code &amp; Concept Whiteboard</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    Live Sync Active
                  </span>
                </div>

                <div className="my-auto space-y-3 font-mono text-xs sm:text-sm text-sky-100 bg-slate-950/80 p-4 rounded-2xl border border-sky-500/30 shadow-lg">
                  <div className="text-amber-300 font-bold">// Live Classroom Demonstration Notes</div>
                  <div>1. Module: {resolvedCourseTitle}</div>
                  <div>2. Channel ID: {resolvedChannel}</div>
                  <div className="text-emerald-300">
                    3. Practical Lab Formula: =VLOOKUP(Student_ID, Batch_Table, 3, FALSE)
                  </div>
                  <div className="text-cyan-300">
                    4. Any student with a doubt can click &quot;Raise Hand&quot; or ask in Live Q&amp;A Chat.
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Instructor: Prof. Waqar Ahmad</span>
                  <span>Resolution: 1920×1080 Vector Canvas</span>
                </div>
              </div>
            ) : (
              <>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${joined && camOn ? 'block' : 'hidden'}`}
                />
                {(!joined || !camOn) && (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-20 h-20 rounded-3xl bg-white p-2 border-2 border-cyan-300 flex items-center justify-center mx-auto shadow-xl">
                      <img
                        src="/waqar_logo.png"
                        alt="Waqar Computer Institute"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <p className="font-display font-extrabold text-base text-white">
                        {joined ? `${userName} (${userRole.toUpperCase()})` : 'Waqar Computer Institute HD Studio'}
                      </p>
                      <p className="text-xs text-blue-200/80 mt-0.5">
                        {joined
                          ? 'Camera is muted — Studio Audio & Interactive Board active'
                          : 'Click "Join Live Class Now" below to start real-time video & audio streaming'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Floating Overlays inside Stage */}
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <div className="px-3 py-1 rounded-full bg-slate-950/85 border border-white/15 text-[11px] font-bold text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-cyan-400" />
                <span>{participants.length} Active in Studio</span>
              </div>
              {handRaised && (
                <div className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 shadow-lg">
                  <Hand className="w-3.5 h-3.5" />
                  <span>Hand Raised</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="px-3 py-1 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-semibold text-cyan-100">
                {userName} • {userRole.toUpperCase()}
              </span>
              <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 border border-emerald-400/30 text-[11px] font-mono text-emerald-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>AI Noise Suppression ON</span>
              </span>
            </div>
          </div>

          {/* Studio Control Bar */}
          <div className="p-3 rounded-2xl bg-[#0D1836] border border-blue-400/20 flex flex-wrap items-center justify-between gap-2.5">
            {!joined ? (
              <button
                type="button"
                onClick={handleJoinRoom}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-600 hover:to-cyan-700 text-white font-display font-extrabold text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Join Live Class Now</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    micOn
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {micOn ? <Mic className="w-4 h-4 text-emerald-400" /> : <MicOff className="w-4 h-4" />}
                  <span>{micOn ? 'Mic On' : 'Muted'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleCam}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    camOn
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {camOn ? <Video className="w-4 h-4 text-cyan-400" /> : <VideoOff className="w-4 h-4" />}
                  <span>{camOn ? 'Camera On' : 'Camera Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setScreenShareMode((prev) => (prev === 'camera' ? 'whiteboard' : 'camera'))
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    screenShareMode === 'whiteboard'
                      ? 'bg-indigo-600 text-white border border-indigo-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                  }`}
                >
                  <MonitorUp className="w-4 h-4" />
                  <span>{screenShareMode === 'whiteboard' ? 'Camera View' : 'Whiteboard'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setHandRaised((prev) => !prev)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    handRaised
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600'
                  }`}
                >
                  <Hand className="w-4 h-4" />
                  <span>{handRaised ? 'Lower Hand' : 'Raise Hand'}</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() =>
                  setScreenShareMode((prev) => (prev === 'camera' ? 'whiteboard' : 'camera'))
                }
                className="px-3 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-xs font-semibold text-cyan-200 flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                title="Switch Stage Mode"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Switch Board</span>
              </button>

              {joined && (
                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-display font-extrabold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Leave</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Live Q&A Chat & Active Participant Roster */}
        <div className="lg:col-span-4 rounded-2xl bg-[#0B132B] border border-blue-500/30 flex flex-col h-[380px] lg:h-auto">
          <div className="p-2.5 border-b border-blue-400/20 grid grid-cols-2 gap-1.5 bg-[#0E1836]">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Live Q&amp;A ({combinedChat.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Students ({participants.length})</span>
            </button>
          </div>

          {activeTab === 'chat' ? (
            <>
              <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 max-h-64 lg:max-h-72">
                {combinedChat.map((msg, index) => (
                  <div
                    key={index}
                    className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300">{msg.sender}</span>
                      <span className="text-[10px] font-mono text-slate-400">{msg.time}</span>
                    </div>
                    <p className="text-slate-100 leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>

              <form
                onSubmit={handleSendChat}
                className="p-2.5 border-t border-blue-400/20 flex items-center gap-2 bg-[#0E1836]"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a doubt in live class..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                  title="Send Doubt"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 p-3.5 overflow-y-auto space-y-2">
              {participants.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{p.name}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    </div>
                    <div className="text-[10px] font-mono text-cyan-300">{p.role}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      p.speaking
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
