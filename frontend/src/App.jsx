import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, 
  Database, 
  Cpu, 
  ShieldAlert, 
  Terminal as TerminalIcon, 
  Volume2, 
  VolumeX, 
  Layers, 
  Activity, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Trash2,
  Send,
  Mic,
  MicOff,
  Globe,
  Server,
  Network,
  Radio,
  X,
  Play,
  RotateCcw
} from 'lucide-react';

function App() {
  const [telemetry, setTelemetry] = useState({
    status: 'healthy',
    memory_state: 'low',
    cpu_state: 'low',
    memory_percent: 14.5,
    cpu_percent: 8.2
  });

  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), text: 'SYS_INIT: Mission Control War Room online. Node mesh connected.', type: 'info' }
  ]);

  const [agentConnected, setAgentConnected] = useState(false);
  const [targetConnected, setTargetConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Mission Control States & Animations
  const [autopilot, setAutopilot] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [hudTime, setHudTime] = useState('');
  const [micListening, setMicListening] = useState(false);
  const [nodeState, setNodeState] = useState('healthy'); // 'healthy' | 'alert' | 'remediating' | 'resolved'
  const [toasts, setToasts] = useState([]);
  const [timelineValue, setTimelineValue] = useState(100);
  const [incidents, setIncidents] = useState([
    { id: 'INC-101', time: '12:00:15', name: 'PodOOMKilled', status: 'RESOLVED', node: 'TARGET-APP-POD' }
  ]);

  // Rolling metrics history
  const [metricHistory, setMetricHistory] = useState([]);
  
  // Audio Synth refs
  const audioCtxRef = useRef(null);
  const humOscRef = useRef(null);
  const alertOscRef = useRef(null);
  const gainNodeRef = useRef(null);
  const recognitionRef = useRef(null);
  
  const logsEndRef = useRef(null);

  // UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setHudTime(now.toLocaleTimeString() + ' UTC');
    };
    const interval = setInterval(updateTime, 1000);
    updateTime();
    return () => clearInterval(interval);
  }, []);

  // Web Speech API Voice Recognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        addLog(`VOICE_IN: "${transcript}"`, 'info');
        executeCommand(transcript);
        setMicListening(false);
      };

      recognition.onerror = () => setMicListening(false);
      recognition.onend = () => setMicListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (micListening) {
      recognitionRef.current.stop();
      setMicListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setMicListening(true);
        addLog("VOICE_LISTEN: Listening for voice command...", "info");
      } catch (e) {
        setMicListening(false);
      }
    }
  };

  // Toast Notification helper
  const addToast = (title, message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Rolling metric history buffer
  useEffect(() => {
    setMetricHistory(prev => {
      const next = [...prev, {
        cpu: telemetry.cpu_percent,
        mem: telemetry.memory_percent,
        time: new Date().toLocaleTimeString()
      }];
      if (next.length > 15) next.shift();
      return next;
    });
  }, [telemetry]);

  // Audio Synth Controls
  useEffect(() => {
    if (audioEnabled) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.02, ctx.currentTime);
        gainNode.connect(ctx.destination);
        gainNodeRef.current = gainNode;
        
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, ctx.currentTime);
        osc.connect(gainNode);
        osc.start();
        humOscRef.current = osc;
      } catch (err) {
        console.error("Audio error:", err);
      }
    } else {
      stopAudio();
    }
    return () => stopAudio();
  }, [audioEnabled]);

  // Alert Tone frequency transitions
  useEffect(() => {
    if (!audioCtxRef.current || !gainNodeRef.current) return;
    const ctx = audioCtxRef.current;
    
    if (telemetry.status === 'unhealthy') {
      if (humOscRef.current) {
        humOscRef.current.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.8);
      }
      if (!alertOscRef.current) {
        const alertOsc = ctx.createOscillator();
        alertOsc.type = 'triangle';
        alertOsc.frequency.setValueAtTime(300, ctx.currentTime);
        
        const lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(1.5, ctx.currentTime);
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.006, ctx.currentTime);
        
        lfo.connect(lfoGain);
        lfoGain.connect(gainNodeRef.current.gain);
        alertOsc.connect(gainNodeRef.current);
        
        lfo.start();
        alertOsc.start();
        alertOscRef.current = alertOsc;
      }
    } else {
      if (humOscRef.current) {
        humOscRef.current.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 1);
      }
      if (alertOscRef.current) {
        try { alertOscRef.current.stop(); } catch (e) {}
        alertOscRef.current = null;
      }
    }
  }, [telemetry.status]);

  const stopAudio = () => {
    if (humOscRef.current) {
      try { humOscRef.current.stop(); } catch (e) {}
      humOscRef.current = null;
    }
    if (alertOscRef.current) {
      try { alertOscRef.current.stop(); } catch (e) {}
      alertOscRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) {}
      audioCtxRef.current = null;
    }
  };

  const playChime = () => {
    if (!audioCtxRef.current || !gainNodeRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  };

  const addLog = (text, type = 'info') => {
    setLogs(prev => [
      ...prev,
      { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), text, type }
    ]);
  };

  // Poll health metrics from Target App Port 5001
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('http://localhost:5001/health');
        if (res.ok) {
          const data = await res.json();
          if (telemetry.status === 'unhealthy' && data.status === 'healthy') {
            playChime();
            setNodeState('resolved');
            addToast("INCIDENT RESOLVED", "TARGET-APP-POD metrics healed back to steady state cyan.", "success");
            setTimeout(() => setNodeState('healthy'), 1000);
          }
          setTelemetry(data);
          setTargetConnected(true);
        } else {
          setTargetConnected(true);
        }
      } catch (err) {
        setTargetConnected(false);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 1500);
    return () => clearInterval(interval);
  }, [telemetry.status]);

  const detectLogType = (text) => {
    const upper = text.toUpperCase();
    if (upper.includes("❌") || upper.includes("FATAL") || upper.includes("DENIED")) return "error";
    if (upper.includes("⚠️") || upper.includes("ALERT") || upper.includes("WARNING")) return "warning";
    if (upper.includes("🤖") || upper.includes("OODA") || upper.includes("OBSERVE") || upper.includes("ORIENT") || upper.includes("DECIDE")) return "ai";
    if (upper.includes("🛡️") || upper.includes("VALIDATE") || upper.includes("OPA") || upper.includes("SHIELD") || upper.includes("HMAC")) return "shield";
    if (upper.includes("APPROVED") || upper.includes("SUCCESS") || upper.includes("ACT") || upper.includes("COMPLETE")) return "success";
    return "info";
  };

  // EventSource logs stream sync (FastAPI on Port 8000)
  useEffect(() => {
    let eventSource = null;
    const connectSSE = () => {
      eventSource = new EventSource('http://localhost:8000/logs');
      eventSource.onopen = () => {
        setAgentConnected(true);
        addLog("SSE_SYNC: Connected to AI Agent log stream.", "success");
      };
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'system' && data.message === 'CONNECTED') {
            setAgentConnected(true);
          } else if (data.type === 'log') {
            const rawMsg = data.message;
            addLog(rawMsg, detectLogType(rawMsg));

            if (rawMsg.includes("[ACT] Restarting") || rawMsg.includes("Executing action")) {
              setNodeState('remediating');
            }

            if (!autopilot && rawMsg.includes("Proposed Action")) {
              try {
                const actionPart = rawMsg.substring(rawMsg.indexOf("{"));
                const parsed = JSON.parse(actionPart);
                setPendingAction(parsed);
              } catch (e) {
                setPendingAction({ action: "restart_pod", target: "target-app" });
              }
            }
          }
        } catch (e) {}
      };
      eventSource.onerror = () => {
        setAgentConnected(false);
        addLog("SSE_RETRY: Seeking AI Agent Gateway...", "error");
        eventSource.close();
        setTimeout(connectSSE, 5000);
      };
    };
    connectSSE();
    return () => { if (eventSource) eventSource.close(); };
  }, [autopilot]);

  const injectFault = async (faultType) => {
    if (isSimulating) return;
    setIsSimulating(true);
    setNodeState('alert');

    let alertPayload = { environment: 'production' };
    let targetEndpoint = '';

    if (faultType === 'memory-leak') {
      targetEndpoint = 'http://localhost:5001/chaos/memory-leak';
      alertPayload.alert = "PodOOMKilled";
      alertPayload.details = "RAM saturation limit breached (128Mi limit)";
      setIncidents(prev => [{ id: `INC-${Date.now().toString().slice(-3)}`, time: new Date().toLocaleTimeString(), name: 'PodOOMKilled', status: 'ACTIVE', node: 'TARGET-APP-POD' }, ...prev]);
    } else if (faultType === 'cpu-spike') {
      targetEndpoint = 'http://localhost:5001/chaos/cpu-spike';
      alertPayload.alert = "CpuSpikeAlert";
      alertPayload.details = "CPU scheduler threadpool locked (95.1%)";
      setIncidents(prev => [{ id: `INC-${Date.now().toString().slice(-3)}`, time: new Date().toLocaleTimeString(), name: 'CpuSpikeAlert', status: 'ACTIVE', node: 'TARGET-APP-POD' }, ...prev]);
    } else if (faultType === 'db-purge') {
      alertPayload.alert = "DatabaseResetRequest";
      alertPayload.details = "Rogue action: request 'delete_database' on prod-db";
      setIncidents(prev => [{ id: `INC-${Date.now().toString().slice(-3)}`, time: new Date().toLocaleTimeString(), name: 'DatabaseResetRequest', status: 'BLOCKED', node: 'DB-CLUSTER-PRIM' }, ...prev]);
    }

    try {
      if (targetEndpoint) await fetch(targetEndpoint, { method: 'POST' });
      await fetch('http://localhost:8000/webhook/alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertPayload)
      });
    } catch (error) {
      addLog(`FAULT_ERR: ${error.message}`, 'error');
    } finally {
      setTimeout(() => setIsSimulating(false), 9500);
    }
  };

  const approveRemediation = async () => {
    if (!pendingAction) return;
    addLog(`OPERATOR_RELEASE: Action ${pendingAction.action} signature granted.`, 'success');
    setNodeState('remediating');
    try {
      if (pendingAction.action === 'restart_pod' || pendingAction.action === 'rollback_deployment') {
        await fetch('http://localhost:5001/chaos/reset', { method: 'POST' });
        playChime();
        setNodeState('resolved');
        addToast("REMEDIATION APPROVED", "Operator signature authorized pod restart.", "success");
        setTimeout(() => setNodeState('healthy'), 1000);
      }
    } catch (e) {
      addLog(`RELEASE_ERR: ${e.message}`, 'error');
    } finally {
      setPendingAction(null);
    }
  };

  const clearLogs = () => {
    setLogs([{ id: 1, time: new Date().toLocaleTimeString(), text: 'TERMINAL_CLEARED.', type: 'info' }]);
  };

  const executeCommand = (text) => {
    if (!text.trim()) return;
    const prompt = text.toLowerCase().trim();
    if (prompt.includes("memory") || prompt.includes("leak") || prompt.includes("ram")) injectFault('memory-leak');
    else if (prompt.includes("cpu") || prompt.includes("spike") || prompt.includes("thread")) injectFault('cpu-spike');
    else if (prompt.includes("db") || prompt.includes("database") || prompt.includes("purge") || prompt.includes("delete")) injectFault('db-purge');
    else if (prompt.includes("restart") || prompt.includes("heal") || prompt.includes("reset")) approveRemediation();
    else if (prompt.includes("clear") || prompt.includes("clean")) clearLogs();
    else addLog(`PROMPT_EXEC: Evaluating against Rego policies...`, 'info');
  };

  const handleAiPromptSubmit = (e) => {
    e.preventDefault();
    addLog(`PROMPT_IN: "${aiPromptText}"`, 'info');
    executeCommand(aiPromptText);
    setAiPromptText('');
  };

  const systemStatus = telemetry.status === 'unhealthy' ? 'CRITICAL' : 'healthy';
  const systemHealthScore = telemetry.status === 'unhealthy' ? 42.8 : 98.4;
  const memoryUsage = targetConnected ? Math.round(telemetry.memory_percent) : 0;
  const cpuUsage = targetConnected ? Math.round(telemetry.cpu_percent) : 0;

  const getSvgPath = (key) => {
    if (metricHistory.length < 2) return "";
    const width = 280;
    const height = 55;
    const points = metricHistory.map((pt, idx) => {
      const x = (idx / (metricHistory.length - 1)) * width;
      const val = pt[key] || 0;
      const y = height - (val / 100) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  return (
    <div className="crt-overlay radar-grid min-h-screen bg-[#0A1128] text-[#00D4FF] flex flex-col font-mono select-none relative overflow-x-hidden">
      
      {/* Slide-In Toast Notifications (Top-Right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className="animate-toast-slide warroom-panel bg-[#0A1128]/95 border border-[#00E699] p-3.5 rounded-lg shadow-2xl flex items-start gap-3 text-xs">
            <CheckCircle className="w-5 h-5 text-[#00E699] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-[#00E699] uppercase tracking-wider">{toast.title}</h4>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-normal">{toast.message}</p>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* TOP STATUS BAR & INCIDENT TIMELINE SCRUBBER */}
      <header className="bg-[#070D1E]/95 border-b border-[#00D4FF]/30 px-6 py-3 flex flex-col gap-2.5 sticky top-0 z-40 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#00D4FF]/10 border border-[#00D4FF]/40 rounded glow-cyan">
              <Radio className="w-5 h-5 text-[#00D4FF] animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-base tracking-wider text-white flex items-center gap-2">
                ASHIP // NASA WAR ROOM MISSION CONTROL
              </h1>
              <p className="text-[10px] text-slate-400 font-sans">Autonomous Infrastructure Remediation Console</p>
            </div>
          </div>

          {/* System Health Score numeric % */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#0A1128] border border-[#00D4FF]/30 px-4 py-1.5 rounded">
              <span className="text-[10px] text-slate-400 font-bold uppercase">OVERALL SYSTEM HEALTH</span>
              <span className={`text-xl font-extrabold font-mono ${systemStatus === 'healthy' ? 'text-[#00E699]' : 'text-[#FF3B5C] animate-pulse'}`}>
                {systemHealthScore}%
              </span>
            </div>

            {/* Service Badges */}
            <div className="hidden xl:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-[#0A1128] px-3 py-1 rounded border border-[#00D4FF]/20">
                <span className={`w-2 h-2 rounded-full ${targetConnected ? 'bg-[#00E699] glow-emerald' : 'bg-[#FF3B5C] glow-red'}`} />
                <span className="text-slate-400">TARGET:</span>
                <span className="text-white font-bold">5001</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#0A1128] px-3 py-1 rounded border border-[#00D4FF]/20">
                <span className={`w-2 h-2 rounded-full ${agentConnected ? 'bg-[#00E699] glow-emerald' : 'bg-[#FF3B5C] glow-red'}`} />
                <span className="text-slate-400">AGENT:</span>
                <span className="text-white font-bold">8000</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#0A1128] px-3 py-1 rounded border border-[#00D4FF]/20">
                <Shield className="w-3.5 h-3.5 text-[#00D4FF]" />
                <span className="text-slate-400">OPA REGO:</span>
                <span className="text-[#00D4FF] font-bold">ACTIVE</span>
              </div>
            </div>

            {/* Audio Toggle */}
            <button 
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-1.5 rounded border transition-all text-xs flex items-center gap-1 ${
                audioEnabled ? 'bg-[#00D4FF]/20 border-[#00D4FF] text-[#00D4FF]' : 'bg-white/5 border-white/10 text-slate-500'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Horizontal Incident History Timeline Scrubber */}
        <div className="flex items-center gap-3 bg-[#0A1128]/80 border border-[#00D4FF]/20 px-3 py-1.5 rounded">
          <Clock className="w-3.5 h-3.5 text-[#00D4FF] shrink-0" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">INCIDENT TIMELINE SCRUBBER</span>
          <input 
            type="range"
            min="0"
            max="100"
            value={timelineValue}
            onChange={(e) => setTimelineValue(e.target.value)}
            className="w-full h-1 bg-[#00D4FF]/20 rounded-lg appearance-none cursor-pointer accent-[#00D4FF]"
          />
          <span className="text-[10px] font-mono text-[#00D4FF] shrink-0">{hudTime}</span>
        </div>
      </header>

      {/* MAIN MISSION CONTROL GRID */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 pb-24">
        
        {/* CENTER TOPOLOGY MAP (NODE GRAPH SVG) - 6 cols */}
        <section className="lg:col-span-6 flex flex-col space-y-6">
          
          <div className={`warroom-panel p-5 flex flex-col space-y-4 ${telemetry.status === 'unhealthy' ? 'panel-pulsing-alert' : ''}`}>
            <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-3">
              <div className="flex items-center gap-2">
                <Network className="w-4.5 h-4.5 text-[#00D4FF]" />
                <h2 className="font-bold text-sm text-white tracking-wider uppercase">CENTRAL INFRASTRUCTURE TOPOLOGY MAP</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded border uppercase ${
                nodeState === 'alert' ? 'bg-[#FF3B5C]/20 border-[#FF3B5C] text-[#FF3B5C] animate-pulse' :
                nodeState === 'remediating' ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]' :
                'bg-[#00E699]/10 border-[#00E699]/30 text-[#00E699]'
              }`}>
                {nodeState}
              </span>
            </div>

            {/* Large Topology Map SVG Canvas */}
            <div className="bg-[#050A18] border border-[#00D4FF]/20 rounded p-4 relative overflow-hidden flex items-center justify-center min-h-[300px]">
              
              <svg className="w-full h-[280px]" viewBox="0 0 540 280">
                {/* Connecting Lines between Topology Nodes */}
                <line x1="90" y1="140" x2="270" y2="140" stroke="#00D4FF" strokeWidth="1.5" className="ooda-flow-dash" />
                <line x1="270" y1="140" x2="430" y2="80" stroke="#00D4FF" strokeWidth="1.5" className="ooda-flow-dash" />
                <line x1="270" y1="140" x2="430" y2="200" stroke="#00D4FF" strokeWidth="1.5" className="ooda-flow-dash" />
                <line x1="270" y1="140" x2="270" y2="240" stroke="#00D4FF" strokeWidth="1.5" strokeDasharray="4 4" />

                {/* Node 1: GATEWAY-NODE-01 */}
                <g transform="translate(90, 140)">
                  <circle r="18" fill="#0A1128" stroke="#00D4FF" strokeWidth="2" className="glow-cyan" />
                  <text y="4" textAnchor="middle" fill="#00D4FF" className="text-[8px] font-bold font-mono">GW</text>
                  <text y="32" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono">GATEWAY-01</text>
                </g>

                {/* Node 2: TARGET-APP-POD (Main Interactive Healing Target Node!) */}
                <g transform="translate(270, 140)" className={nodeState === 'resolved' ? 'animate-node-snap' : ''}>
                  {/* Alert radar-sweep ring */}
                  {nodeState === 'alert' && (
                    <circle r="14" fill="none" stroke="#FF3B5C" className="animate-radar-sweep" />
                  )}

                  {/* Auto-remediation spinning ring */}
                  {nodeState === 'remediating' && (
                    <circle r="26" fill="none" stroke="#FFB800" strokeWidth="2" strokeDasharray="12 6" className="animate-spin-ring" />
                  )}

                  {/* Node Circle */}
                  <circle r="20" className={`transition-all duration-500 ${
                    nodeState === 'alert' ? 'fill-[#FF3B5C]/20 stroke-[#FF3B5C] stroke-2 glow-red' :
                    nodeState === 'remediating' ? 'fill-[#FFB800]/20 stroke-[#FFB800] stroke-2 glow-amber' :
                    nodeState === 'resolved' ? 'fill-[#00E699]/30 stroke-[#00E699] stroke-2 glow-emerald' :
                    'fill-[#0A1128] stroke-[#00D4FF] stroke-2 glow-cyan'
                  }`} />

                  <Zap className={`w-5 h-5 -translate-x-2.5 -translate-y-2.5 ${
                    nodeState === 'alert' ? 'text-[#FF3B5C] animate-bounce' :
                    nodeState === 'remediating' ? 'text-[#FFB800] animate-spin' :
                    nodeState === 'resolved' ? 'text-[#00E699]' : 'text-[#00D4FF]'
                  }`} />

                  <text y="36" textAnchor="middle" fill={nodeState === 'alert' ? '#FF3B5C' : '#white'} className="text-[10px] font-bold font-mono">
                    TARGET-APP-POD
                  </text>
                </g>

                {/* Node 3: DB-CLUSTER-PRIM */}
                <g transform="translate(430, 80)">
                  <circle r="16" fill="#0A1128" stroke="#00D4FF" strokeWidth="1.5" />
                  <Database className="w-4 h-4 -translate-x-2 -translate-y-2 text-[#00D4FF]" />
                  <text y="30" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono">PROD-DB</text>
                </g>

                {/* Node 4: REDIS-CACHE-01 */}
                <g transform="translate(430, 200)">
                  <circle r="16" fill="#0A1128" stroke="#00D4FF" strokeWidth="1.5" />
                  <Layers className="w-4 h-4 -translate-x-2 -translate-y-2 text-[#00D4FF]" />
                  <text y="30" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono">REDIS-CACHE</text>
                </g>

                {/* Node 5: AI-AGENT-REASONER */}
                <g transform="translate(270, 240)">
                  <circle r="16" fill="#0A1128" stroke="#00D4FF" strokeWidth="1.5" />
                  <Cpu className="w-4 h-4 -translate-x-2 -translate-y-2 text-[#00D4FF]" />
                  <text y="28" textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono">AI-AGENT-8000</text>
                </g>
              </svg>

            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>mesh_protocol: gRPC/v2</span>
              <span>packet_flow: ACTIVE</span>
            </div>
          </div>

          {/* Fault Injector Panel */}
          <div className="warroom-panel p-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#FFB800]" />
                <h3 className="font-bold text-xs text-white uppercase">SYNTHETIC FAULT INJECTION ENGINE</h3>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => injectFault('memory-leak')}
                disabled={isSimulating || !targetConnected}
                className="bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 hover:bg-[#FF3B5C]/20 text-[#FF3B5C] p-2.5 rounded text-[10px] font-bold uppercase transition-all flex flex-col items-center gap-1.5 disabled:opacity-40 glow-red"
              >
                <Database className="w-4 h-4" />
                <span>Memory Leak</span>
              </button>

              <button 
                onClick={() => injectFault('cpu-spike')}
                disabled={isSimulating || !targetConnected}
                className="bg-[#FFB800]/10 border border-[#FFB800]/40 hover:bg-[#FFB800]/20 text-[#FFB800] p-2.5 rounded text-[10px] font-bold uppercase transition-all flex flex-col items-center gap-1.5 disabled:opacity-40 glow-amber"
              >
                <Cpu className="w-4 h-4" />
                <span>CPU Saturation</span>
              </button>

              <button 
                onClick={() => injectFault('db-purge')}
                disabled={isSimulating || !agentConnected}
                className="bg-[#00D4FF]/10 border border-[#00D4FF]/40 hover:bg-[#00D4FF]/20 text-[#00D4FF] p-2.5 rounded text-[10px] font-bold uppercase transition-all flex flex-col items-center gap-1.5 disabled:opacity-40 glow-cyan"
              >
                <Shield className="w-4 h-4" />
                <span>DB Purge (OPA)</span>
              </button>
            </div>
          </div>

        </section>

        {/* SURROUNDING TELEMETRY PANELS - LEFT (3 cols) */}
        <section className="lg:col-span-3 flex flex-col space-y-6">
          
          {/* Latency & Error Rates */}
          <div className="warroom-panel p-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#00D4FF]" />
                <h3 className="font-bold text-xs text-white uppercase">LATENCY & THROUGHPUT</h3>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Response:</span>
                <span className="text-white font-bold">12.4 ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Packet Throughput:</span>
                <span className="text-[#00D4FF] font-bold">8.4 k/s</span>
              </div>
            </div>

            {/* Waveform 1 */}
            <div className="bg-[#050A18] border border-[#00D4FF]/20 p-2 rounded">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">RAM Waveform</div>
              <svg className="w-full h-12" viewBox="0 0 280 55" preserveAspectRatio="none">
                <path d={getSvgPath('mem')} fill="none" stroke="#00D4FF" strokeWidth="1.8" />
              </svg>
            </div>

            {/* Waveform 2 */}
            <div className="bg-[#050A18] border border-[#00D4FF]/20 p-2 rounded">
              <div className="text-[8px] text-slate-400 uppercase font-bold mb-1">CPU Waveform</div>
              <svg className="w-full h-12" viewBox="0 0 280 55" preserveAspectRatio="none">
                <path d={getSvgPath('cpu')} fill="none" stroke="#FFB800" strokeWidth="1.8" />
              </svg>
            </div>
          </div>

          {/* Memory & CPU Gauges */}
          <div className="warroom-panel p-4 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
              <h3 className="font-bold text-xs text-white uppercase">ERROR RATES & SATURATION</h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">RAM (128Mi)</span>
                  <span className={telemetry.memory_state === 'critical' ? 'text-[#FF3B5C]' : 'text-[#00D4FF]'}>{memoryUsage}%</span>
                </div>
                <div className="h-2 bg-[#050A18] rounded border border-[#00D4FF]/20 overflow-hidden">
                  <div className={`h-full ${telemetry.memory_state === 'critical' ? 'bg-[#FF3B5C]' : 'bg-[#00D4FF]'}`} style={{ width: `${memoryUsage}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">CPU Saturation</span>
                  <span className={telemetry.cpu_state === 'critical' ? 'text-[#FFB800]' : 'text-[#00D4FF]'}>{cpuUsage}%</span>
                </div>
                <div className="h-2 bg-[#050A18] rounded border border-[#00D4FF]/20 overflow-hidden">
                  <div className={`h-full ${telemetry.cpu_state === 'critical' ? 'bg-[#FFB800]' : 'bg-[#00D4FF]'}`} style={{ width: `${cpuUsage}%` }} />
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* SURROUNDING TELEMETRY PANELS - RIGHT (3 cols) */}
        <section className="lg:col-span-3 flex flex-col space-y-6">
          
          {/* Active Incidents & Healing Queue */}
          <div className="warroom-panel p-4 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
              <h3 className="font-bold text-xs text-white uppercase">ACTIVE INCIDENTS QUEUE</h3>
            </div>

            <div className="space-y-2 text-xs">
              {incidents.slice(0, 3).map(inc => (
                <div key={inc.id} className="bg-[#050A18] border border-[#00D4FF]/20 p-2.5 rounded flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block text-[11px]">{inc.name}</span>
                    <span className="text-[9px] text-slate-400">{inc.node} • {inc.time}</span>
                  </div>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
                    inc.status === 'ACTIVE' ? 'bg-[#FF3B5C]/20 border-[#FF3B5C] text-[#FF3B5C]' :
                    inc.status === 'BLOCKED' ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]' :
                    'bg-[#00E699]/20 border-[#00E699] text-[#00E699]'
                  }`}>
                    {inc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Diagnostics Terminal Stream */}
          <div className="warroom-panel p-4 flex flex-col space-y-3 flex-1 min-h-[300px]">
            <div className="flex items-center justify-between border-b border-[#00D4FF]/20 pb-2">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 text-[#00D4FF]" />
                <h3 className="font-bold text-xs text-white uppercase">AI LOGS STREAM</h3>
              </div>
              <button onClick={clearLogs} className="text-[9px] text-slate-500 hover:text-white uppercase font-bold">CLEAR</button>
            </div>

            <div className="bg-[#050A18] border border-[#00D4FF]/20 p-3 rounded font-mono text-[9.5px] leading-relaxed text-[#00D4FF]/80 warroom-scrollbar overflow-y-auto max-h-[280px] flex flex-col gap-1.5">
              {logs.map((log) => (
                <div key={log.id} className="whitespace-pre-wrap flex items-start gap-1.5 border-b border-white/5 pb-0.5">
                  <span className="text-slate-500">[{log.time}]</span>
                  <span className={
                    log.type === 'error' ? 'text-[#FF3B5C] font-bold' :
                    log.type === 'warning' ? 'text-[#FFB800]' :
                    log.type === 'shield' ? 'text-indigo-400' :
                    log.type === 'success' ? 'text-[#00E699] font-bold' : 'text-slate-300'
                  }>
                    {log.text}
                  </span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>

        </section>

      </main>

      {/* Manual Release Approval Prompt Modal if Autopilot is OFF */}
      {!autopilot && pendingAction && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[#070D1E] border border-[#FFB800] p-4 rounded shadow-2xl z-50 flex items-center gap-4 glow-amber">
          <AlertTriangle className="w-6 h-6 text-[#FFB800] animate-bounce shrink-0" />
          <div>
            <h4 className="font-bold text-xs text-[#FFB800] uppercase">REMEDIATION ACTION AUTHORIZATION NEEDED</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">Proposed action: <code className="text-white font-bold">{pendingAction.action}</code></p>
          </div>
          <button onClick={approveRemediation} className="bg-[#FFB800] text-[#0A1128] font-bold py-1.5 px-4 rounded text-xs uppercase hover:bg-yellow-400">
            RELEASE SIGNATURE
          </button>
        </div>
      )}

      {/* FLOATING AI COMMAND BAR (BOTTOM CENTER) */}
      <form 
        onSubmit={handleAiPromptSubmit}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-[560px] px-4 z-40"
      >
        <div className="bg-[#070D1E]/95 border border-[#00D4FF]/40 p-1.5 flex items-center relative overflow-hidden rounded-full shadow-2xl backdrop-blur-2xl glow-cyan">
          
          <button
            type="button"
            onClick={toggleMic}
            className={`p-2 rounded-full transition-all shrink-0 ${
              micListening ? 'text-[#FF3B5C] bg-[#FF3B5C]/20 animate-pulse' : 'text-[#00D4FF] hover:text-white'
            }`}
          >
            {micListening ? <Mic className="w-4 h-4 animate-pulse" /> : <Zap className="w-4 h-4" />}
          </button>
          
          <input 
            type="text"
            value={aiPromptText}
            onChange={(e) => setAiPromptText(e.target.value)}
            placeholder="Command Mission Control (e.g., 'inject memory leak', 'restart pod')..."
            className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 px-2.5 font-mono"
          />
          
          <button 
            type="submit"
            className="bg-[#00D4FF] hover:bg-cyan-400 text-[#0A1128] font-bold py-1.5 px-4 rounded-full text-[10px] uppercase transition-all shrink-0 font-mono shadow-lg flex items-center gap-1.5"
          >
            <span>Execute</span>
            <Send className="w-3 h-3" />
          </button>
        </div>
      </form>

    </div>
  );
}

export default App;
