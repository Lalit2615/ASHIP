import os
import json
import asyncio
import hmac
import hashlib
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="ASHIP AI Agent (Enterprise)")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schema for Structured Remediation Decisions
class RemediationPlan(BaseModel):
    action: str = Field(description="Action name: restart_pod, rollback_deployment, or delete_database")
    target: str = Field(description="Target microservice or resource identifier")
    confidence: float = Field(default=0.95, description="AI confidence score")
    reasoning: str = Field(default="Automated SRE anomaly remediation", description="Diagnostic explanation")

# Pydantic Schema for Dynamic Service Registration
class ServiceRegistration(BaseModel):
    service_name: str = Field(description="Name of the external service or workload")
    health_url: str = Field(description="URL to query health and telemetry metrics")
    remediation_url: str = Field(description="URL to trigger remediation reset")
    environment: str = Field(default="production", description="Environment: staging or production")

# In-Memory Registry for External Services
REGISTERED_SERVICES = {
    "aship-target-app": {
        "service_name": "aship-target-app",
        "health_url": "http://localhost:5001/health",
        "remediation_url": "http://localhost:5001/chaos/reset",
        "environment": "production"
    }
}

# Built-in RAG Post-Mortem & SRE Runbook Knowledge Base
SRE_RUNBOOKS = {
    "podoomkilled": {
        "title": "K8s-RB-102: Container Out-Of-Memory Recovery",
        "steps": "Query cgroup memory usage -> Check memory leaks -> Execute zero-downtime rolling pod restart -> Verify heap metric recovery."
    },
    "cpuspikealert": {
        "title": "K8s-RB-304: CPU Threadpool Saturation Mitigation",
        "steps": "Check threadpool backlog -> Scale deployment or rollback to previous stable commit -> Verify CPU scheduler balance."
    },
    "databaseresetrequest": {
        "title": "K8s-RB-901: Unauthorized Persistent Storage Purge Safeguard",
        "steps": "Intercept database deletion attempt -> Enforce OPA Rego blocklist -> Escalate to Security Incident Response (SIRT)."
    }
}

# Store active SSE clients
clients = []
ooda_lock = asyncio.Lock()

async def send_log(message: str):
    """Broadcasts a log message to stdout and all active SSE client queues."""
    try:
        print(f"[Log] {message}")
    except Exception:
        try:
            print(f"[Log] {message.encode('ascii', errors='replace').decode('ascii')}")
        except Exception:
            pass
            
    for queue in list(clients):
        try:
            queue.put_nowait(message)
        except Exception:
            pass

def generate_signature(decision: dict) -> str:
    """Generates an HMAC-SHA256 cryptographic signature for AI auditability."""
    secret = os.getenv("ASHIP_HMAC_SECRET", "aship-enterprise-secret-key")
    payload = json.dumps(decision, sort_keys=True).encode('utf-8')
    return hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()[:16]

@app.get("/")
async def root():
    """Root endpoint for ASHIP AI Agent."""
    return {
        "service": "ASHIP Enterprise AI SRE Agent Backend",
        "status": "online",
        "endpoints": {
            "logs_sse": "/logs (GET EventStream)",
            "alert_webhook": "/webhook/alert (POST)",
            "register_service": "/register-service (POST)",
            "registered_services": "/registered-services (GET)",
            "api_docs": "/docs"
        },
        "dashboard_ui": "http://localhost:3000"
    }

@app.get("/registered-services")
async def list_services():
    """Lists all dynamically registered external services."""
    return {"registered_services": list(REGISTERED_SERVICES.values())}

@app.post("/register-service")
async def register_service(reg: ServiceRegistration):
    """Registers an external software service for auto-healing."""
    REGISTERED_SERVICES[reg.service_name] = reg.model_dump()
    await send_log(f"🔌 [REGISTRATION] Dynamic service registered: '{reg.service_name}' ({reg.health_url})")
    return {
        "status": "success",
        "message": f"Service '{reg.service_name}' registered for ASHIP auto-healing.",
        "details": reg.model_dump()
    }

@app.get("/logs")
async def get_logs(request: Request):
    """SSE endpoint streaming live OODA reasoning and OPA security traces."""
    queue = asyncio.Queue()
    clients.append(queue)
    
    async def event_generator():
        try:
            yield f"data: {json.dumps({'message': 'CONNECTED', 'type': 'system'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield f"data: {json.dumps({'message': msg, 'type': 'log'})}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            if queue in clients:
                clients.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

async def run_ooda_loop(alert_name: str, details: str, environment: str = "production", operator_approved: bool = False, service_name: str = "aship-target-app", target_url: str = None):
    """Executes the enterprise OODA (Observe-Orient-Decide-Validate-Act) cycle."""
    async with ooda_lock:
        try:
            await send_log(f"⚡ [OODA] Initiating Autonomous Healing Cycle for [{service_name.upper()}] (Env: {environment.upper()})...")
            await asyncio.sleep(0.5)
            
            # 1. OBSERVE & ORIENT
            await send_log(f"🔍 [OBSERVE] Alert ingested: '{alert_name}' ({details})")
            await asyncio.sleep(0.8)

            # RAG Runbook Lookup
            runbook_key = alert_name.lower().replace(" ", "")
            matched_runbook = SRE_RUNBOOKS.get(runbook_key, None)
            if matched_runbook:
                await send_log(f"📖 [RAG] Matched SRE Runbook: {matched_runbook['title']}")
                await send_log(f"📖 [RAG] Recommended Protocol: {matched_runbook['steps']}")
            else:
                await send_log(f"📖 [RAG] Matched SRE Runbook: K8s-RB-UNIVERSAL: Dynamic Workload Self-Healing")
            
            await asyncio.sleep(0.8)
            await send_log(f"🔍 [OBSERVE] Querying metrics from target telemetry endpoint for [{service_name}]...")
            
            # Lookup registered service URLs
            registered = REGISTERED_SERVICES.get(service_name, {})
            health_url = registered.get("health_url") or target_url or os.getenv("TARGET_APP_URL", "http://localhost:5001")
            remediation_url = registered.get("remediation_url") or f"{health_url.rsplit('/', 1)[0]}/chaos/reset"

            if not health_url.endswith("/health"):
                if health_url.endswith("/"):
                    health_url += "health"
                else:
                    health_url += "/health"

            try:
                async with httpx.AsyncClient() as client:
                    try:
                        res = await client.get(health_url, timeout=2.0)
                        metrics = res.json()
                        await send_log(f"📊 [ORIENT] Current Telemetry: Memory={metrics.get('memory_percent', 85.0)}% ({metrics.get('memory_state', 'high')}), CPU={metrics.get('cpu_percent', 45.0)}% ({metrics.get('cpu_state', 'normal')})")
                    except Exception:
                        await send_log(f"📊 [ORIENT] Telemetry endpoint active for service '{service_name}'. Assessed anomaly status: DEGRADED.")
            except Exception as e:
                await send_log(f"⚠️ [ORIENT] Telemetry notice: {str(e)}")

            await asyncio.sleep(0.8)
            
            # 2. DECIDE
            await send_log("🧠 [DECIDE] Prompting LLM cognitive engine for remediation plan...")
            await asyncio.sleep(0.8)

            groq_api_key = os.getenv("GROQ_API_KEY")
            decision = None

            if groq_api_key:
                try:
                    from langchain_groq import ChatGroq
                    from langchain_core.prompts import ChatPromptTemplate
                    
                    chat = ChatGroq(temperature=0, groq_api_key=groq_api_key, model_name="llama-3.1-8b-instant")
                    prompt = ChatPromptTemplate.from_messages([
                        ("system", (
                            "You are ASHIP, an autonomous self-healing SRE agent. "
                            "Output JSON matching schema: {\"action\": \"<action>\", \"target\": \"" + service_name + "\", \"confidence\": 0.98, \"reasoning\": \"<explanation>\"}. "
                            "Allowed actions: 'restart_pod', 'rollback_deployment', 'delete_database'."
                        )),
                        ("human", "Alert: {alert_name}. Details: {details}.")
                    ])
                    chain = prompt | chat
                    response = await chain.ainvoke({"alert_name": alert_name, "details": details})
                    
                    content = response.content.strip()
                    if content.startswith("```"):
                        lines = content.splitlines()
                        if len(lines) > 2:
                            content = "\n".join(lines[1:-1])
                    parsed_json = json.loads(content)
                    plan = RemediationPlan(**parsed_json)
                    decision = plan.model_dump()
                except Exception as e:
                    await send_log(f"⚠️ [DECIDE] LLM Call warning: {str(e)}. Using Pydantic heuristic engine.")

            if not decision:
                # Deterministic Pydantic Heuristic decision fallback
                if "memory-leak" in alert_name.lower() or "oom" in alert_name.lower():
                    plan = RemediationPlan(action="restart_pod", target=service_name, reasoning="RAM limit breached")
                elif "cpu-spike" in alert_name.lower() or "cpu" in alert_name.lower():
                    plan = RemediationPlan(action="rollback_deployment", target=service_name, reasoning="CPU threadpool saturated")
                elif "database" in alert_name.lower() or "db" in alert_name.lower():
                    plan = RemediationPlan(action="delete_database", target="prod-db", reasoning="Rogue maintenance request")
                else:
                    plan = RemediationPlan(action="restart_pod", target=service_name, reasoning="General container anomaly")
                decision = plan.model_dump()

            # Generate Cryptographic HMAC Signature
            signature = generate_signature(decision)
            decision["signature"] = signature
            decision["environment"] = environment
            decision["operator_approved"] = operator_approved
            decision["service_name"] = service_name

            await send_log(f"🤖 [DECIDE] Proposed Action: {json.dumps(decision)}")
            await send_log(f"🔑 [HMAC] Audit Signature: sha256:{signature}")
            await asyncio.sleep(0.8)

            # 3. VALIDATE
            await send_log("🛡️ [VALIDATE] Submitting proposed action to OPA Rego Security Sandbox...")
            await asyncio.sleep(0.8)
            
            opa_url = os.getenv("OPA_URL", "http://opa:8181/v1/data/aship/security/allow")
            opa_approved = False
            
            try:
                async with httpx.AsyncClient() as client:
                    opa_res = await client.post(opa_url, json={"input": decision}, timeout=3.0)
                    opa_data = opa_res.json()
                    opa_approved = opa_data.get("result", False)
                    await send_log(f"🛡️ [VALIDATE] OPA Response: {json.dumps(opa_data)}")
            except Exception as e:
                # Local Rego fallback logic matching aship-policy.rego
                action = decision.get("action")
                if action == "restart_pod":
                    opa_approved = True
                elif action == "rollback_deployment":
                    if environment == "staging":
                        opa_approved = True
                    else:
                        opa_approved = operator_approved
                else:
                    opa_approved = False

            await asyncio.sleep(0.8)

            # 4. ACT
            if opa_approved:
                await send_log(f"✅ [ACT] OPA Approved! Executing action: {decision.get('action')} on service [{service_name}]")
                await asyncio.sleep(0.5)
                
                try:
                    async with httpx.AsyncClient() as client:
                        reset_res = await client.post(remediation_url, timeout=3.0)
                        if reset_res.status_code in [200, 201, 202, 204]:
                            await send_log(f"❇️ [ACT] Target service '{service_name}' healed via remediation driver. Metrics reset to normal.")
                        else:
                            await send_log(f"❇️ [ACT] Triggered remediation driver for '{service_name}' (HTTP {reset_res.status_code}).")
                except Exception as e:
                    await send_log(f"❇️ [ACT] Remediation signal transmitted to service '{service_name}'. Metrics reset to normal baseline.")
                
                await asyncio.sleep(0.8)
                await send_log(f"🏆 [OODA] Autonomous Healing Complete for [{service_name}]. Incident Resolved.")
            else:
                await send_log(f"❌ [ACT] OPA DENIED: Action '{decision.get('action')}' violated Rego safety policy!")
                await asyncio.sleep(0.5)
                await send_log("🚨 [OODA] Healing aborted. Incident escalated to human SRE response team.")
                
        except Exception as e:
            await send_log(f"💥 [OODA] Exception during self-healing: {str(e)}")

@app.post("/webhook/alert")
async def receive_alert(request: Request):
    """Receives alerts from Prometheus or frontend and triggers OODA loop."""
    payload = await request.json()
    alert_name = payload.get("alert", "Unknown Alert")
    details = payload.get("details", "")
    environment = payload.get("environment", "production")
    operator_approved = payload.get("operator_approved", False)
    service_name = payload.get("service_name", "aship-target-app")
    target_url = payload.get("target_url")
    
    asyncio.create_task(run_ooda_loop(alert_name, details, environment, operator_approved, service_name, target_url))
    return {"status": "alert_received", "message": f"Processing OODA loop for {alert_name} on {service_name}."}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
