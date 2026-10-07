import { describe, it, expect } from 'vitest'
import { routeGrade } from './route-grades'

const SHIFTS = 'app/controllers/v3/api/plannings/shifts_controller.rb'
const BILLING_ORGS = 'app/controllers/v3/api/billing_automation/organisations_controller.rb'
const BILLING_USERS = 'app/controllers/v3/api/billing_automation/users_controller.rb'
const V3_USERS = 'app/controllers/v3/api/users_controller.rb'
const NOTIFICATIONS = 'app/controllers/notifications_controller.rb'
const SHOPS = 'app/controllers/v3/api/shops_controller.rb'
const LOGIN = 'app/controllers/v3/login_controller.rb'
const REPORTS = 'app/controllers/v3/api/reports_controller.rb'
const REPORT_FILES = 'app/controllers/v3/api/report_files_controller.rb'
const EMPLOYEES = 'app/controllers/v3/api/employees_controller.rb'
const EMPLOYEE_FILES = 'app/controllers/v3/api/employee_files_controller.rb'
const ROOT_COUNTERS = 'app/controllers/paid_leaves_counters_controller.rb'
const V3_COUNTERS = 'app/controllers/v3/api/paid_leaves_counters_controller.rb'

const routes = [
  { path: '/v3/api/plannings/shifts(.:format)', controllerFile: SHIFTS },
  { path: '/v3/api/plannings/shifts/bulk_delete', controllerFile: SHIFTS },
  { path: '/v3/api/plannings/shifts/:id', controllerFile: SHIFTS },
  { path: '/v3/api/billing_automation/organisations/upsert', controllerFile: BILLING_ORGS },
  { path: '/v3/api/billing_automation/organisations/:id/cancel_free_trial', controllerFile: BILLING_ORGS },
  { path: '/v3/api/billing_automation/users', controllerFile: BILLING_USERS },
  { path: '/v3/api/users', controllerFile: V3_USERS },
  { path: '/:page/:id', controllerFile: NOTIFICATIONS },
  { path: '/v3/api/users/:id', controllerFile: V3_USERS },
  { path: '/v3/api/shops/:id', controllerFile: SHOPS },
  { path: '/v3/api/shops', controllerFile: SHOPS },
  { path: '/v3/login', controllerFile: LOGIN },
  { path: '/v3/api/reports/export_custom_integration', controllerFile: REPORTS },
  { path: '/v3/api/reports/:id', controllerFile: REPORT_FILES },
  { path: '/v3/api/employees/payslips_managees', controllerFile: EMPLOYEES },
  { path: '/v3/api/employees/:id', controllerFile: EMPLOYEE_FILES },
  { path: '/paid_leaves_counters', controllerFile: ROOT_COUNTERS },
  { path: '/v3/api/paid_leaves_counters', controllerFile: V3_COUNTERS },
]

const store = "import { ENDPOINT_NAMESPACE } from './api/shift';\nexport const load = () => fetchInChunks(params, `${ENDPOINT_NAMESPACE}`);"
const shiftApi = "export const ENDPOINT_NAMESPACE = '/v3/api/plannings/shifts';"
const repository = "upsert() { return this.put('/organisations/upsert', params) }\ncancel(id) { return this.post(`/organisations/${organisationId}/cancel_free_trial`, {}) }"

describe('routeGrade', () => {
  it('verifies a full path built from an imported constant', () => {
    expect(routeGrade(store, [shiftApi], SHIFTS, routes)).toBe('import')
  })
  it('strips queries and matches parameters only to parameters', () => {
    expect(routeGrade('httpClient.delete(`/v3/api/plannings/shifts/${params.shiftId}?shop_id=${shopId}`)', [], SHIFTS, routes)).toBe('import')
    expect(routeGrade('get(`/x/${id}`)', [], NOTIFICATIONS, routes)).toBeNull()
  })
  it('never full-matches a relative URL', () => {
    expect(routeGrade('get(`users/email_validation?email=${email}`)', [], NOTIFICATIONS, routes)).toBeNull()
    expect(routeGrade("get('v3/api/plannings/shifts')", [], SHIFTS, routes)).toBeNull()
  })
  it('grades a unique route suffix text', () => {
    expect(routeGrade('', [repository], BILLING_ORGS, routes)).toBe('text')
  })
  it('ignores an ambiguous suffix', () => {
    expect(routeGrade("this.post('/users', params)", [], BILLING_USERS, routes)).toBeNull()
  })
  it('never reads an import specifier as a URL', () => {
    expect(routeGrade("import { upsert } from 'organisations/upsert'\nconst api = require('organisations/upsert')", [], BILLING_ORGS, routes)).toBeNull()
  })
  it('never grades a controller the URLs do not reach', () => {
    expect(routeGrade(store, [shiftApi], BILLING_ORGS, routes)).toBeNull()
  })
  it('lets the caller constants win over an imported file', () => {
    const caller = "const BASE = '/v3/api/shops';\nexport const get = id => httpClient.get(`${BASE}/${id}`);"
    const helper = "const BASE = '/v3/api/users';\nexport const noop = () => null;"
    expect(routeGrade(caller, [helper], SHOPS, routes)).toBe('import')
    expect(routeGrade(caller, [helper], V3_USERS, routes)).toBe('text')
  })
  it('caps URLs found only in imported files at text', () => {
    const caller = "import { ALB_ENDPOINTS } from '~/constants';"
    const constants = "export const ALB_ENDPOINTS = ['/v3/login', '/v3/login/refresh_token'];"
    expect(routeGrade(caller, [constants], LOGIN, routes)).toBe('text')
  })
  it('matches a segment mixing text and interpolation only to literal route segments', () => {
    const exporter = "httpClient.post(`/v3/api/reports/export_${integrationType}_integration`, body)"
    expect(routeGrade(exporter, [], REPORTS, routes)).toBe('import')
    expect(routeGrade(exporter, [], REPORT_FILES, routes)).toBeNull()
    const managees = "httpClient.get(`/v3/api/employees/payslips_managees${queryParams}`)"
    expect(routeGrade(managees, [], EMPLOYEES, routes)).toBe('import')
    expect(routeGrade(managees, [], EMPLOYEE_FILES, routes)).toBeNull()
  })
  it('skips the tail check for a URL that already full-matches a route', () => {
    expect(routeGrade("httpClient.get('/paid_leaves_counters')", [], V3_COUNTERS, routes)).toBeNull()
  })
  it('never reads dynamic imports, mocks or spaced requires as URLs', () => {
    const specifiers = "const m = await import('organisations/upsert')\nvi.mock('organisations/upsert')\njest.mock('organisations/upsert')\nconst r = require ('organisations/upsert')\nconst q = require(\n            'organisations/upsert')"
    expect(routeGrade(specifiers, [], BILLING_ORGS, routes)).toBeNull()
  })
  it('reads past escaped quotes', () => {
    expect(routeGrade("toast('can\\'t'); this.put('/organisations/upsert', {})", [], BILLING_ORGS, routes)).toBe('text')
  })
  it('reads a segment made only of interpolations as a parameter', () => {
    expect(routeGrade("router.push(`/${urlId}${shopTurnoverPath}`)", [], ROOT_COUNTERS, routes)).toBeNull()
    expect(routeGrade("httpClient.get(`/v3/api/shops/${id}${query}`)", [], SHOPS, routes)).toBe('import')
  })
  it('verifies through a mixed segment only when one controller owns every match', () => {
    expect(routeGrade("httpClient.get(`/v3/api/${resource}s`)", [], V3_USERS, routes)).toBeNull()
    expect(routeGrade("httpClient.get(`/v3/api/${resource}s`)", [], SHOPS, routes)).toBeNull()
  })
  it('reads URL literals past a template that continues a line, and joins a continued URL', () => {
    expect(routeGrade("const m = `a \\\nb`; fetch('/v3/api/shops/' + id); const n = `x`", [], SHOPS, routes)).toBe('import')
    expect(routeGrade("fetch('/v3/api/\\\nshops')", [], SHOPS, routes)).toBe('import')
  })
})
