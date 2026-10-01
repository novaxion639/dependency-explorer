import { describe, it, expect } from 'vitest'
import { parseRoutesContent } from './rails-routes'

const SRC = `
Rails.application.routes.draw do
  root to: 'home#index'
  get '/health', to: 'health#check'
  namespace :v3 do
    namespace :api do
      resources :leave_requests, only: [:index, :create]
      resources :shops, only: [:show] do
        resources :postes, only: [:index]
        member do
          patch :archive
        end
        collection do
          get :search
        end
        get :stats
      end
      namespace :plannings do
        resources :shifts, only: [:create, :update, :destroy]
        patch 'shifts', to: 'shifts#bulk_update'
        post 'shifts/:id/publish' => 'shifts#publish'
      end
      resource :me, only: [:show], controller: 'current_user'
      resource :profile, only: [:show] # singular → plural controller
    end
  end
  scope 'private', module: 'private' do
    post 'requests/shifts', to: 'svc_requests/shifts#create'
  end
  namespace :api, path: 'public', module: 'public_api' do
    resources :users, only: [:index]
  end
  mount Sidekiq::Web => '/sidekiq'
end`

const r = parseRoutesContent(SRC)
const has = (verb: string, path: string, ca: string) =>
  expect(r.routes.map(x => `${x.verb} ${x.path} ${x.controller}#${x.action}`)).toContain(`${verb} ${path} ${ca}`)

describe('parseRoutesContent', () => {
  it('handles root and explicit verbs', () => {
    has('GET', '/', 'home#index')
    has('GET', '/health', 'health#check')
  })
  it('expands resources with only: inside namespaces', () => {
    has('GET', '/v3/api/leave_requests', 'v3/api/leave_requests#index')
    has('POST', '/v3/api/leave_requests', 'v3/api/leave_requests#create')
    expect(r.routes.some(x => x.path === '/v3/api/leave_requests/:id')).toBe(false)
  })
  it('expands update to PATCH and PUT and destroy to DELETE', () => {
    has('PATCH', '/v3/api/plannings/shifts/:id', 'v3/api/plannings/shifts#update')
    has('PUT', '/v3/api/plannings/shifts/:id', 'v3/api/plannings/shifts#update')
    has('DELETE', '/v3/api/plannings/shifts/:id', 'v3/api/plannings/shifts#destroy')
  })
  it('nests resources, member, collection and bare verbs', () => {
    has('GET', '/v3/api/shops/:shop_id/postes', 'v3/api/postes#index')
    has('PATCH', '/v3/api/shops/:id/archive', 'v3/api/shops#archive')
    has('GET', '/v3/api/shops/search', 'v3/api/shops#search')
    has('GET', '/v3/api/shops/:shop_id/stats', 'v3/api/shops#stats')
  })
  it('resolves to: and hash-rocket targets relative to the module', () => {
    has('PATCH', '/v3/api/plannings/shifts', 'v3/api/plannings/shifts#bulk_update')
    has('POST', '/v3/api/plannings/shifts/:id/publish', 'v3/api/plannings/shifts#publish')
  })
  it('handles singular resource with controller:, scope module: and namespace path:/module:', () => {
    has('GET', '/v3/api/me', 'v3/api/current_user#show')
    has('POST', '/private/requests/shifts', 'private/svc_requests/shifts#create')
    has('GET', '/public/users', 'public_api/users#index')
    has('GET', '/v3/api/profile', 'v3/api/profiles#show')
  })
  it('derives the controller file and lists unparsed lines', () => {
    expect(r.routes.find(x => x.controller === 'v3/api/plannings/shifts')?.controllerFile).toBe('app/controllers/v3/api/plannings/shifts_controller.rb')
    expect(r.unparsed).toEqual(["mount Sidekiq::Web => '/sidekiq'"])
  })
})

describe('parseRoutesContent option forms', () => {
  const routes = parseRoutesContent(`
  namespace :v3 do
    resources :things, controller: 'stuff', only: [:index]
    resources :items, only: :show, path: 'goods'
    resources :tasks, only: [] do
      post :assign, on: :collection
      get :config, action: :show_config
      put ':id', action: :replace
    end
  end
  get '/v3/api/shifts' => 'v3/api/v0/shifts#index', via: :get`).routes.map(x => `${x.verb} ${x.path} ${x.controller}#${x.action}`)

  it('reads options in any order', () => {
    expect(routes).toContain('GET /v3/things v3/stuff#index')
    expect(routes).toContain('GET /v3/goods/:id v3/items#show')
  })
  it('routes on: :collection, action: and bare segments inside a resources block', () => {
    expect(routes).toContain('POST /v3/tasks/assign v3/tasks#assign')
    expect(routes).toContain('GET /v3/tasks/:task_id/config v3/tasks#show_config')
    expect(routes).toContain('PUT /v3/tasks/:task_id/:id v3/tasks#replace')
  })
  it('keeps absolute hash-rocket targets', () => {
    expect(routes).toContain('GET /v3/api/shifts v3/api/v0/shifts#index')
  })
})
