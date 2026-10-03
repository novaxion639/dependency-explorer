import { describe, it, expect } from 'vitest'
import { routeGrade } from './route-grades'

const SHIFTS = 'app/controllers/v3/api/plannings/shifts_controller.rb'
const BILLING_ORGS = 'app/controllers/v3/api/billing_automation/organisations_controller.rb'
const BILLING_USERS = 'app/controllers/v3/api/billing_automation/users_controller.rb'
const V3_USERS = 'app/controllers/v3/api/users_controller.rb'
const NOTIFICATIONS = 'app/controllers/notifications_controller.rb'

const routes = [
  { path: '/v3/api/plannings/shifts(.:format)', controllerFile: SHIFTS },
  { path: '/v3/api/plannings/shifts/bulk_delete', controllerFile: SHIFTS },
  { path: '/v3/api/plannings/shifts/:id', controllerFile: SHIFTS },
  { path: '/v3/api/billing_automation/organisations/upsert', controllerFile: BILLING_ORGS },
  { path: '/v3/api/billing_automation/organisations/:id/cancel_free_trial', controllerFile: BILLING_ORGS },
  { path: '/v3/api/billing_automation/users', controllerFile: BILLING_USERS },
  { path: '/v3/api/users', controllerFile: V3_USERS },
  { path: '/:page/:id', controllerFile: NOTIFICATIONS },
]

const store = "export const load = () => fetchInChunks(params, `${ENDPOINT_NAMESPACE}`);"
const shiftApi = "export const ENDPOINT_NAMESPACE = '/v3/api/plannings/shifts';"
const repository = "upsert() { return this.put('/organisations/upsert', params) }\ncancel(id) { return this.post(`/organisations/${organisationId}/cancel_free_trial`, {}) }"

describe('routeGrade', () => {
  it('grades a full path built from an imported constant import', () => {
    expect(routeGrade([store, shiftApi], SHIFTS, routes)).toBe('import')
  })
  it('strips queries and matches parameters only to parameters', () => {
    expect(routeGrade(['httpClient.delete(`/v3/api/plannings/shifts/${params.shiftId}?shop_id=${shopId}`)'], SHIFTS, routes)).toBe('import')
    expect(routeGrade(['get(`/x/${id}`)'], NOTIFICATIONS, routes)).toBeNull()
  })
  it('never full-matches a relative URL', () => {
    expect(routeGrade(['get(`users/email_validation?email=${email}`)'], NOTIFICATIONS, routes)).toBeNull()
  })
  it('grades a unique route suffix text', () => {
    expect(routeGrade([repository], BILLING_ORGS, routes)).toBe('text')
  })
  it('ignores an ambiguous suffix', () => {
    expect(routeGrade(["this.post('/users', params)"], BILLING_USERS, routes)).toBeNull()
  })
  it('never reads an import specifier as a URL', () => {
    expect(routeGrade(["import { upsert } from 'organisations/upsert'\nconst api = require('./api/shift')"], BILLING_ORGS, routes)).toBeNull()
  })
  it('never grades a controller the URLs do not reach', () => {
    expect(routeGrade([store, shiftApi], BILLING_ORGS, routes)).toBeNull()
  })
})
