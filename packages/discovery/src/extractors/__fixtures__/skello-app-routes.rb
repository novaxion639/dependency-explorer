# fixture @ 3f6728f5eb74bbf211d97530742a1cf99f13b449
# frozen_string_literal: true

# rubocop:disable Layout/LineLength

# Include additional route files in the config/routes folder
Dir.glob(Rails.root.join('config/routes/**/*_routes.rb')).each(&method(:load))

Rails.application.routes.draw do
  mount ActionCable.server => '/cable'
  mount StripeEvent::Engine, at: '/stripe-events'

  get '/health', to: 'health#app_health'
  get '/health-ec2', to: 'health#server_health'

  root to: 'v3/pages#home'

  # Enable swagger for local and staging
  mount Rswag::Ui::Engine => '/public/v1/docs'
  mount Rswag::Api::Engine => '/public/v1/docs'

  namespace :unemployment_report do
    post 'shops/:shop_id' => 'reports#single_shop', as: :single_shop_export
    post 'shops' => 'reports#multiple_shops', as: :multiple_shops_export
  end

  # USERS & DEVISE
  # Devise owns no route any more: sign-in, sign-out and password reset are served by
  # svc-users, and the login/password pages are rendered client side by the SPA through
  # the /users/*page catch-all below. `skip: :all` keeps the :user mapping - which
  # current_user, authenticate_user! and the Warden :user scope all need - without
  # generating a single Devise route.
  devise_for :users, skip: :all

  # specific redirection for the mobile
  get '/v3/api/shifts' => 'v3/api/v0/shifts#index', via: :get
  patch '/v3/api/shifts/:shift_id/comments/_append' => 'v3/api/v1/comments#_append', via: :patch
  post '/v3/api/shifts/:shift_id/tasks/' => 'v3/api/v1/tasks#create', via: :post
  patch '/v3/api/shifts/:shift_id/tasks/:id/_status' => 'v3/api/v1/tasks#_status', via: :patch
  patch '/v3/api/shifts/:shift_id/tasks/:id/_label' => 'v3/api/v1/tasks#_label', via: :patch

  namespace :saas do
    namespace :api do
      resource :planning_hours_datas, only: %i[show update]
      resource :day_rates_counters, only: %i[show update]
      resource :rcr_counters, only: %i[show update]
      resources :shops, only: :edit
    end
  end

  resources :day_plannings, only: [] do
    get '/pdf' => 'day_plannings#pdf', as: :pdf
  end

  resources :week_plannings, only: [] do
    get '/pdf' => 'week_plannings#pdf', as: :pdf
    resources :attendance_sheets, only: :index
  end

  resources :poste_plannings, only: [] do
    get '/pdf' => 'poste_plannings#pdf', as: :pdf
  end

  resources :month_plannings, only: [] do
    get '/pdf' => 'month_plannings#pdf', as: :pdf
  end

  namespace :plannings do
    resources :month_totals, only: [:index]
  end

  # OTHER MANAGER PATHS
  resources :report_comments, only: %i[create update]

  scope 'shops/:shop_id' do
    resources :users, only: %i[index show new]
  end

  resources :shops, only: [] do
    patch '/export_options', to: 'shops#export_options', as: :export_options
    resources :users_history, only: [] do
      get '/print' => 'users_history#print', as: :print
    end

    resources :users, only: %i[update create new]

    resources :managers, only: %i[index]
  end

  namespace :users do
    resources :availabilities, only: [:index]
  end

  resource :labor_cost, only: %i[show update]

  get 'unfinished_profiles' => 'notifications#get_unfinished_profiles'
  get 'employees_over_hours' => 'notifications#get_employees_over_hours'
  get 'infos_absences_chart' => 'notifications#infos_absences_chart'
  get 'infos_productivity_chart' => 'notifications#infos_productivity_chart'
  get '/:id/shops_turnover' => 'notifications#get_turnovers', as: :get_turnovers
  get '/get_trials_ending' => 'notifications#get_trials_ending', as: :get_trials_ending
  get '/get_docs_ending' => 'notifications#get_docs_ending', as: :get_docs_ending
  get '/get_users_arrived_archived' => 'notifications#get_users_arrived_archived', as: :get_users_arrived_archived

  resource :paid_leaves_counters, only: %i[show update]

  resources :primes, only: :create do
  end

  # EMPLOYEE PATHS
  resources :leave_requests, only: %i[index create update destroy]
  namespace :employee do
    patch '/profile_update' => 'users#profile_update', as: :profile_update
  end

  # MICROSERVICES PATH
  namespace :microservices do
    namespace :kpis do
      post 'reload' => 'socket#reload'
      post 'batch_reload' => 'socket#batch_reload'
    end
  end

  # PRIVATE PATH
  # Requires a Skello App API KEY in X-Api-Key header
  namespace :private do
    namespace :svc_reports, path: 'reports' do
      post 'trigger_automated_pam_export' => 'automated_pam#trigger_automated_pam_export'
    end
    namespace :svc_billing, path: 'billing' do
      resources :organisations, only: [] do
        member do
          get 'features/:feature', to: 'organisations#show_feature'
        end
      end
    end
    # Organisation-scoped access keys (employees:read), minted for Join ATS
    # integrations. Common to all Skello services (not billing-specific);
    # authenticated by the Skello App API key (`X-Api-Key`).
    resources :organisations, only: [] do
      resources :access_keys, only: [:create]
    end
    namespace :svc_shops, path: 'shops' do
      resources :organisations, only: [] do
        member do
          get :config, action: :show_config
          get :document_variables
        end
      end
      resources :shops, only: %i[index show] do
        collection do
          post :document_variables
        end
      end
    end
    namespace :svc_intercom_bot, path: 'intercom-bot' do
      resources :shops, only: :update
    end
    namespace :pos do
      resource :kpis, only: :update
    end
    namespace :svc_documents, path: 'documents' do
      get 'employees/managers' => 'employees#managers'
      resources :shops, only: [] do
        member do
          get :organisation
          get :signature_context, to: 'shops#signature_context'
        end
      end
    end
    namespace :svc_employees, path: 'employees' do
      get :shops_and_employees, to: 'shops_and_employees#index'
      get ':id/annualization/catchup', to: 'annualization_contract_history#catchup'
      resource :employees, only: %i[show update create] do
        member do
          put ':id', action: :replace
        end
      end
      post :document_variables, to: 'employee_document_variables#document_variables'
    end
    resource :punch do
      member do
        post :trigger_lateness_sms_job
      end
    end
    namespace :svc_users do
      get '/payloads' => 'payloads#show'
      get '/managed_users/:user_id' => 'managed_users#show'
      get '/payslips_managed_users/:user_id' => 'payslips_managed_users#show'
    end
    namespace :svc_workload_plan, path: 'workload_plan' do
      resources :shifts, only: [:index]
    end
    namespace :svc_hiring, path: 'hiring' do
      get 'users/:user_id/hiring_qualification' => 'hiring_qualifications#show'
    end
    namespace :svc_requests, path: 'requests' do
      resource :shifts, only: :create
      get '/last_creator/:user_id' => 'shifts#last_creator'

      namespace :users do
        get :organisation_ids
      end
    end
    namespace :svc_bff, path: 'bff' do
      resource :kpis, only: :create
      namespace :planning_v4, path: 'planning/v4' do
        resources :postes, only: %i[index]
      end
    end
    namespace :svc_payroll, path: 'payroll' do
      resources :organisations, only: [] do
        resources :evps, only: %i[index]
      end
      scope path: 'sync-runs/:sync_run_id' do
        post 'export-payroll' => 'sync_runs/export_payroll#create'
      end
    end
    resource :planning_hours_data do
      collection do
        get :export_phd
      end
    end
  end

  # ICS FEEDS
  get 'users/:user_id/feeds/ics/:feed_url' => 'ics_feeds#show'

  constraints(-> (request) { !request.xhr? && request.format.html? }) do
    # See: app/javascript/src/v3/static/app-routes.js
    # - /users/sign_in
    # - /users/password/new
    # - /users/password/edit
    get '/users/*page', to: 'v3/pages#home', constraints: { page: /.*/ }
  end

  # V3
  namespace :v3 do
    namespace :api do
      resources :features, only: %i[index], param: :shop_id

      resources :employees, only: [], param: :id do
        get 'shops/shifts', to: 'employees/shifts#index'

        resources :shops, only: [], param: :id do
          get 'shifts', to: 'employees/shifts#shop_shifts'
        end
      end

      resources :memberships, only: %i[index create update destroy]

      post '/users/:token', to: 'registrations#create'
      post '/users/:id/reset_activation_code', to: 'registrations#reset_activation_code'
      patch '/users/:id/validate', to: 'registrations#activate'

      post '/self_serve/create', to: 'self_serve#create'
      post '/self_serve/create_shop_and_organisation', to: 'self_serve#create_shop_and_organisation'
      post '/self_serve/notify_salesforce', to: 'self_serve#notify_salesforce'
      post '/self_serve/confirm_subscription', to: 'self_serve#confirm_subscription'
      post '/self_serve/activate_account', to: 'self_serve#activate_account'
      post '/users/:id/self_serve/reset_activation_code', to: 'self_serve#reset_activation_code'
      post '/users/:id/self_serve/validate_code', to: 'self_serve#validate_code'
      patch '/users/:id/self_serve/update_email', to: 'self_serve#update_email'
      if ENV['APP_ENV'] != 'production'
        get '/users/:id/self_serve/activate_by_qa', to: 'self_serve#activate_by_qa'
      end
      get '/self_serve/tax_rates', to: 'self_serve#tax_rates'
      get '/self_serve/prices', to: 'self_serve#prices'

      resources :dashboards, only: :index do
        collection do
          get :view_all_access
        end
      end

      resources :labour_laws, only: [] do
        collection do
          put :upsert_shop
        end
      end

      resource :request_esignatures, only: [] do
        collection do
          post :bulk_create
          post :trigger_document_esignature
        end
      end

      # FIXME: use resources :user
      get '/email_validation', to: 'users#email_validation'
      namespace :prospects do
        get :current
      end
      get '/prospects/:token', to: 'prospects#show'
      patch '/prospects/:client_id', to: 'prospects#update'
      resource :notifications, only: %i[] do
        collection do
          get :count
          patch :mark_as_read
        end
      end
      namespace :automatic_planning do
        resources :config, only: %i[index]
        resources :competencies, only: %i[index]
        resource :competencies, only: %i[update]
        resources :prediction_model_status, only: %i[index]
      end
      resources :holidays, only: %i[index]
      resources :postes, only: %i[index] do
        collection do
          patch :bulk_update
          patch :sort
        end
      end
      resources :config, only: :index
      resources :feature_flags, only: :index
      # TODO: DEV-11009 delete when merging amendments controllers
      resources :amendments, controller: :contract_amendments, only: :index

      resources :missions, only: [] do
        member do
          get :export_report
        end
      end
      resources :team_schedules, only: %i[create update destroy index] do
        member do
          patch :update_team_employees
          patch :disable
        end
      end
      resources :pending_requests, only: %i[index]
      resource :current_organisation, controller: :current_organisation, only: %i[show update]
      resource :current_user, controller: :current_user, only: %i[show update] do
        member do
          get :user_licenses
          get :retrieve_jwt_tokens
          get :hr, action: :hr_profile
        end
        resource :profile, controller: 'current_user/profile', only: %i[update] do
          member do
            patch :update_last_sign_in_at
          end
        end
      end
      resource :current_shop, controller: :current_shop, only: %i[update]
      resource :current_license, controller: :current_license, only: %i[show]
      get 'me/organisations', to: 'me/organisations#index'
      resources :staff_registers, only: %i[index]
      resources :licenses, only: %i[index update]
      resource :mailing, controller: :mailing do
        collection do
          post :send_email
          post :send_raw_email
          post :leave_request_created
          post :leave_request_updated
        end
      end
      resource :cluster_tree, only: %i[show update destroy] do
        member do
          get :children_list
          get :move
          get :move_and_destroy
        end
      end
      resources :cluster_nodes, only: %i[index show create] do
        collection do
          get :first_shop_node
        end
        member do
          get :shops, action: 'shops'
        end
      end
      resources :absences, only: %i[index update] do
        collection do
          get :duration_preview, to: 'absences#duration_preview'
          patch :update_counter_status
          patch :update_indemnification_types
        end
      end
      resources :users, only: %i[index show create] do
        collection do
          get :shop_teammates
          get :shop_employees
          get :administrators
          get :planners
          get :hours_counters_users
          get :paid_leaves_counters_users
          get :hours_counters_reinitialization_users
          patch :bulk_update_annualization_data
          get :annualization_yearly_total
          get :birthdays
          get :display_names
          get :missing_attributes_for_payroll
          get :employee_decrypted_data
          get :self_or_managed_by
        end
        member do
          patch :reset_pin
          patch :send_pin
          patch :archive
          patch :unarchive
          post :invite
          get :holidays_counter
        end
        scope module: :users do
          resources :availabilities, only: %i[index] do
            collection do
              patch :bulk_update
            end
          end
          resources :contracts, only: %i[index show update create destroy] do
            scope module: :contracts do
              resources :amendments, only: %i[index create destroy] do
                collection do
                  patch :bulk_update
                end
              end
            end
            collection do
              get :current
              get :in_period
            end
            member do
              post :duplicate
              post :version_contract
            end
          end
          resources :holiday_settings, only: %i[index update]
          resource :initial_counters, only: %i[update]
          resource :initial_rcr_counters, only: %i[update]
          resource :initial_paid_leaves_counters, only: %i[update]
          resources :shifts, only: %i[index]
          patch '/hr', to: 'hr#update'
          patch '/personal_info', to: 'personal_info#update'
        end
      end
      resources :teams, only: %i[index create update destroy] do
        collection do
          get :user_ids
        end
      end
      resources :shops, only: %i[index edit show create update destroy] do
        member do
          get :show_extended
        end
        collection do
          get :all_organisation_shops
          post :reset_shops_counters
        end
        namespace :automatic_planning do
          resources :assignments, only: [] do
            post :prepare_assignment, on: :collection
            post :assign, on: :collection
            post :error, on: :collection
          end
          resources :rules, only: %i[index] do
            member { patch :toggle_active }
            member { patch :toggle_optional_value }
          end
          resource :rules, only: %i[update]
        end
        scope module: :shops do
          resources :text_document_templates, only: %i[index create update destroy] do
            member do
              get :variables_values
            end
            collection do
              get :templates_with_employee_variables
            end
          end
          resources :alerts, only: %i[index update]
          resource :convention, only: %i[show update] do
            member do
              patch :update_report_rules
            end
          end
          resources :postes, only: %i[index create update destroy] do
            collection do
              get :postes_suggestions
              get :last_user_shop_poste
              get :last_user_poste_by_creation_date
              post :_bulk_create
            end
          end
          resources :third_parties, only: %i[index create update destroy]
          resource :meal_rule, only: %i[show create update destroy]
          resource :initial_counters, only: %i[update]
          resource :initial_rcr_counters, only: %i[update]
          resource :initial_paid_leaves_counters, only: %i[update destroy]
          resource :pause_compensation, controller: :pause_compensation, only: %i[update]
          resource :lateness_inclusion, controller: :lateness_inclusion, only: %i[update]
          resources :holiday_settings, only: %i[index create update destroy] do
            collection do
              post :bulk_create
              delete :delete_all
              get :user_changes
            end
          end
          resource :shop_absence_config, only: %i[show update destroy]
          resource :shop_annualization_config, only: %i[show create destroy] do
            patch :update, to: 'shop_annualization_configs#upsert'
          end
        end
        resources :planning_templates, only: %i[index]
      end
      namespace :badgings do
        resources :matched_badgings do
          collection do
            get :arrival_departure_settings
            patch :bulk_update
          end
        end
        resources :day_badgings, only: %i[index] do
          collection do
            get :history
          end
        end
        post 'download_badgings', to: 'download_badgings#download'
      end
      namespace :integrations do
        resource :zelty, controller: :zelty, only: %i[update destroy] do
          collection do
            post :fetch_zelty_shops
          end
        end
        resource :lightspeed, controller: :lightspeed, only: %i[update destroy] do
          collection do
            get :lightspeed_shops
            get :authenticate_callback
            get :authorize_url
          end
        end
      end
      namespace :mobile do
        resources :config, only: %i[index]
        resources :banners, only: %i[index]
      end
      resources :platform_alerts, only: :index
      resources :planning_hours_datas, only: :index
      resources :primes, only: %i[show index], param: :contract_id do
        collection do
          delete ':id', action: :destroy
        end
      end
      resources :rcr, only: %i[show], param: :user_id
      resources :rcr_counters, only: :index do
        collection do
          patch :bulk_edit
          get :compensation_infos
        end
      end

      namespace :automatic_scheduling do
        resource :shop, only: [:show]
        resources :users, only: [:index]
        resources :shifts, only: [:create]
        patch 'shifts', to: 'shifts#update'
        patch 'shifts/undo', to: 'shifts#undo'
        resources :shifts, only: [] do
          member do
            patch :dismiss_alert, to: 'shift_alerts#dismiss'
          end
        end
      end
      namespace :plannings do
        resources :kpis, only: %i[index] do
          collection do
            patch :duplicate
            get :annualization_data
            post :export
          end
        end
        resources :users, only: %i[index show] do
          collection do
            patch :sort_users
          end
        end
        resources :postes, only: %i[index] do
          collection do
            get :by_ids
          end
        end
        resources :employees, only: %i[index]
        resources :positions, only: %i[index]
        namespace :filter do
          resources :teams, only: %i[index]
          resources :positions, only: %i[index]
          resources :employees, only: %i[index]
          resources :absences, only: %i[index]
        end
        namespace :shop do
          resource :planning_config, only: %i[show update]
        end
        namespace :user do
          resource :planning_config, only: %i[show update]
        end
        resource :kpis, only: :update
        resources :events, only: %i[index create update destroy] do
          collection do
            get :holidays
            get :birthdays
          end
        end
        resource :user_kpis_settings, only: %i[show update]
        resource :week_planning_prevision, only: %i[update]
        resources :availabilities, only: %i[index]

        resource :conflicts do
          post :template_conflicts
          post :previous_planning_conflicts
        end

        resources :shifts, only: %i[index create destroy] do
          collection do
            # Bulk delete using DELETE and array of ids in body (https://stackoverflow.com/a/55518015)
            delete :bulk_delete
            post :duplicate_from_previous_week_or_day
            post :recurrent
            patch :update
            get :weekly_rests
          end
        end
        resources :popular_shifts, only: %i[index]
        resources :templates, only: %i[index create destroy] do
          member do
            post :apply
          end
        end

        resources :day_rate_total, only: %i[index]
        resources :day_rate_counters, only: %i[index]
        resources :shift_users, only: %i[index]
        resources :position_groups, only: %i[index]
      end
      namespace :webhooks do
        resource :demo_requests, only: :create

        post '/shops/cancel', to: 'salesforce#cancel_shop'
        post '/shops/link_coach', to: 'salesforce#link_coach'
      end
      resource :billing_infos, only: %i[show create update]
      namespace :onboarding do
        resources :organisations, only: %i[show create update]
      end
      resource :weekly_options, only: %i[show update] do
        get :list
        post :validate_period
        post :unlock_request
        post :publish_planning
        patch :deactivate_alert
        get :validate_unlocked_days
      end
      resource :reports do
        collection do
          get :saas_report_users
          get :permanent_locked_period
          get :saas_report
          get :saas_report_annualization
          get :saas_report_trackers
          get :week_breakdown
          post :excel_report
          post :export_custom_integration
          post :export_global_integration
        end
        member do
          post :toggle_permanent_locked_period
          post :send_shop_report
          post :send_shops_reports
          post :send_grouped_report
          post :send_shop_integration
          post :send_shops_integrations
          post :send_grouped_integrations
        end
      end
      namespace :sepa do
        post :update_stripe_iban
      end
      resources :organisations, only: %i[] do
        scope module: :organisations do
          resources :applications, only: %i[create update index]
        end
      end
      resource :upsells do
        collection do
          post :request_demo
        end
      end
      resource :paid_leaves_counters, only: %i[show update] do
        collection do
          patch :update
          get :upcoming_paid_leave
          get :plc_periods_summary
          post :bulk_get_plc_by_month
        end
      end
      resource :planning_hours_datas do
        collection do
          get :user_planning_hours
        end
      end
      resource :bulk_planning_hours_datas, only: [] do
        collection do
          patch :reset_trackers
          patch :adjust_trackers
        end
      end
      resource :bulk_rcr_counters, only: [] do
        collection do
          patch :reset_trackers
        end
      end
      resources :availabilities, only: %i[index create show]
      resources :leave_requests, only: %i[index create destroy] do
        collection do
          get :managed_users
        end
      end
      namespace :billing_automation do
        resources :users, only: %i[create] do
          collection do
            get :email_validation
          end
        end
        resources :shops, only: %i[update destroy] do
          collection do
            put :bulk_upsert
            patch :bulk_update_shop_features_states
            get :bulk_get_packname_and_features_states
          end
        end
        resources :organisations, only: %i[update destroy] do
          collection do
            put :upsert
            post :create, to: 'organisations#upsert'
          end
          member do
            post :cancel_free_trial
          end
        end
      end
      namespace :v0 do
        resources :shifts, only: %i[index]

        namespace :billing_automation do
          resources :shops, only: %i[] do
            collection do
              put :bulk_upsert
            end
          end
        end
      end
      namespace :v1 do
        resources :shifts, only: %i[index] do
          resources :comments, only: [] do
            collection do
              patch :_append
            end
          end
          resources :tasks, only: %i[create] do
            member do
              patch :_status
              patch :_label
            end
          end
        end
      end
      resources :dpae_deposits, only: %i[create show], param: :contract_id
      resources :dpae_deposits, only: %i[update], param: :dpae_deposit_id
      resources :contracts, only: %i[index] do
        collection do
          get :contract_hours
        end
      end
      resources :organisation_credentials, only: %i[index create destroy update], param: :name
      resources :employees do
        collection do
          post :bulk_touch
          get :managers
          get :payslips_managees
          get :documents_employees
        end
      end
    end

    resources :login, only: :create
    match '/login/refresh_token' => 'login#refresh_token', as: :refresh_token, via: %i[get post]
    match '/login/impersonate' => 'login#impersonate', as: :impersonate, via: %i[get post]
    patch '/login/change_password', to: 'login#change_password'
    post '/login/login_time_clock', to: 'login#login_time_clock'
    post '/login/refresh_time_clock_token', to: 'login#refresh_time_clock_token'
    resources :jwt_token, only: :create

    get '/users/sessions/stateless_token(/:purpose)',
        to: 'sessions#stateless_token',
        defaults: { format: :json, purpose: :websocket },
        constraints: { purpose: /#{Auth::StatelessToken::TOKEN_LIFESPANS_BY_PURPOSE.keys.reject { |key| key == :superadmin }.join('|')}|/ }

    constraints(-> (request) { !request.xhr? && request.format.html? }) do
      get '/*path', to: 'pages#home'
    end
    get '/home_url', to: 'pages#home_url'
  end

  # Super admin
  namespace :super_admin do
    namespace :api do
      namespace :billing_automation do
        resources :shops, only: [] do
          collection do
            post :shops_synchronization
          end
          member do
            get :show
            patch :update
          end
        end
      end
      resources :shop_extended_infos, only: %i[update]
      resources :shops, only: [] do
        namespace :imports do
          resources :users, only: [] do
            collection do
              patch :upsert
            end
          end
        end
        collection do
          get :get_pack_offer_names
        end
      end
      resources :sessions, only: %i[create] do
        collection do
          delete 'sign_out' => 'sessions#destroy'
        end
      end
      resources :config, only: %i[index]
      get '/search' => 'search#index'
      get '/user_import_template', to: 'user_import_template#index'

      scope module: :feature_flags do
        resources :feature_flags, only: %i[index create update destroy]
        resources :feature_flags_dev, only: %i[create update destroy]
      end

      resources :organisations do
        scope module: :organisations do
          resources :applications, only: %i[index destroy]
        end
      end

      resources :map_shops, only: [:index]
      get '/fetch_filters' => 'map_shops#fetch_filters'

      namespace :integrations do
        resources :absences, only: %i[show]
        resources :evps, only: %i[show]
        resources :basic_data, only: %i[show]
        resources :hris_integration_keys, only: %i[show]
        resources :automatic_jobs, only: %i[index] do
          collection do
            post :manual_launch
          end
        end
        resources :integrations, only: %i[index create update destroy] do
          collection do
            post :run_integration_job
            get :download_hris_files
          end
        end
        resource :integration_replication, only: :update
      end

      resources :organisations, only: %i[index show update destroy] do
        collection do
          # FIXME: DEV-9112 Delete this when all clients will be migrated to new process
          post :migrate_to_billing_new_process
          get :home_organisations
        end
        resources :shops, only: [:index]
        scope module: 'organisations' do
          resources :annualization_configs, only: %i[index]
          resources :licenses, only: %i[index update]
          resources :access_keys, only: %i[create]
        end
        member do
          get :contacts
          patch :contacts, to: 'organisations#update_contacts'
        end
      end
      resources :shops, only: %i[index show update destroy] do
        collection { get :predefined_values }
        member { post :migrate }
      end
      resource :bulk_shops, only: [:update]
      resources :shops, only: %i[show update destroy]
      resources :users, only: %i[index show destroy] do
        resources :action_history_items, only: [:index]
        collection do
          get 'super_admin', to: 'users#super_admin', as: :super_admin
          patch 'bulk', to: 'users#bulk', as: :bulk
          get 'administrators', to: 'users#administrators', as: :administrators
        end
        member do
          patch :delete_email
          patch :demote_super_admin
        end
      end
      resources :cluster_nodes, only: %i[index]
      resources :prospects, only: %i[index update]
      resource :badgings, only: :update
      resource :esignatures, only: :update
      resource :automatic_plannings, only: :update
      resources :organisations, only: [] do
        resources :shops, param: :shop_id, only: [] do
          member do
            get 'features_states', to: 'organisations/shops/features_states#get_option_features_states'
            put 'features_states', to: 'organisations/shops/features_states#update'
          end
        end
      end
      resource :pay_exporters, only: :update
      resource :invitations, only: [:create]
      resource :pins, only: %i[update create]
      resources :stripe_charges, only: %i[index create update] do
        collection do
          get :kinds
          get :zones
          post :undispute_last
        end
      end
      resources :stripe_invoices, only: %i[show]
      resource :mails, only: [] do
        collection { post :deliver }
      end
      namespace :invoices do
        resources :exports, only: %i[index]
      end
      resources :shifts_histories, only: [:index]

      # Mail invoice again
      post 'send_invoice_again' => 'stripe_invoices#send_invoice_again'
    end

    # Wildcard path for Vue Router
    get '*' => 'pages#home'
  end

  # MOBILE API
  namespace :api, defaults: { format: :json } do
    namespace :v2 do
      resources :users, only: %i[update]
      resources :personal_shifts, only: %i[index]
      resources :shifts, only: %i[index edit destroy update] do
        resources :shift_swaps, only: %i[create new]
      end
      resources :shift_swaps, only: %i[edit update]
      get 'profile', to: 'users#profile'
      namespace :users do
        resources :profiles, only: [:update]
      end
      post 'users/forgot_password', to: 'users#forgot_password'
      post 'users/check_reset_token_validity', to: 'users#check_reset_token_validity'
      patch 'password_from_forgotten', to: 'users#update_password_from_forgotten'
      resources :shops, only: [] do
        resources :shifts, only: %i[new create]
      end
      resources :weekly_options, only: [] do
        patch '/change_lock_status', to: 'weekly_options#change_lock_status'
      end
      namespace :leave_requests do
        post 'leave_requests/leave_requests_dashboard', to: 'leave_requests#leave_requests_dashboard'
        resources :leave_requests, only: %i[index new create]
      end
      resources :received_leave_requests, only: %i[update]
      namespace :availabilities do
        resources :history_availabilities, only: %i[index]
        resources :pending_availabilities, only: %i[index]
        resources :availabilities, only: %i[new create edit]
      end
      resources :shift_swaps, only: %i[index]
    end

    namespace :v1 do
      post 'users/sign_in', to: 'registrations#sign_in'
      get 'users/me', to: 'users#me'
      post 'users/device_tokens', to: 'users#user_device_tokens'
      resources :shifts, only: %i[show]
      resources :availabilities, only: %i[update]
      get 'requests/sent' => 'requests#sent'
    end
  end

  namespace :opti do
    namespace :v1 do
      resources :shops, only: %i[] do
        resource :opti_structures, only: %i[show update]
      end
      post '/shops/:shop_id/opti_structures/opti_structure_check',
           to: 'opti_structures#opti_structure_check', as: :shop_opti_structure_check

      resources :planning_templates, only: %i[show]
    end
  end

  # PUBLIC API
  namespace :public_api do
    namespace :v1 do
      resources :users, only: %i[create update]
      resources :amendments, only: %i[create]
      resources :evp, only: %i[index]
      resources :absences, only: %i[index]
    end
  end

  namespace :public do
    resources :kpis, only: %i[index]
  end

  # Zapier hooks reponse
  post '/zapier/synchronized_shop', to: 'lists#salesforce_synchronized_shops_list'
end
# rubocop:enable Layout/LineLength
