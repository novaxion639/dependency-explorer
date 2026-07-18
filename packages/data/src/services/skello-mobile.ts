import { ConnectivityServiceSchema } from '@dependency-explorer/schema'
import type { ConnectivityService } from '@dependency-explorer/schema'

const skello_mobile: ConnectivityService = ConnectivityServiceSchema.parse({
  "name": "skello-mobile",
  "type": "react-native",
  "description": "Employee/manager mobile app (React Native + Expo, Redux Toolkit). Talks to NINE backends: the monolith carries the main surface (v3/api plannings/shifts/leave_requests/counters + legacy api/v1 & api/v2 screens + mobile-only v3/api/mobile config/banners), and eight services are called DIRECTLY via their SDKs — svc-punch (clock in/out, badgedFrom: mobile_app), svc-users (login/org-switch tokens via auth.skello.io + user reads), svc-feature-flags (unauthenticated /features), svc-employees (absence/annualization configs), svc-documents-v2 (documents & payslips, S3 presigned uploads), svc-communications-v2 (push device tokens), svc-requests (preselected manager ONLY), svc-shops (missions). Notable divergence from the web client: leave requests go through the MONOLITH (web goes direct to svc-requests) while clock-ins go DIRECT to svc-punch (web reads badgings through the monolith). Tokens in expo-secure-store (2000-byte chunking); shift windows padded +2 days client-side to catch after-midnight shifts (traced 2026-07-18).",
  "endpoints": []
})

export default skello_mobile
