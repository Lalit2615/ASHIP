# 🛡️ ASHIP — Autonomous Self-Healing Infrastructure Protocol

![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge&logo=docker)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi)
![LangChain](https://img.shields.io/badge/LangChain-Llama_3.1-1C3C3C?style=for-the-badge)
![OPA](https://img.shields.io/badge/OPA-Policy_as_Code-000000?style=for-the-badge&logo=openpolicyagent)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

> An autonomous, AI-driven Site Reliability Engineering (SRE) platform that detects infrastructure anomalies, diagnoses root causes using **Llama 3.1**, validates recovery plans against **Open Policy Agent (OPA)** safety guardrails, and executes self-healing remediation in real time.

---

## 📸 Mission Control Dashboard

ASHIP features a full-screen **NASA War Room Mission Control Dashboard** built with React, Tailwind CSS, and JetBrains Mono typography:

* **Interactive SVG Node Topology Canvas**: Visualizes microservices mesh with animated flowing data streams (`ooda-flow-dash`).
* **Real-Time Telemetry & Dual Waveforms**: Plots RAM allocation (`128Mi` limit) and CPU core saturation.
* **Hands-Free Voice Recognition**: Web Speech API integration for natural language SRE commands (`"inject memory leak"`, `"restart container"`).
* **Live SSE Diagnostics Terminal**: Streams real-time AI reasoning logs directly from FastAPI (`http://localhost:8000/logs`).

---

## 🏗️ Monorepo Architecture

```
/aship-workspace
├── /frontend                 # Mission Control Dashboard (React 18, Vite, Tailwind CSS)
│   ├── /src
│   │   ├── App.jsx           # NASA War Room Dashboard & SVG Topology Canvas
│   │   └── index.css         # Glassmorphism, CRT scanline overlay, glow effects
│   └── index.html
│
├── /ai-agent                 # FastAPI LLM Orchestrator
│   ├── main.py               # OODA Loop Engine, LangChain ChatGroq, Pydantic, HMAC-SHA256
│   ├── requirements.txt
│   └── .env
│
├── /target-app               # Flask Application with Chaos Endpoints
│   ├── app.py                # Telemetry, OpenTelemetry /metrics, /chaos/memory-leak, /chaos/cpu-spike
│   └── requirements.txt
│
├── /security                 # Policy-as-Code Engine
│   └── aship-policy.rego     # OPA Rego rules for staging vs production environments
│
└── docker-compose.yml        # Multi-container orchestration
```

---

## ⚡ Key Capabilities

### 1. 🔄 Closed-Loop OODA Self-Healing Cycle
* **Observe**: Ingests Prometheus alerts and matches SRE runbooks (`K8s-RB-102`, `K8s-RB-304`, `K8s-RB-901`).
* **Orient**: Queries live container metrics from `/health` and `/metrics`.
* **Decide**: Prompts Llama 3.1 via LangChain with Pydantic schema validation (`RemediationPlan`) and generates an HMAC-SHA256 audit signature.
* **Validate**: Submits decision to Open Policy Agent (OPA) to ensure safety compliance.
* **Act**: Executes container reset (`/chaos/reset`) if approved; halts execution and alerts human SREs if denied.

### 2. 🛡️ Policy-as-Code Safety Guardrails (OPA / Rego)
* **Allowed Actions**: `restart_pod`, `rollback_deployment`
* **Denied Actions**: `delete_database`, `delete_pvc` (Intercepted by OPA to prevent rogue AI actions)

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
* [Docker & Docker Compose](https://docs.docker.com/get-docker/) installed.
* Python 3.10+ (for local development outside Docker).

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/aship-workspace.git
cd aship-workspace
```

### 2. Configure Environment Variables
Create `.env` inside `/ai-agent`:
```bash
cat << 'EOF' > ai-agent/.env
GROQ_API_KEY=your_groq_api_key_here
ASHIP_HMAC_SECRET=aship-enterprise-secret-key-2026
TARGET_APP_URL=http://localhost:5001
OPA_URL=http://localhost:8181/v1/data/aship/security/allow
EOF
```

### 3. Launch Services with Docker Compose
```bash
docker compose up -d --build
```

---

## ⚙️ Service Endpoints & Ports

| Service | Port | Endpoint | Description |
|---|---|---|---|
| **Mission Control Dashboard** | `3000` | `http://localhost:3000` | React Web UI |
| **AI Agent Backend** | `8000` | `http://localhost:8000/logs`<br>`http://localhost:8000/webhook/alert` | FastAPI SSE Stream & Alert Webhook |
| **Target Application** | `5001` | `http://localhost:5001/health`<br>`http://localhost:5001/metrics` | Flask Telemetry & Chaos Triggers |
| **OPA Security Sandbox** | `8181` | `http://localhost:8181/v1/data/aship/security/allow` | Rego Safety Policy Engine |

---

## 🧪 Testing Self-Healing Scenarios

### Scenario A: Out-Of-Memory (OOM) Memory Leak Recovery
1. Open the dashboard at `http://localhost:3000`.
2. Click **Inject RAM Memory Leak** (or type `"inject memory leak"` in the command bar).
3. **Result**: Target RAM spikes to **98.6%**. The OODA loop observes the alert, prompts Llama 3.1, verifies `restart_pod` with OPA, and heals the pod back to **12.3% RAM**.

### Scenario B: Rogue Database Purge Interception (OPA Block)
1. Click **Test Rogue DB Purge (OPA Block)** in the dashboard.
2. **Result**: The AI proposes `delete_database`. OPA evaluates `aship-policy.rego`, returns `allow: false`, aborts execution, and triggers a critical red alert ring animation with escalation to human SREs.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for details.
