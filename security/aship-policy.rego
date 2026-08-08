package aship.security

# By default, block everything the AI suggests
default allow = false

# Rule 1: The AI is ALLOWED to restart pods in any environment
allow {
    input.action == "restart_pod"
    not deny
}

# Rule 2: Rollback deployment is allowed in staging automatically, but requires operator approval in production
allow {
    input.action == "rollback_deployment"
    input.environment == "staging"
    not deny
}

allow {
    input.action == "rollback_deployment"
    input.environment == "production"
    input.operator_approved == true
    not deny
}

# ❌ Unsafe actions: NEVER allow database purges or persistent volume claim deletions
deny {
    input.action == "delete_database"
}

deny {
    input.action == "delete_pvc"
}
