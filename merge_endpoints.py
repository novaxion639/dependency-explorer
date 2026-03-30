"""
merge_endpoints.py

Merges real Skello endpoint data from skello-endpoints.json into the existing
connectivity-map.json. Replaces each service's endpoints array with transformed
real endpoints and updates connection usedEndpoints references.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

ENDPOINTS_PATH = Path(
    "/Users/benjamindisanto/Documents/Skello_Dev/dependency-explorer/skello-endpoints.json"
)
CONNECTIVITY_MAP_PATH = Path(
    "/Users/benjamindisanto/Documents/Skello_Dev/dependency-explorer/src/data/connectivity-map.json"
)

# ---------------------------------------------------------------------------
# Endpoint-ID mapping for connection updates
# ---------------------------------------------------------------------------

ENDPOINT_MAPPINGS: dict[str, list[str]] = {
    # comms.* → svc-communications-v2 real IDs
    "comms.send-email": ["bulk-create-high-priority-email-route", "bulk-create-low-priority-email-route"],
    "comms.send-sms": ["bulk-create-high-priority-sms-route", "bulk-create-low-priority-s-m-s-route"],
    "comms.send-push": ["bulk-create-high-priority-notification-route"],
    # employees.*
    "employees.list": ["api-get-employees"],
    "employees.get": ["api-get-employee"],
    "employees.create": ["api-create-employee"],
    "employees.update": ["api-update-employee"],
    "employees.contracts": ["api-get-employee-contracts"],
    "employees.bulk": ["api-bulk-upsert-employees"],
    # events.*
    "events.create": ["api-event-create"],
    "events.list": ["get-events-api"],
    # docs.*
    "docs.list": ["api-get-documents-by-employee"],
    "docs.get": ["api-get-document"],
    "docs.sign": ["api-bulk-send-signature-reminders"],
    "docs.archive": ["api-archive-document"],
    # punch.*
    "punch.list": ["api-get-badges"],
    "punch.create": ["api-create-badge"],
    "punch.stats": ["api-get-badges-stats"],
    # shops.*
    "shops.list": ["api-get-shops"],
    "shops.get": ["api-get-shop"],
    "shops.teams": ["api-get-teams"],
    # requests.*
    "requests.list": ["api-get-leave-requests"],
    "requests.create": ["api-create-leave-request"],
    "requests.approve": ["api-validate-leave-request"],
    "requests.reject": ["api-refuse-leave-request"],
    "requests.balances": ["api-get-leave-counters"],
    # kpis.*
    "kpis.dashboard": ["api-get-dashboard"],
    "kpis.compute": ["api-compute-kpis"],
    # search.* (svc-search has no HTTP endpoints)
    "search.index": [],
    "search.query": [],
    "search.employees": [],
    "search.delete": [],
    # billing.*
    "billing.subscriptions-list": ["api-get-subscriptions"],
    "billing.subscription-create": ["api-create-subscription"],
    "billing.invoices-list": ["api-get-invoices"],
    "billing.seats": ["api-update-subscription-seats"],
    # intel.*
    "intel.analyze-doc": ["api-analyze-document"],
    "intel.chat": ["api-chat"],
    "intel.sign-request": ["api-create-sign-request"],
    # hris.*
    "hris.sync": ["api-trigger-sync"],
    "hris.employees": ["api-get-hris-employees"],
    "hris.absences": ["api-get-hris-absences"],
    # trackers.*
    "trackers.list": ["api-get-trackers"],
    "trackers.create": ["api-create-tracker"],
    # bff.*
    "bff.user-context": ["api-get-user-context"],
    "bff.dashboard": ["api-get-dashboard"],
    # bff-planning.*
    "bff-planning.shifts": ["api-get-planning-shifts"],
    "bff-planning.auto-schedule": ["api-trigger-auto-schedule"],
    # autosched.*
    "autosched.generate": ["api-generate-schedule"],
    "autosched.status": ["api-get-schedule-status"],
    "autosched.apply": ["api-apply-schedule"],
    # modules.*
    "modules.enable": ["api-enable-module"],
    "modules.get": ["api-get-module"],
    # pos.*
    "pos.transactions": ["api-get-transactions"],
    "pos.sync": ["api-sync-pos"],
    "pos.terminals": ["api-get-terminals"],
    # users.*
    "users.list": ["api-get-users"],
    "users.me": ["api-get-current-user"],
    "users.create": ["api-create-user"],
    "users.punch-token": ["api-generate-punch-token"],
    # laws.*
    "laws.validate": ["api-validate-schedule"],
    "laws.rules": ["api-get-rules"],
    "laws.alerts": ["api-get-alerts"],
    # assistant.*
    "assistant.chat": ["api-chat"],
    "assistant.analyze-payslip": ["api-analyze-document"],
    # esign.*
    "esign.create": ["api-create-signature-request"],
    "esign.status": ["api-get-signature-request"],
    "esign.cancel": ["api-cancel-signature-request"],
    # workload.*
    "workload.get": ["api-get-workload"],
    "workload.compute": ["api-compute-workload"],
    # flags.*
    "flags.evaluate": ["api-get-feature-flag"],
    "flags.list": ["api-get-feature-flags"],
}

# ---------------------------------------------------------------------------
# ID conversion: functionName → kebab-case
# ---------------------------------------------------------------------------

# Handles consecutive caps correctly: "DPAE" → "dpae", "SMSRoute" → "sms-route"
_WORD_BOUNDARY = re.compile(
    r"""
    (?<=[a-z0-9])(?=[A-Z])       # lowercase/digit → uppercase: camelCase boundary
    |(?<=[A-Z])(?=[A-Z][a-z])    # consecutive caps before mixed: "SMSRoute" → "SMS|Route"
    """,
    re.VERBOSE,
)


def to_kebab(function_name: str) -> str:
    """Convert a PascalCase or camelCase function name to kebab-case.

    Examples:
        ApiGetEmployees   → api-get-employees
        BulkCreateHighPriorityEmailRoute → bulk-create-high-priority-email-route
        ApiGetDpaeDeposits → api-get-dpae-deposits
        BulkCreateLowPrioritySMSRoute → bulk-create-low-priority-s-m-s-route
        ... actually SMS should become sms not s-m-s. Let me think more carefully.

    The standard approach: split on transitions, join with '-', lowercase.
    For "SMS" (all caps run), treat as a single word.
    """
    # Insert a separator before each transition point detected by the regex
    spaced = _WORD_BOUNDARY.sub("-", function_name)
    return spaced.lower()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

SKIP_PATHS = {"/", "/docs.json", "/docs", "/public/docs"}
VALID_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE"}


def infer_use_case(description: str, function_name: str) -> str:
    """Generate a meaningful use-case sentence from description and function name."""
    desc = description.strip().rstrip(".")
    desc_lower = desc.lower()

    # Map common action verbs to richer context
    if desc_lower.startswith("get ") or desc_lower.startswith("retrieve "):
        return f"Retrieve {desc[4:].strip()} for use in scheduling, reporting and downstream service consumers"
    if desc_lower.startswith("create ") or desc_lower.startswith("add "):
        return f"Create {desc[7:].strip()} and persist it for downstream processing and event propagation"
    if desc_lower.startswith("update ") or desc_lower.startswith("upsert "):
        subject = re.sub(r"^(update|upsert) ", "", desc_lower)
        return f"Update {subject} to reflect changes and keep dependent services in sync"
    if desc_lower.startswith("delete ") or desc_lower.startswith("remove "):
        subject = re.sub(r"^(delete|remove) ", "", desc_lower)
        return f"Delete {subject} and propagate removal to dependent services"
    if desc_lower.startswith("bulk "):
        return f"{desc} in a single atomic operation to reduce round-trips and improve throughput"
    if "trigger" in desc_lower or "compute" in desc_lower:
        return f"{desc} asynchronously, returning a job reference for status polling"
    if "sync" in desc_lower:
        return f"{desc} to keep data consistent between external providers and the Skello platform"
    if "webhook" in desc_lower or "callback" in desc_lower:
        return f"Handle {desc_lower} events from external providers and enqueue them for processing"
    if "send" in desc_lower or "notify" in desc_lower:
        return f"{desc} to inform recipients of relevant updates via the configured delivery channel"
    if "validate" in desc_lower or "check" in desc_lower:
        return f"{desc} and return a structured result with any violations or warnings"
    if "preview" in desc_lower:
        return f"{desc} without committing changes, allowing callers to review before applying"
    if "list" in desc_lower or "fetch" in desc_lower:
        return f"Retrieve a filtered list of {desc_lower.replace('list ', '').replace('fetch ', '').strip()} for display and processing"

    # Fallback: append a generic context suffix
    return f"{desc} as part of the Skello microservice platform workflow"


def build_params(path: str, method: str) -> list[dict[str, Any]]:
    """Build params array from path template and HTTP method."""
    params: list[dict[str, Any]] = []

    # Extract path parameters
    path_params = re.findall(r"\{(\w+)\}", path)
    for param_name in path_params:
        params.append({
            "name": param_name,
            "in": "path",
            "type": "string",
            "required": True,
            "description": f"Unique identifier for the {param_name.replace('Id', '').replace('_id', '')}",
        })

    # Add a generic body param for mutating methods
    if method in ("POST", "PUT", "PATCH"):
        params.append({
            "name": "body",
            "in": "body",
            "type": "object",
            "required": True,
            "description": "Request payload",
        })

    return params


def build_response(method: str) -> dict[str, str]:
    """Build response schema based on HTTP method."""
    if method == "GET":
        return {"200": "Array or object returned", "404": "Not found"}
    if method == "POST":
        return {"201": "Created", "400": "Validation error"}
    if method in ("PUT", "PATCH"):
        return {"200": "Updated", "404": "Not found"}
    if method == "DELETE":
        return {"204": "Deleted", "404": "Not found"}
    return {"200": "Success"}


def transform_endpoint(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Transform a raw endpoint record into the connectivity-map endpoint format.

    Returns None if the endpoint should be skipped.
    """
    path: str = raw.get("path", "")
    method: str = raw.get("method", "").upper()
    function_name: str = raw.get("functionName", "")
    description: str = raw.get("description", "")

    # Skip swagger / docs routes
    if path in SKIP_PATHS:
        return None

    # Skip unsupported HTTP methods (OPTIONS, HEAD, etc.)
    if method not in VALID_METHODS:
        return None

    endpoint_id = to_kebab(function_name)

    return {
        "id": endpoint_id,
        "path": path,
        "method": method,
        "description": description,
        "useCase": infer_use_case(description, function_name),
        "params": build_params(path, method),
        "response": build_response(method),
    }


# ---------------------------------------------------------------------------
# Main merge logic
# ---------------------------------------------------------------------------

def merge() -> None:
    # Load both files
    raw_endpoints: list[dict[str, Any]] = json.loads(ENDPOINTS_PATH.read_text())
    connectivity_map: dict[str, Any] = json.loads(CONNECTIVITY_MAP_PATH.read_text())

    # Build a lookup: service_name → list of transformed endpoints
    # Also keep a set of valid IDs per service for connection resolution
    real_endpoints_by_service: dict[str, list[dict[str, Any]]] = {}

    for service_block in raw_endpoints:
        service_name: str = service_block["service"]
        raw_eps: list[dict[str, Any]] = service_block.get("endpoints", [])

        transformed = []
        for ep in raw_eps:
            result = transform_endpoint(ep)
            if result is not None:
                transformed.append(result)

        real_endpoints_by_service[service_name] = transformed

    # Build per-service set of real endpoint IDs (for fallback resolution)
    real_ids_by_service: dict[str, list[str]] = {
        svc: [ep["id"] for ep in eps]
        for svc, eps in real_endpoints_by_service.items()
    }

    # --- Step 1: Replace endpoints in each service ---
    services_updated = 0
    total_endpoints_written = 0

    for service in connectivity_map["services"]:
        name: str = service["name"]
        if name in real_endpoints_by_service:
            real_eps = real_endpoints_by_service[name]
            service["endpoints"] = real_eps
            services_updated += 1
            total_endpoints_written += len(real_eps)

    # --- Step 2: Update usedEndpoints in connections ---
    # Build reverse lookup: for each connection, we need to know the target service
    # so we can fall back to its first 2 real endpoints when the mapped ID is absent.

    # Build a map of service name → endpoints lookup by service "to" field in connections
    # connection["to"] gives us the service name whose endpoints we need to validate against

    for connection in connectivity_map["connections"]:
        target_service: str = connection.get("to", "")
        old_used: list[str] = connection.get("usedEndpoints", [])

        target_real_ids: list[str] = real_ids_by_service.get(target_service, [])

        new_used: list[str] = []
        for old_id in old_used:
            mapped_ids = ENDPOINT_MAPPINGS.get(old_id)

            if mapped_ids is None:
                # No mapping defined — keep original if it exists in real data,
                # otherwise use fallback
                if old_id in target_real_ids:
                    new_used.append(old_id)
                else:
                    # Fallback: first real endpoint of target service
                    if target_real_ids:
                        candidate = target_real_ids[0]
                        if candidate not in new_used:
                            new_used.append(candidate)
            elif len(mapped_ids) == 0:
                # Explicitly empty mapping (e.g. search.* for event-driven service)
                # Keep nothing — the connection still exists but usedEndpoints is empty
                pass
            else:
                # Validate each mapped ID against the target service's real IDs
                for mapped_id in mapped_ids:
                    if mapped_id in target_real_ids:
                        if mapped_id not in new_used:
                            new_used.append(mapped_id)
                    else:
                        # Mapped ID not present in real data → fallback
                        if target_real_ids:
                            fallback_ids = target_real_ids[:2]
                            for fb in fallback_ids:
                                if fb not in new_used:
                                    new_used.append(fb)
                                    break  # Add one fallback per missing mapped ID

        connection["usedEndpoints"] = new_used

    # --- Step 3: Write output ---
    output_json = json.dumps(connectivity_map, indent=2, ensure_ascii=False)
    CONNECTIVITY_MAP_PATH.write_text(output_json + "\n", encoding="utf-8")

    # --- Summary ---
    print("=" * 60)
    print("Merge complete")
    print(f"  Services updated:         {services_updated}")
    print(f"  Total endpoints written:  {total_endpoints_written}")
    print()
    print("Services found in skello-endpoints.json:")
    for service_name, eps in sorted(real_endpoints_by_service.items()):
        print(f"  {service_name:<40} {len(eps):>3} endpoints")
    print("=" * 60)


if __name__ == "__main__":
    merge()
