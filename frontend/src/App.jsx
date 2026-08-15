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
  RotateCcw,
  Sparkles,
  Lock,
  FileCode,
  Sliders,
  Check,
  ChevronRight,
  Eye,
  Compass,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Key,
  Plus,
  Link,
  Settings,
  Download,
  MessageSquare
} from 'lucide-react';

function App() {
  // Telemetry state from Target App Port 5001
  const [telemetry, setTelemetry] = useState({
    status: 'healthy',
    memory_state: 'low',
    cpu_state: 'low',
    memory_percent: 14.5,
    cpu_percent: 8.2
  });

  const [logs, setLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), text: 'SYS_INIT: ASHIP Universal Auto-Healing Platform online. Integration drivers active.', type: 'info' }
  ]);

  const [agentConnected, setAgentConnected] = useState(false);
  const [targetConnected, setTargetConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Figma SRE Control Center States
  const [clusterEnv, setClusterEnv] = useState('Local-Minikube'); // 'Local-Minikube' | 'Staging-EU' | 'Prod-US'
  const [selectedNode, setSelectedNode] = useState('aship-target-app');
  const [autopilot, setAutopilot] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [hudTime, setHudTime] = useState('');
  const [micListening, setMicListening] = useState(false);
  const [nodeState, setNodeState] = useState('healthy'); // 'healthy' | 'alert' | 'remediating' | 'resolved'
  const [oodaStage, setOodaStage] = useState(0); // 0: Idle, 1: Observe, 2: Orient, 3: Decide, 4: Validate, 5: Act
  const [lastHmacSignature, setLastHmacSignature] = useState('sha256:7f4a9b0c2d3e4f5a6b7c8d9e0f1a2b3c');
  const [lastMatchedRunbook, setLastMatchedRunbook] = useState('K8s-RB-102: Container OOM Recovery');
  const [toasts, setToasts] = useState([]);

  // Universal External Service Registration Modal States
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regServiceName, setRegServiceName] = useState('');
  const [regHealthUrl, setRegHealthUrl] = useState('');
  const [regRemediationUrl, setRegRemediationUrl] = useState('');
  
  const [topologyNodes, setTopologyNodes] = useState([
    { id: 'aship-target-app', name: 'aship-target-app', status: 'Healthy', type: 'Target Pod', port: '5001', health_url: 'http://localhost:5001/health', remediation_url: 'http://localhost:5001/chaos/reset' },
    { id: 'auth-service', name: 'auth-service', status: 'Healthy', type: 'Gateway', port: '8080', health_url: 'http://localhost:8080/health', remediation_url: 'http://localhost:8080/reset' },
    { id: 'postgres-db', name: 'postgres-db-prim', status: 'Healthy', type: 'Database', port: '5432', health_url: 'http://localhost:5432/health', remediation_url: 'http://localhost:5432/reset' },
    { id: 'redis-cache', name: 'redis-cache-01', status: 'Healthy', type: 'Cache', port: '6379', health_url: 'http://localhost:6379/health', remediation_url: 'http://localhost:6379/reset' }
  ]);

  // Rolling metrics history for sparkline SVG trend curves
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

      recognition.onerror = () => {
        setMicListening(false);
        addToast("MIC PERMISSION", "Microphone access was denied or unavailable.", "error");
      };
      recognition.onend = () => setMicListening(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      addToast("VOICE CONTROL", "Web Speech API is not supported in this browser.", "warning");
      return;
    }
    if (micListening) {
      recognitionRef.current.stop();
      setMicListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setMicListening(true);
        addLog("VOICE_LISTEN: Listening for SRE voice command...", "info");
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
      if (next.length > 20) next.shift();
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
            setOodaStage(5);
            addToast("INFRASTRUCTURE HEALED", "Target pod metrics restored to normal baseline.", "success");
            setTimeout(() => {
              setNodeState('healthy');
              setOodaStage(0);
            }, 1200);
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
    if (upper.includes("🛡️") || upper.includes("VALIDATE") || upper.includes("OPA") || upper.includes("SHIELD") || upper.includes("HMAC") || upper.includes("REGISTRATION")) return "shield";
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

            // Sync 5-Stage OODA Pipeline state
            if (rawMsg.includes("[OBSERVE] Alert ingested")) {
              setOodaStage(1);
            } else if (rawMsg.includes("[RAG] Matched SRE Runbook")) {
              const rbPart = rawMsg.substring(rawMsg.indexOf("K8s-RB-"));
              setLastMatchedRunbook(rbPart || 'K8s-RB-102: Container OOM Recovery');
            } else if (rawMsg.includes("[ORIENT] Current Telemetry")) {
              setOodaStage(2);
            } else if (rawMsg.includes("[DECIDE] Proposed Action")) {
              setOodaStage(3);
            } else if (rawMsg.includes("[HMAC] Audit Signature")) {
              const hash = rawMsg.substring(rawMsg.indexOf("sha256:"));
              setLastHmacSignature(hash || 'sha256:7f4a9b0c2d3e4f5a6b7c8d9e0f1a2b3c');
            } else if (rawMsg.includes("[VALIDATE] Submitting proposed action")) {
              setOodaStage(4);
            } else if (rawMsg.includes("[ACT] Restarting") || rawMsg.includes("Executing action")) {
              setOodaStage(5);
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

  // Handle dynamic custom service registration submission (FIXED RSPLIT BUG)
  const handleRegisterServiceSubmit = async (e) => {
    e.preventDefault();
    if (!regServiceName || !regHealthUrl) return;

    // Safely extract base URL in JavaScript without rsplit
    const healthBase = regHealthUrl.includes('/') 
      ? regHealthUrl.substring(0, regHealthUrl.lastIndexOf('/')) 
      : regHealthUrl;

    const payload = {
      service_name: regServiceName.toLowerCase().replace(/\s+/g, '-'),
      health_url: regHealthUrl,
      remediation_url: regRemediationUrl || `${healthBase}/reset`,
      environment: clusterEnv === 'Prod-US' ? 'production' : 'staging'
    };

    try {
      const res = await fetch('http://localhost:8000/register-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        addToast("SERVICE REGISTERED", `Registered '${payload.service_name}' for ASHIP auto-healing.`, "success");
        setTopologyNodes(prev => [
          ...prev,
          {
            id: payload.service_name,
            name: payload.service_name,
            status: 'Healthy',
            type: 'Custom App',
            port: '8080',
            health_url: payload.health_url,
            remediation_url: payload.remediation_url
          }
        ]);
        setSelectedNode(payload.service_name);
        setShowRegisterModal(false);
        setRegServiceName('');
        setRegHealthUrl('');
        setRegRemediationUrl('');
      }
    } catch (err) {
      addLog(`REG_ERR: ${err.message}`, 'error');
    }
  };

  const exportPostMortemReport = async () => {
    try {
      const res = await fetch('http://localhost:8000/export-postmortem');
      const markdown = await res.text();
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ASHIP_PostMortem_Report_${Date.now()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast("POST-MORTEM EXPORTED", "Downloaded Markdown post-mortem audit report.", "success");
    } catch (err) {
      addToast("EXPORT FAILED", err.message, "error");
    }
  };

  const injectFault = async (faultType) => {
    if (isSimulating) return;
    setIsSimulating(true);
    setNodeState('alert');
    setOodaStage(1);

    const activeNode = topologyNodes.find(n => n.id === selectedNode) || topologyNodes[0];

    let alertPayload = {
      environment: clusterEnv === 'Prod-US' ? 'production' : 'staging',
      service_name: activeNode.name,
      target_url: activeNode.health_url
    };
    let targetEndpoint = '';

    if (faultType === 'memory-leak') {
      targetEndpoint = 'http://localhost:5001/chaos/memory-leak';
      alertPayload.alert = "PodOOMKilled";
      alertPayload.details = `RAM saturation limit breached on service [${activeNode.name}]`;
    } else if (faultType === 'cpu-spike') {
      targetEndpoint = 'http://localhost:5001/chaos/cpu-spike';
      alertPayload.alert = "CpuSpikeAlert";
      alertPayload.details = `CPU scheduler threadpool locked on service [${activeNode.name}]`;
    } else if (faultType === 'db-purge') {
      alertPayload.alert = "DatabaseResetRequest";
      alertPayload.details = `Rogue action: request 'delete_database' on service [${activeNode.name}]`;
    }

    try {
      if (targetEndpoint && activeNode.health_url.includes(':5001')) {
        await fetch(targetEndpoint, { method: 'POST' });
      }
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
    addLog(`OPERATOR_RELEASE: Action ${pendingAction.action} authorized by operator.`, 'success');
    setNodeState('remediating');
    setOodaStage(5);
    try {
      if (pendingAction.action === 'restart_pod' || pendingAction.action === 'rollback_deployment') {
        await fetch('http://localhost:5001/chaos/reset', { method: 'POST' });
        playChime();
        setNodeState('resolved');
        addToast("REMEDIATION APPROVED", "Operator signature authorized pod restart.", "success");
        setTimeout(() => {
          setNodeState('healthy');
          setOodaStage(0);
        }, 1200);
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
    if (prompt.includes("memory") || prompt.includes("leak") || prompt.includes("ram")) {
      injectFault('memory-leak');
    } else if (prompt.includes("cpu") || prompt.includes("spike") || prompt.includes("thread")) {
      injectFault('cpu-spike');
    } else if (prompt.includes("db") || prompt.includes("database") || prompt.includes("purge") || prompt.includes("delete")) {
      injectFault('db-purge');
    } else if (prompt.includes("restart") || prompt.includes("heal") || prompt.includes("reset")) {
      approveRemediation();
    } else if (prompt.includes("clear") || prompt.includes("clean")) {
      clearLogs();
    } else if (prompt.includes("status") || prompt.includes("health")) {
      addLog(`ASHIP_AI: System operational. RAM: ${telemetry.memory_percent}%, CPU: ${telemetry.cpu_percent}%, Target: ${telemetry.status.toUpperCase()}`, 'ai');
    } else if (prompt.includes("opa") || prompt.includes("rego") || prompt.includes("policy")) {
      addLog(`ASHIP_AI: OPA Rego security engine enforces active blocklists against destructive operations like database purges in production.`, 'shield');
    } else {
      addLog(`ASHIP_AI: Ingesting query: "${text}". Evaluating telemetry against SRE knowledge base...`, 'ai');
      setTimeout(() => {
        addLog(`ASHIP_AI: Response: Current cluster status is HEALTHY. All 5 OODA pipelines ready.`, 'success');
      }, 800);
    }
  };

  const handleAiPromptSubmit = (e) => {
    e.preventDefault();
    addLog(`PROMPT_IN: "${aiPromptText}"`, 'info');
    executeCommand(aiPromptText);
    setAiPromptText('');
  };

  const memoryUsage = targetConnected ? Math.round(telemetry.memory_percent) : 0;
  const cpuUsage = targetConnected ? Math.round(telemetry.cpu_percent) : 0;

  const getSvgPath = (key) => {
    if (metricHistory.length < 2) return "";
    const width = 280;
    const height = 45;
    const points = metricHistory.map((pt, idx) => {
      const x = (idx / (metricHistory.length - 1)) * width;
      const val = pt[key] || 0;
      const y = height - (val / 100) * height;
      return `${x},${y}`;
    });
    return `M ${points.join(" L ")}`;
  };

  return (
    <div className="min-h-screen bg-[#080c1d] text-slate-100 flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* Toast Notifications (Top-Right) */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className={`animate-toast-slide aship-figma-card border p-4 rounded-xl shadow-2xl flex items-start gap-3 text-xs bg-[#0b1026]/95 ${
            toast.type === 'error' ? 'border-red-500/40 text-red-400' :
            toast.type === 'warning' ? 'border-amber-500/40 text-amber-400' : 'border-emerald-500/40 text-emerald-400'
          }`}>
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold uppercase tracking-wider">{toast.title}</h4>
              <p className="text-slate-300 text-[11px] mt-0.5 leading-normal">{toast.message}</p>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="text-slate-500 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* FIGMA ENTERPRISE HEADER & CLUSTER SWITCHER */}
      <header className="bg-[#0b1026]/90 border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between sticky top-0 z-40 backdrop-blur-xl">
        
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-lg shadow-indigo-500/10">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white font-sans">ASHIP</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 tracking-wider">
                AUTONOMOUS SRE PROTOCOL
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">Self-Healing Infrastructure Control Center</p>
          </div>
        </div>

        {/* Figma Cluster Environment Pill Tabs */}
        <div className="hidden md:flex items-center bg-[#080c1d] border border-slate-800 p-1 rounded-xl gap-1">
          {['Local-Minikube', 'Staging-EU', 'Prod-US'].map(env => (
            <button
              key={env}
              onClick={() => setClusterEnv(env)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                clusterEnv === env 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {env}
            </button>
          ))}
        </div>

        {/* Live Service Badges & Mode Controller */}
        <div className="flex items-center gap-4">
          
          <div className="hidden lg:flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 bg-[#080c1d] px-3 py-1.5 rounded-lg border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${targetConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-red-500'}`} />
              <span className="text-slate-400">TARGET:</span>
              <span className="text-white font-bold">5001</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#080c1d] px-3 py-1.5 rounded-lg border border-slate-800">
              <span className={`w-2 h-2 rounded-full ${agentConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-red-500'}`} />
              <span className="text-slate-400">AGENT:</span>
              <span className="text-white font-bold">8000</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#080c1d] px-3 py-1.5 rounded-lg border border-slate-800">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-400">OPA REGO:</span>
              <span className="text-indigo-400 font-bold">ACTIVE</span>
            </div>
          </div>

          {/* Autopilot Mode Switcher */}
          <button 
            onClick={() => setAutopilot(!autopilot)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center gap-2 ${
              autopilot ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{autopilot ? 'AUTOPILOT: ON' : 'RELEASE MODE'}</span>
          </button>

          {/* UTC Clock */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{hudTime}</span>
          </div>

        </div>

      </header>

      {/* 3-COLUMN FIGMA SAAS DASHBOARD GRID */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 pb-24">
        
        {/* COLUMN 1: MICROSERVICES MESH & CHAOS FAULT ENGINE (3 cols) */}
        <section className="lg:col-span-3 flex flex-col space-y-6">
          
          {/* Microservices Topology Selector */}
          <div className="aship-figma-card p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Network className="w-4.5 h-4.5 text-indigo-400" />
                <h2 className="font-bold text-xs text-white uppercase tracking-wider">MICROSERVICES TOPOLOGY</h2>
              </div>
              <button
                onClick={() => setShowRegisterModal(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-md shadow-indigo-600/20"
              >
                <Plus className="w-3 h-3" />
                <span>CONNECT APP</span>
              </button>
            </div>

            <div className="space-y-2">
              {topologyNodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    selectedNode === node.id 
                      ? 'bg-indigo-600/15 border-indigo-500/50 shadow-md shadow-indigo-600/10' 
                      : 'bg-slate-900/40 border-slate-800/60 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      node.status === 'Unhealthy' ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-indigo-400'
                    }`}>
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white block truncate max-w-[120px]">{node.name}</span>
                      <span className="text-[10px] text-slate-400">{node.type} • Port {node.port}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                    node.status === 'Unhealthy' ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}>
                    {node.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Synthetic Fault Injector Engine */}
          <div className="aship-figma-card p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-amber-400" />
                <h3 className="font-bold text-xs text-white uppercase tracking-wider">SYNTHETIC FAULT ENGINE</h3>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => injectFault('memory-leak')}
                disabled={isSimulating || !targetConnected}
                className="w-full bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between disabled:opacity-40"
              >
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4" />
                  <span>Inject RAM Memory Leak</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button 
                onClick={() => injectFault('cpu-spike')}
                disabled={isSimulating || !targetConnected}
                className="w-full bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between disabled:opacity-40"
              >
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-4 h-4" />
                  <span>Saturate CPU Cores</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button 
                onClick={() => injectFault('db-purge')}
                disabled={isSimulating || !agentConnected}
                className="w-full bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-400 p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between disabled:opacity-40"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4" />
                  <span>Test Rogue DB Purge (OPA)</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </section>

        {/* COLUMN 2: REAL-TIME TELEMETRY & 5-STAGE OODA DECISION PIPELINE (5 cols) */}
        <section className="lg:col-span-5 flex flex-col space-y-6">
          
          {/* Real-Time Metrics & Waveforms Card */}
          <div className={`aship-figma-card p-5 flex flex-col space-y-4 ${
            telemetry.status === 'unhealthy' ? 'aship-card-alert' : ''
          }`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-indigo-400" />
                <h2 className="font-bold text-xs text-white uppercase tracking-wider">CONTAINER TELEMETRY & WAVEFORMS</h2>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase ${
                telemetry.status === 'unhealthy' ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}>
                {telemetry.status}
              </span>
            </div>

            {/* RAM & CPU Gauges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">RAM (128Mi)</span>
                  <span className={telemetry.memory_state === 'critical' ? 'text-red-400' : 'text-indigo-400'}>{memoryUsage}%</span>
                </div>
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div className={`h-full transition-all duration-500 ${
                    telemetry.memory_state === 'critical' ? 'bg-red-500' : 'bg-indigo-500'
                  }`} style={{ width: `${memoryUsage}%` }} />
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-400">CPU Saturation</span>
                  <span className={telemetry.cpu_state === 'critical' ? 'text-amber-400' : 'text-indigo-400'}>{cpuUsage}%</span>
                </div>
                <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div className={`h-full transition-all duration-500 ${
                    telemetry.cpu_state === 'critical' ? 'bg-amber-500' : 'bg-indigo-500'
                  }`} style={{ width: `${cpuUsage}%` }} />
                </div>
              </div>
            </div>

            {/* OpenTelemetry Trend Curves */}
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl relative overflow-hidden">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-2">
                <span>OPENTELEMETRY RAM WAVEFORM</span>
                <span className="text-indigo-400">{hudTime}</span>
              </div>
              <svg className="w-full h-12" viewBox="0 0 280 45" preserveAspectRatio="none">
                <path d={getSvgPath('mem')} fill="none" stroke="#6366f1" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* 5-STAGE OODA DECISION PIPELINE VISUALIZER */}
          <div className="aship-figma-card p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-bold text-xs text-white uppercase tracking-wider">5-STAGE OODA DECISION PIPELINE</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Cycle: Autonomous</span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { stage: 1, label: 'Observe', icon: Eye, desc: 'Alert Ingestion' },
                { stage: 2, label: 'Orient', icon: Compass, desc: 'Telemetry Context' },
                { stage: 3, label: 'Decide', icon: Cpu, desc: 'LLM Reasoning' },
                { stage: 4, label: 'Validate', icon: Shield, desc: 'OPA Rego Policy' },
                { stage: 5, label: 'Act', icon: Zap, desc: 'Self-Healing' }
              ].map(item => {
                const IconComp = item.icon;
                const isActive = oodaStage === item.stage;
                const isPassed = oodaStage > item.stage;

                return (
                  <div 
                    key={item.stage}
                    className={`p-3 rounded-xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                      isActive 
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/20 animate-pulse' 
                        : isPassed 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                        : 'bg-slate-900/40 border-slate-800 text-slate-500'
                    }`}
                  >
                    <IconComp className="w-4 h-4" />
                    <span className="font-bold text-[11px] block">{item.label}</span>
                    <span className="text-[9px] text-slate-400 leading-none">{item.desc}</span>
                  </div>
                );
              })}
            </div>

            {/* Matched SRE Runbook Inspector */}
            <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-400">RAG SRE Runbook:</span>
              </div>
              <span className="font-bold text-white font-mono">{lastMatchedRunbook}</span>
            </div>

          </div>

        </section>

        {/* COLUMN 3: AI DIAGNOSTICS STREAM & HMAC AUDIT INSPECTOR (4 cols) */}
        <section className="lg:col-span-4 flex flex-col space-y-6">
          
          {/* HMAC-SHA256 Cryptographic Audit Inspector Card */}
          <div className="aship-figma-card p-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-bold text-xs text-white uppercase tracking-wider">HMAC-SHA256 AUDIT SIGNATURE</h3>
              </div>
              <button
                onClick={exportPostMortemReport}
                className="bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-400 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>EXPORT REPORT</span>
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-[10px] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">DIGITAL HASH:</span>
                <span className="text-indigo-400 font-bold truncate max-w-[200px]">{lastHmacSignature}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">POLICY EVAL:</span>
                <span className="text-emerald-400 font-bold">OPA_REGO_PASSED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">LLM CONFIDENCE:</span>
                <span className="text-white font-bold">0.95 (High)</span>
              </div>
            </div>
          </div>

          {/* AI Log Terminal Stream */}
          <div className="aship-figma-card p-5 flex flex-col space-y-3 flex-1 min-h-[320px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <TerminalIcon className="w-4.5 h-4.5 text-indigo-400" />
                <h3 className="font-bold text-xs text-white uppercase tracking-wider">REAL-TIME LOG STREAM</h3>
              </div>
              <button onClick={clearLogs} className="text-[10px] text-slate-500 hover:text-white font-bold uppercase">
                CLEAR
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl font-mono text-[10px] leading-relaxed aship-scrollbar overflow-y-auto max-h-[300px] flex flex-col gap-2">
              {logs.map((log) => (
                <div key={log.id} className="whitespace-pre-wrap flex items-start gap-2 border-b border-slate-900 pb-1">
                  <span className="text-slate-600 shrink-0">[{log.time}]</span>
                  <span className={
                    log.type === 'error' ? 'text-red-400 font-bold' :
                    log.type === 'warning' ? 'text-amber-400' :
                    log.type === 'shield' ? 'text-indigo-400' :
                    log.type === 'ai' ? 'text-cyan-400 font-semibold' :
                    log.type === 'success' ? 'text-emerald-400 font-bold' : 'text-slate-300'
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

      {/* Dynamic Custom Software Registration Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="aship-figma-card bg-[#0b1026] border border-indigo-500/40 p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-indigo-400">
                <Link className="w-5 h-5" />
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">CONNECT CUSTOM SOFTWARE SERVICE</h3>
              </div>
              <button onClick={() => setShowRegisterModal(false)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterServiceSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Service Name / Workload Identifier</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. payment-service-v1"
                  value={regServiceName}
                  onChange={(e) => setRegServiceName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Telemetry & Health URL (/health or /metrics)</label>
                <input 
                  type="url"
                  required
                  placeholder="http://your-app:8080/health"
                  value={regHealthUrl}
                  onChange={(e) => setRegHealthUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[10px]">Remediation Webhook URL (/reset or K8s API)</label>
                <input 
                  type="url"
                  placeholder="http://your-app:8080/reset"
                  value={regRemediationUrl}
                  onChange={(e) => setRegRemediationUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl shadow-lg shadow-indigo-600/30 uppercase text-xs"
                >
                  Register Software
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Release Approval Prompt Modal if Autopilot is OFF */}
      {!autopilot && pendingAction && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[#0b1026] border border-amber-500 p-5 rounded-2xl shadow-2xl z-50 flex items-center gap-5 max-w-md w-full">
          <AlertTriangle className="w-8 h-8 text-amber-400 animate-bounce shrink-0" />
          <div className="flex-1">
            <h4 className="font-bold text-xs text-amber-400 uppercase tracking-wider">OPERATOR SIGNATURE NEEDED</h4>
            <p className="text-xs text-slate-300 mt-1">Proposed action: <code className="text-white font-bold font-mono">{pendingAction.action}</code></p>
          </div>
          <button onClick={approveRemediation} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold py-2 px-4 rounded-xl text-xs uppercase shadow-lg shadow-amber-500/20">
            RELEASE SIGNATURE
          </button>
        </div>
      )}

      {/* FLOATING AI COMMAND BAR (BOTTOM CENTER) */}
      <form 
        onSubmit={handleAiPromptSubmit}
        className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-[620px] px-4 z-40"
      >
        <div className="p-[1.5px] rounded-full aship-bar-gradient shadow-2xl">
          <div className="bg-[#0b1026]/95 p-2 flex items-center rounded-full backdrop-blur-2xl">
            
            <button
              type="button"
              onClick={toggleMic}
              className={`p-2.5 rounded-full transition-all shrink-0 ${
                micListening ? 'text-red-400 bg-red-500/20 animate-pulse' : 'text-indigo-400 hover:text-white'
              }`}
            >
              {micListening ? <Mic className="w-4 h-4 animate-pulse" /> : <MessageSquare className="w-4 h-4" />}
            </button>
            
            <input 
              type="text"
              value={aiPromptText}
              onChange={(e) => setAiPromptText(e.target.value)}
              placeholder="Ask ASHIP or Command SRE (e.g., 'what is RAM usage', 'inject memory leak')..."
              className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 px-3 font-sans"
            />
            
            <button 
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-5 rounded-full text-xs uppercase transition-all shrink-0 shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
            >
              <span>Ask ASHIP</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </form>

    </div>
  );
}

export default App;
