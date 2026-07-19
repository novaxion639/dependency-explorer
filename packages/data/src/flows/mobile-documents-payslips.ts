import { ServiceFlowSchema } from '@dependency-explorer/schema'
import type { ServiceFlow } from '@dependency-explorer/schema'

// Mobile-apps arc, traced 2026-07-18. The read/upload counterpart of the
// payslip-dispatch flow: how employees actually consume documents on the
// phone. svc-documents-v2 is called DIRECTLY, same as the web.
const mobile_documents_payslips: ServiceFlow = ServiceFlowSchema.parse({
  "id": "mobile-documents-payslips",
  "name": "Mobile Documents & Payslips",
  "description": "An employee browses folders (payslips are the pay_slips folder type — same document model as everything else), views, uploads and deletes documents from the phone. All document operations go DIRECT to svc-documents-v2 (same as the web — one of the flows where the two clients AGREE): folder/document reads, downloads via getDownloadUri, uploads as a two-step create-then-presigned-S3-PUT (FileSystem.uploadAsync — the phone writes S3 directly, the service only issues the URL), camera capture feeding the same upload path. The monolith is touched only for creator display names. Attendance-sheet signature reads (svc-documents-v2 signatures) feed the Home screen's pending-signature notifications. Dispatch/analysis of payslips is the payslip-dispatch flow; this is the consumption side.",
  "trigger": {"actor": "employee"},
  "steps": [
    {
      "from": "skello-mobile",
      "to": "svc-documents-v2",
      "action": "Folders + documents CRUD, presigned-URL uploads, downloads, signature reads (SDK direct)"
    },
    {
      "from": "skello-mobile",
      "to": "skello-app",
      "action": "Creator display names (GET /v3/api/users/display_names)"
    }
  ],
  "codeUnits": [
    {
      "id": "cu-mdp-screen",
      "service": "skello-mobile",
      "kind": "component",
      "label": "Documents screen",
      "path": "src/screens/Documents/Documents.tsx",
      "description": "Folder browser (pay_slips among the folder types) with camera upload entry"
    },
    {
      "id": "cu-mdp-folders",
      "service": "skello-mobile",
      "kind": "service",
      "label": "useFolderDocuments hook",
      "path": "src/screens/Documents/useFolderDocuments.ts",
      "description": "Folder-scoped document listing and refresh"
    },
    {
      "id": "cu-mdp-api",
      "service": "skello-mobile",
      "kind": "service",
      "label": "documents api (fetch / upload / download / delete)",
      "path": "src/modules/documents/api.ts",
      "description": "createAndUploadFromUriDocument: create on svc-documents-v2 → PUT the file to the presigned S3 uploadUrl via FileSystem.uploadAsync"
    },
    {
      "id": "cu-mdp-client",
      "service": "skello-mobile",
      "kind": "client",
      "label": "svc-documents-v2 client plugin",
      "path": "src/plugins/clients/SvcDocumentsV2Client/SvcDocumentsV2Client.ts",
      "description": "Document/Folder/Signature repositories from @skelloapp/svc-documents-v2-client, bound to MS_DOCUMENT_V2_BASE_URL"
    }
  ],
  "codeEdges": [
    {
      "from": "cu-mdp-screen",
      "to": "cu-mdp-folders",
      "label": "folder contents",
      "mode": "sync"
    },
    {
      "from": "cu-mdp-folders",
      "to": "cu-mdp-api",
      "label": "document reads",
      "mode": "sync"
    },
    {
      "from": "cu-mdp-api",
      "to": "cu-mdp-client",
      "label": "SDK repositories",
      "mode": "sync"
    },
    {
      "from": "cu-mdp-client",
      "to": "svc-documents-v2",
      "label": "documents / folders / signatures",
      "mode": "sync"
    },
    {
      "from": "cu-mdp-api",
      "to": "s3-docs-v2-mobile",
      "label": "presigned PUT (FileSystem.uploadAsync)",
      "mode": "sync",
      "crud": ["create"]
    }
  ],
  "infraNodes": [
    {
      "id": "s3-docs-v2-mobile",
      "type": "s3",
      "label": "svc-documents-v2.{env} bucket",
      "description": "Upload target — the phone PUTs directly to the presigned URL; the bucket's notification lambda (s3FileListenerJob) picks the object up service-side"
    }
  ],
  "infraEdges": [
    {
      "from": "svc-documents-v2",
      "to": "s3-docs-v2-mobile",
      "label": "issues presigned URLs; listens to bucket notifications",
      "crud": ["read"]
    }
  ]
})

export default mobile_documents_payslips
