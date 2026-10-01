import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// P2 coverage arc, traced 2026-07-20. The legal staff-register document —
// fully synchronous, generation delegated to svc-documents-v2.
const staff_register_export: ServiceFlow = ServiceFlowSchema.parse({
  "id": "staff-register-export",
  "name": "Staff Register Export",
  "description": "A system admin downloads the legal staff register (registre du personnel). FULLY SYNCHRONOUS — no background job: the controller builds intern/employee Contract scopes (users filtered by user_extended_infos.in_staff_register, shops by the STAFF_REGISTER feature), maps contract columns, and blocks on svc-documents-v2's POST /documents/print (template StaffRegisters, xlsx); the short-lived S3 download URL comes back via the Location redirect header (follow_redirects: false) and the front downloads it. Spanish shops add the RUP column. Payloads over 1MB detour through S3 first under the SVC_DOCUMENTS_V2_PRINT_S3_FALLBACK dev flag. A legacy GenerateDocumentsService path exists in the exporter but the live path is print_in_svc_v2.",
  "trigger": { "actor": "manager", "role": "system_admin + can_download_staff_register" },
  "links": [
    { "to": "payslip-dispatch", "kind": "domain-related", "note": "same svc-documents-v2 generation service, different template and trigger" }
  ],
  "steps": [
    {
      "from": "skello-app-front",
      "to": "skello-app",
      "action": "GET /v3/api/staff_registers (StaffRegisterModal → Toolbar downloadStaffRegister)"
    },
    {
      "from": "skello-app",
      "to": "svc-documents-v2",
      "action": "POST /documents/print (template StaffRegisters, xlsx) — S3 URL returned via Location header"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-sre-modal",
      "service": "skello-app-front",
      "kind": "component",
      "label": "StaffRegisterModal",
      "path": "apps/vue-app/src/users/shared/components/StaffRegisterModal.vue",
      "description": "Confirmation modal — emits download"
    },
    {
      "id": "cu-sre-toolbar",
      "service": "skello-app-front",
      "kind": "component",
      "label": "Toolbar (downloadStaffRegister)",
      "path": "apps/vue-app/src/users/shared/components/Toolbar.vue",
      "description": "GET call + downloadFile(response.data.url); error → toast"
    },
    {
      "id": "cu-sre-controller",
      "service": "skello-app",
      "kind": "controller",
      "label": "V3::Api::StaffRegistersController",
      "path": "app/controllers/v3/api/staff_registers_controller.rb",
      "description": "index only — system_admin + can_download_staff_register; builds intern/employee contract scopes; ES shops add the RUP column"
    },
    {
      "id": "cu-sre-xlsx",
      "service": "skello-app",
      "kind": "service",
      "label": "Microservices::GenerateDocuments::StaffRegistersXlsx",
      "path": "app/services/microservices/generate_documents/staff_registers_xlsx.rb",
      "description": "Maps contracts to headers/values and calls the documents-v2 print — the live path is print_in_svc_v2 (a legacy GenerateDocumentsService #create remains)"
    },
    {
      "id": "cu-sre-docv2",
      "service": "skello-app",
      "kind": "client",
      "label": "Microservices::DocumentsV2Service",
      "path": "app/services/microservices/documents_v2_service.rb",
      "description": "HTTParty client — print returns the S3 URL from the Location redirect; >1MB payloads go via S3 under the fallback flag; X-Source-Client skelloApp:back + API key"
    }
  ],
  "codeEdges": [
    { "from": "cu-sre-modal", "to": "cu-sre-toolbar", "label": "download", "mode": "sync" },
    { "from": "cu-sre-toolbar", "to": "skello-app", "label": "GET /v3/api/staff_registers", "mode": "sync" },
    { "from": "skello-app", "to": "cu-sre-controller", "label": "staff_registers route", "mode": "sync" },
    {
      "from": "cu-sre-controller", "to": "pg-skello-staffregister",
      "label": "contract scopes (in_staff_register users, STAFF_REGISTER shops)",
      "mode": "sync", "crud": ["read"]
    },
    { "from": "cu-sre-controller", "to": "cu-sre-xlsx", "label": "StaffRegistersXlsx.print_in_svc_v2", "mode": "sync" },
    {
      "from": "cu-sre-xlsx", "to": "cu-sre-docv2", "label": "DocumentsV2Service.print",
      "mode": "sync",
      "flags": [{ "name": "SVC_DOCUMENTS_V2_PRINT_S3_FALLBACK", "kind": "dev" }],
      "condition": ">1MB payloads detour via S3 under the fallback flag"
    },
    { "from": "cu-sre-docv2", "to": "svc-documents-v2", "label": "POST /documents/print → Location: S3 URL", "mode": "sync" }
  ],
  "infraNodes": [
    {
      "id": "pg-skello-staffregister",
      "type": "postgresql",
      "label": "skello_production — contracts, user_extended_infos, memberships",
      "description": "Contract scopes the register is built from"
    },
    {
      "id": "s3-staffregister",
      "type": "s3",
      "label": "documents-v2 temporary assets",
      "description": "Generated xlsx behind a short-lived download URL (Location redirect)"
    }
  ],
  "infraEdges": [
    { "from": "skello-app", "to": "pg-skello-staffregister", "label": "contract reads", "crud": ["read"] },
    { "from": "svc-documents-v2", "to": "s3-staffregister", "label": "rendered xlsx", "crud": ["create"] }
  ]
})

export default staff_register_export
