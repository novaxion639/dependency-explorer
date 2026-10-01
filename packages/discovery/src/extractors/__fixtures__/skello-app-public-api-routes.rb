# fixture @ 3f6728f5eb74bbf211d97530742a1cf99f13b449
# frozen_string_literal: true

# Routes specific to the API domain and public API
Rails.application.routes.draw do
  api_constraints = ['production', 'staging'].include?(ENV['APP_ENV']) ? { subdomain: 'api' } : {}

  # For production and staging - with subdomain constraint
  constraints api_constraints do
    namespace :public do
      scope module: 'kpis' do
        namespace :v1 do
          get 'kpis', to: 'kpis#index'
        end
      end
      scope module: 'onboarding' do
        namespace :v1 do
          post 'organisations', to: 'organisations#create'
          patch 'organisations/:organisation_id', to: 'organisations#update'
          post 'shops', to: 'shops#create'
          patch 'shops/:organisation_id', to: 'shops#update'
          post 'users', to: 'users#create'
          get 'users/:prospect_id/activate', to: 'users#activate'
        end
      end
    end
  end

  constraints subdomain: 'auth' do
    # reroute the v1 to use the v3/login_controller
    match 'v1/refresh_token' => 'v3/login#refresh_token', as: :refresh_token, via: %i[get post]
    post 'v1/login', to: 'v3/login#create'
    post 'v1/jwt_token', to: 'v3/jwt_token#create'
  end
end
