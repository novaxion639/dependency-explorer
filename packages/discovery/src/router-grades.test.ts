import { describe, it, expect } from 'vitest'
import { parseVueRoutes, routerGrade } from './router-grades'

const files: Record<string, string> = {
  'src/admin/AdminOnboarding.vue': '<template/>',
  'src/plan/Plannings.vue': '<template/>',
  'src/plan/Weeks.vue': '<template/>',
  'src/plan/Days.vue': '<template/>',
  'src/users/History/index.vue': '<template/>',
}
const read = (p: string) => files[p] ?? null

describe('parseVueRoutes', () => {
  it('maps each literal route name to its own component, children included', () => {
    const source = [
      "import AdminOnboarding from '../admin/AdminOnboarding';",
      "import Plannings from '../plan/Plannings.vue';",
      "import Weeks from '../plan/Weeks.vue';",
      'export default [',
      "  { path: '/admin', component: AdminOnboarding, name: 'admin_onboarding' },",
      "  { path: '/plannings', name: 'plannings', component: Plannings, children: [",
      "    { path: 'weeks', component: Weeks, name: 'plannings_weeks' },",
      "    { path: 'days', component: () => import('../plan/Days.vue'), name: 'plannings_days' },",
      '  ] },',
      "  { path: '/x', component: Weeks, name: ROUTER_ROUTE_NAMES.X },",
      ']',
    ].join('\n')
    expect(parseVueRoutes(source, 'src/routes/app_routes.js', [], read)).toEqual([
      { name: 'admin_onboarding', componentFile: 'src/admin/AdminOnboarding.vue' },
      { name: 'plannings', componentFile: 'src/plan/Plannings.vue' },
      { name: 'plannings_weeks', componentFile: 'src/plan/Weeks.vue' },
      { name: 'plannings_days', componentFile: 'src/plan/Days.vue' },
    ])
  })
})

describe('parseVueRoutes edge forms', () => {
  it('resolves a directory component to its index.vue', () => {
    const source = "import History from '../users/History';\nexport default [{ path: '/h', component: History, name: 'history' }]"
    expect(parseVueRoutes(source, 'src/routes/users_routes.js', [], read)).toEqual([{ name: 'history', componentFile: 'src/users/History/index.vue' }])
  })
  it('ignores commented-out names and records', () => {
    const source = [
      "import Weeks from '../plan/Weeks.vue';",
      'export default [',
      "  // { path: '/dead', component: Weeks, name: 'dead' },",
      "  { path: '/w', component: Weeks,",
      "    // name: 'old',",
      "    name: 'live' },",
      ']',
    ].join('\n')
    expect(parseVueRoutes(source, 'src/routes/app_routes.js', [], read)).toEqual([{ name: 'live', componentFile: 'src/plan/Weeks.vue' }])
  })
  it('reads a parent name written after its children', () => {
    const source = [
      "import Plannings from '../plan/Plannings.vue';",
      "import Weeks from '../plan/Weeks.vue';",
      "export default [{ path: '/p', component: Plannings, children: [{ path: 'w', component: Weeks, name: 'weeks' }], name: 'plannings' }]",
    ].join('\n')
    expect(parseVueRoutes(source, 'src/routes/app_routes.js', [], read)).toEqual([
      { name: 'plannings', componentFile: 'src/plan/Plannings.vue' },
      { name: 'weeks', componentFile: 'src/plan/Weeks.vue' },
    ])
  })
})

describe('routerGrade', () => {
  const routes = [
    { name: 'admin_onboarding', componentFile: 'src/admin/AdminOnboarding.vue' },
    { name: 'onboarding_alias', componentFile: 'src/admin/AdminOnboarding.vue' },
  ]
  const push = "redirect(n) { this.$router.push({ name: n }) }\nthis.redirect('admin_onboarding')"

  it('verifies a route name the navigating caller writes', () => {
    expect(routerGrade(push, [], 'src/admin/AdminOnboarding.vue', routes)).toBe('import')
    expect(routerGrade("<router-link :to=\"{ name: 'onboarding_alias' }\">", [], 'src/admin/AdminOnboarding.vue', routes)).toBe('import')
  })
  it('never verifies a name the caller only compares', () => {
    expect(routerGrade("if (this.$route.name === 'admin_onboarding') {}", [], 'src/admin/AdminOnboarding.vue', routes)).toBeNull()
  })
  it('never reads a Vuex namespace or a route-name comparison as a navigation target', () => {
    const vuex = "computed: { ...mapState('admin_onboarding', ['x']) }, methods: { go() { this.$router.push({ name: 'home' }) } }"
    expect(routerGrade(vuex, [], 'src/admin/AdminOnboarding.vue', routes)).toBeNull()
    const compare = "if (this.$route.name === 'admin_onboarding') { this.$router.push({ name: 'home' }) }"
    expect(routerGrade(compare, [], 'src/admin/AdminOnboarding.vue', routes)).toBeNull()
  })
  it('caps a name found only in an imported file at text', () => {
    expect(routerGrade('this.$router.push({ name: NAMES.ADMIN })', ["export const NAMES = { ADMIN: 'admin_onboarding' }"], 'src/admin/AdminOnboarding.vue', routes)).toBe('text')
  })
  it('never grades a component no route names', () => {
    expect(routerGrade(push, [], 'src/plan/Weeks.vue', routes)).toBeNull()
  })
})
