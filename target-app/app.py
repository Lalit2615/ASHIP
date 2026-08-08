from flask import Flask, jsonify, request
from flask_cors import CORS
import time

app = Flask(__name__)
# Enable CORS for frontend port 3000 and agent port 8000
CORS(app, resources={r"/*": {"origins": "*"}})

# Global state to simulate telemetry
metrics = {
    "status": "healthy",
    "memory_state": "low",
    "cpu_state": "low",
    "memory_percent": 14.5,
    "cpu_percent": 8.2
}

@app.route('/', methods=['GET'])
def index():
    """Root endpoint for Target App."""
    return jsonify({
        "service": "ASHIP Target Application (Flask)",
        "status": "online",
        "endpoints": {
            "health": "/health",
            "metrics": "/metrics",
            "chaos_memory": "/chaos/memory-leak (POST)",
            "chaos_cpu": "/chaos/cpu-spike (POST)",
            "chaos_reset": "/chaos/reset (POST)"
        },
        "dashboard_ui": "http://localhost:3000"
    }), 200

@app.route('/health', methods=['GET'])
def health():
    """Returns the current simulated health metrics of the target app."""
    if metrics["memory_state"] == "critical" or metrics["cpu_state"] == "critical":
        metrics["status"] = "unhealthy"
    else:
        metrics["status"] = "healthy"
    return jsonify(metrics), 200

@app.route('/metrics', methods=['GET'])
def prometheus_metrics():
    """Exposes OpenTelemetry / Prometheus formatted metrics."""
    memory_bytes = int((metrics["memory_percent"] / 100.0) * 134217728) # 128MB limit
    cpu_cores = metrics["cpu_percent"] / 100.0
    status_code = 1 if metrics["status"] == "healthy" else 0

    output = [
        "# HELP process_resident_memory_bytes Resident memory size in bytes.",
        "# TYPE process_resident_memory_bytes gauge",
        f"process_resident_memory_bytes{{container=\"aship-target-app\"}} {memory_bytes}",
        "# HELP process_cpu_cores_total CPU utilization in cores.",
        "# TYPE process_cpu_cores_total gauge",
        f"process_cpu_cores_total{{container=\"aship-target-app\"}} {cpu_cores:.3f}",
        "# HELP target_app_health_status 1 for healthy, 0 for unhealthy.",
        "# TYPE target_app_health_status gauge",
        f"target_app_health_status{{container=\"aship-target-app\"}} {status_code}"
    ]
    return "\n".join(output), 200, {'Content-Type': 'text/plain; version=0.0.4'}

@app.route('/chaos/memory-leak', methods=['POST'])
def trigger_memory_leak():
    """Simulates a memory leak, driving memory state to critical."""
    metrics["memory_state"] = "critical"
    metrics["memory_percent"] = 98.6
    metrics["status"] = "unhealthy"
    print("WARNING: Memory leak triggered! Memory usage spiked to 98.6%")
    return jsonify({
        "status": "critical",
        "message": "Out of memory simulation initiated.",
        "memory_percent": metrics["memory_percent"]
    }), 200

@app.route('/chaos/cpu-spike', methods=['POST'])
def trigger_cpu_spike():
    """Simulates a CPU spike, driving CPU state to critical."""
    metrics["cpu_state"] = "critical"
    metrics["cpu_percent"] = 95.1
    metrics["status"] = "unhealthy"
    print("WARNING: CPU spike triggered! CPU usage spiked to 95.1%")
    return jsonify({
        "status": "critical",
        "message": "CPU spike simulation initiated.",
        "cpu_percent": metrics["cpu_percent"]
    }), 200

@app.route('/chaos/reset', methods=['POST'])
def reset_metrics():
    """Heals the application, resetting all metrics back to healthy levels."""
    metrics["memory_state"] = "low"
    metrics["cpu_state"] = "low"
    metrics["memory_percent"] = 12.3
    metrics["cpu_percent"] = 7.4
    metrics["status"] = "healthy"
    print("SUCCESS: Infrastructure healed. Metrics reset to normal.")
    return jsonify({
        "status": "healthy",
        "message": "Application healed, metrics reset to default values."
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
