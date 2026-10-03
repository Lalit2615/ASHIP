# 🔌 ASHIP Connect App Integration Reference Guide

> This guide provides step-by-step documentation and copy-paste starter templates to integrate any custom software microservice into **ASHIP (Autonomous Self-Healing Infrastructure Protocol)**.

---

## 🎯 Integration Architecture

ASHIP uses a lightweight, non-invasive webhook protocol. To connect your software service to ASHIP, your application only needs to expose **2 standard HTTP endpoints**:

```
  ┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
  │      1. Health & Telemetry      │                 │      2. Remediation Webhook    │
  │     GET /health or /metrics     │                 │       POST /reset or /heal      │
  │  (Polled by ASHIP Observe Stage)│                 │ (Triggered by ASHIP Act Stage)  │
  └─────────────────────────────────┘                 └─────────────────────────────────┘
```

---

## 📑 Webhook API Specifications

### 1. Telemetry Endpoint: `GET /health`
* **Purpose**: Allows ASHIP to continuously monitor container memory, CPU load, and operational status.
* **HTTP Method**: `GET`
* **Expected Response Format** (`JSON 200 OK`):
```json
{
  "status": "healthy",
  "memory_percent": 18.5,
  "cpu_percent": 6.2
}
```

### 2. Remediation Webhook: `POST /reset`
* **Purpose**: Called automatically by ASHIP's AI Agent after an anomaly (e.g. Memory Leak) is detected and approved by OPA Rego policy.
* **HTTP Method**: `POST`
* **Expected Response Format** (`JSON 200 OK`):
```json
{
  "status": "healed",
  "message": "Garbage collection executed. Memory baseline restored."
}
```

---

## 💻 Code Starter Templates

### Option A: Node.js / Express Example
```javascript
const express = require('express');
const app = express();
app.use(express.json());

let memoryLeakBuffer = [];

// 1. Telemetry / Health Endpoint
app.get('/health', (req, res) => {
  const isHighMemory = memoryLeakBuffer.length > 1000;
  res.json({
    status: isHighMemory ? 'unhealthy' : 'healthy',
    memory_percent: isHighMemory ? 92.4 : 15.2,
    cpu_percent: 8.0
  });
});

// 2. Remediation Reset Webhook
app.post('/reset', (req, res) => {
  console.log("🛡️ ASHIP Remediation Signal Ingested: Resetting memory buffer!");
  memoryLeakBuffer = []; // Flush memory leak
  res.json({ status: 'healed', message: 'Memory leak buffer cleared.' });
});

app.listen(8080, () => console.log('Custom App listening on port 8080'));
```

---

### Option B: Python / Flask Example
```python
from flask import Flask, jsonify
import sys

app = Flask(__name__)
cache_store = []

@app.route('/health', methods=['GET'])
def health():
    is_degraded = len(cache_store) > 500
    return jsonify({
        "status": "unhealthy" if is_degraded else "healthy",
        "memory_percent": 96.8 if is_degraded else 14.0,
        "cpu_percent": 12.5
    })

@app.route('/reset', methods=['POST'])
def reset():
    global cache_store
    print("🛡️ ASHIP Remediation Signal Ingested: Resetting cache_store!")
    cache_store = []  # Clear memory leak
    return jsonify({"status": "healed", "message": "Cache memory restored to normal."})

if __name__ == '__main__':
    app.run(port=8080)
```

---

### Option C: Go / Gin Example
```go
package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// 1. Health Endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":         "healthy",
			"memory_percent": 16.5,
			"cpu_percent":    4.2,
		})
	})

	// 2. Remediation Webhook
	r.POST("/reset", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healed",
			"message": "Workload self-healing sequence completed.",
		})
	})

	r.Run(":8080")
}
```

---

## 🖥️ How to Connect via the Dashboard UI

1. Launch the ASHIP Dashboard at **`http://localhost:3000`**.
2. Click **`+ CONNECT APP`** in the top-left **MICROSERVICES TOPOLOGY** panel.
3. Fill in the modal fields:
   * **Service Name**: `payment-gateway-v1`
   * **Telemetry URL**: `http://localhost:8080/health`
   * **Remediation URL**: `http://localhost:8080/reset`
4. Click **`REGISTER SOFTWARE`**.
5. Your app will immediately appear on the **SVG Topology Mesh Canvas**, and ASHIP will start monitoring and auto-healing your app!

---

## 📡 Registration via REST API (Alternative)

You can also register services directly via cURL or HTTP client:

```bash
curl -X POST http://localhost:8000/register-service \
  -H "Content-Type: application/json" \
  -d '{
    "service_name": "inventory-api",
    "health_url": "http://localhost:8080/health",
    "remediation_url": "http://localhost:8080/reset",
    "environment": "production"
  }'
```
