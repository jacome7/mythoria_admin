# Mythoria Admin Portal - AI Agent Documentation

## Service Metadata
```yaml
name: mythoria-admin
version: 0.1.0
type: admin-portal
framework: nextjs
architecture: standalone-application
primary_language: typescript
authentication: google-oauth
deployment_model: containerized
port: 3001
```

## Service Overview

The Mythoria Admin Portal is the administrative interface for the Mythoria platform, providing comprehensive management capabilities for users, content, workflows, and system monitoring. It operates as a secure, domain-restricted portal with multi-database connectivity.

## Technical Architecture

### Core Framework
```yaml
framework:
  name: nextjs
  version: 15.3.4
  router: app-router
  output: standalone
  
runtime:
  node_version: 22.12
  package_manager: npm
  typescript: true
  
styling:
  framework: tailwindcss
  version: 4
  ui_library: daisyui
  version: 5.0.43
```

### Authentication System
```yaml
authentication:
  provider: nextauth-v5
  oauth_provider: google
  strategy: jwt
  session_max_age: 86400  # 24 hours
  
domain_restrictions:
  - mythoria.pt
  - caravanconcierge.com
  
security_features:
  - server_side_domain_validation
  - email_verification_required
  - jwt_session_management
  - https_enforcement
```

### Database Architecture
```yaml
databases:
  mythoria_db:
    purpose: main_application_data
    connection_type: direct
    entities: [users, stories, story_elements, ai_generations, notifications]
    
  workflows_db:
    purpose: ai_workflow_management
    connection_type: direct
    entities: [story_generation_runs, story_generation_steps, token_usage_tracking]
    
  backoffice_db:
    purpose: admin_specific_data
    connection_type: direct
    entities: [admin_users, audit_logs, system_config]

orm:
  name: drizzle
  version: 0.44.2
  connection_pooling: true
  migration_strategy: version_controlled
```

## API Specifications

### Health Monitoring API
```yaml
endpoint: /api/health
methods: [GET]
authentication: optional
parameters:
  debug:
    type: boolean
    optional: true
    description: Enable detailed diagnostics

response_schema:
  status: "healthy" | "unhealthy"
  timestamp: string
  databases:
    mythoria: 
      status: "connected" | "disconnected"
      error?: string
    workflows:
      status: "connected" | "disconnected"
      error?: string
    backoffice:
      status: "connected" | "disconnected"
      error?: string
  network:
    status: "connected" | "disconnected"
    publicDomain: string
    error?: string
```

### User Management API
```yaml
endpoint: /api/users
methods: [GET, POST, PATCH, DELETE]
authentication: required
authorization: google_oauth_domain_restricted

query_parameters:
  page: number
  limit: number
  search: string
  status: "active" | "inactive" | "suspended"
  role: string

response_schema:
  users: User[]
  pagination:
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
```

### Content Management API
```yaml
endpoint: /api/stories
methods: [GET, PATCH, DELETE]
authentication: required
authorization: google_oauth_domain_restricted

features:
  - story_listing_with_pagination
  - content_moderation_workflows
  - publication_status_management
  - bulk_operations
  - content_analytics
```

### Workflow Management API
```yaml
endpoint: /api/workflows
methods: [GET, POST]
authentication: required
authorization: google_oauth_domain_restricted

features:
  - workflow_execution_monitoring
  - token_usage_tracking
  - cost_analysis
  - workflow_error_handling
  - performance_metrics
```

## Environment Configuration

### Development Environment
```yaml
essential_variables:
  - AUTH_SECRET
  - NEXTAUTH_URL
  - GOOGLE_CLIENT_ID
  - GOOGLE_CLIENT_SECRET
  - DB_HOST
  - DB_PORT
  - DB_USER
  - DB_PASSWORD
  - MYTHORIA_DB
  - WORKFLOWS_DB
  - BACKOFFICE_DB

optional_variables:
  - NODE_ENV
  - LOG_LEVEL
  - SENTRY_DSN
```

### Production Environment
```yaml
cloud_run_configuration:
  region: europe-west9
  project: oceanic-beach-460916-n5
  service_name: mythoria-admin
  memory: 512Mi
  cpu: 1
  min_instances: 0
  max_instances: 5
  vpc_connector: mythoria-vpc-connector
  vpc_egress: private-ranges-only

secrets_management:
  provider: google_secret_manager
  secrets:
    - auth-secret
    - google-client-id
    - google-client-secret
    - db-host
    - db-port
    - db-user
    - db-password
```

## Core Features

### Administrative Capabilities
```yaml
user_management:
  - user_directory_with_search
  - account_status_management
  - profile_editing
  - activity_monitoring
  - bulk_operations

content_management:
  - story_directory_with_filtering
  - content_moderation
  - media_asset_management
  - publication_control
  - content_analytics

system_monitoring:
  - real_time_health_checks
  - performance_metrics
  - error_tracking
  - uptime_monitoring
  - network_connectivity_verification

workflow_management:
  - ai_workflow_oversight
  - token_usage_tracking
  - cost_analysis
  - queue_management
  - error_resolution
```

### Analytics and Reporting
```yaml
analytics_features:
  - platform_usage_analytics
  - user_engagement_metrics
  - content_creation_trends
  - cost_analysis_and_optimization
  - custom_report_generation

dashboard_widgets:
  - system_status_indicators
  - key_performance_indicators
  - recent_activity_feed
  - alert_summary
  - quick_actions_panel
```

## Security Architecture

### Authentication Flow
```yaml
authentication_flow:
  1: user_visits_admin_portal
  2: redirect_to_google_oauth
  3: google_authentication
  4: server_domain_validation
  5: email_verification_check
  6: jwt_token_generation
  7: session_establishment
  8: admin_interface_access
```

### Security Measures
```yaml
security_features:
  authentication:
    - google_oauth_2.0
    - domain_restriction_enforcement
    - email_verification_requirement
    - jwt_session_management
    
  api_security:
    - authentication_middleware
    - input_validation
    - rate_limiting
    - cors_configuration
    
  database_security:
    - connection_pooling
    - parameterized_queries
    - access_control
    - audit_logging
```

## Deployment Configuration

### Docker Configuration
```yaml
docker:
  base_image: node:22.12-alpine
  build_strategy: multi-stage
  optimization:
    - layer_caching
    - minimal_runtime
    - non_root_user
  
  container_config:
    port: 3000
    user: nextjs
    workdir: /app
    environment:
      NODE_ENV: production
      NEXT_TELEMETRY_DISABLED: 1
```

### Cloud Build Pipeline
```yaml
cloud_build:
  steps:
    1: docker_build
    2: container_registry_push
    3: cloud_run_deployment
  
  configuration:
    timeout: 1200s
    machine_type: E2_HIGHCPU_8
    logging: CLOUD_LOGGING_ONLY
```

## Integration Points

### Internal Service Integration
```yaml
database_connections:
  mythoria_db:
    purpose: user_and_content_data
    connection_type: direct_pool
    
  workflows_db:
    purpose: ai_workflow_data
    connection_type: direct_pool
    
  backoffice_db:
    purpose: admin_audit_data
    connection_type: direct_pool

external_service_monitoring:
  story_generation_workflow:
    monitoring_type: indirect
    data_source: workflows_db
    
  notification_engine:
    monitoring_type: indirect
    data_source: mythoria_db
```

### Google Cloud Platform Integration
```yaml
gcp_services:
  cloud_run:
    service_hosting: true
    auto_scaling: true
    
  cloud_sql:
    database_connectivity: vpc_private
    connection_pooling: true
    
  secret_manager:
    secret_storage: true
    runtime_access: true
    
  cloud_build:
    ci_cd_pipeline: true
    automated_deployment: true
```

## Performance Optimization

### Frontend Optimization
```yaml
next_js_optimizations:
  - automatic_code_splitting
  - image_optimization
  - static_generation
  - lazy_loading
  
tailwind_optimizations:
  - purge_unused_css
  - component_optimization
  - responsive_design
```

### Backend Optimization
```yaml
database_optimizations:
  - connection_pooling
  - query_optimization
  - proper_indexing
  - pagination_strategies
  
api_optimizations:
  - response_caching
  - efficient_queries
  - bulk_operations
  - rate_limiting
```

## Monitoring and Observability

### Health Monitoring
```yaml
health_checks:
  endpoint: /api/health
  frequency: continuous
  components:
    - database_connectivity
    - network_connectivity
    - system_performance
    - memory_usage

alerts:
  - database_connection_failures
  - authentication_errors
  - performance_degradation
  - resource_exhaustion
```

### Logging and Metrics
```yaml
logging:
  level: configurable
  format: structured_json
  destination: cloud_logging
  
metrics:
  - request_response_times
  - database_query_performance
  - authentication_success_rates
  - resource_utilization
  - error_rates
```

## Development Patterns

### Code Organization
```yaml
directory_structure:
  src/app: next_js_app_router
  src/components: react_components
  src/db: database_layer
  src/lib: utility_functions
  src/types: typescript_definitions
  docs: comprehensive_documentation

development_commands:
  dev: "npm run dev"
  build: "npm run build"
  test: "npm run test"
  lint: "npm run lint"
  db_migrate: "npm run db:migrate"
  db_studio: "npm run db:studio"
```

### Testing Strategy
```yaml
testing_framework: jest
test_types:
  - unit_tests
  - integration_tests
  - api_endpoint_tests
  - authentication_flow_tests
  
coverage_target: 80%
test_commands:
  run: "npm run test"
  watch: "npm run test:watch"
  coverage: "npm run test:coverage"
```

## Troubleshooting Guide

### Common Issues
```yaml
authentication_issues:
  oauth_redirect_mismatch:
    cause: incorrect_redirect_uri_configuration
    solution: verify_google_console_settings
    
  domain_restriction_failure:
    cause: unauthorized_email_domain
    solution: check_domain_validation_logic

database_issues:
  connection_failures:
    cause: network_or_credentials
    solution: verify_vpc_and_connection_strings
    
  migration_errors:
    cause: schema_conflicts
    solution: review_migration_files

deployment_issues:
  cloud_build_failures:
    cause: environment_or_dependencies
    solution: check_build_logs_and_config
    
  runtime_errors:
    cause: missing_secrets_or_config
    solution: verify_environment_variables
```

## Coding Style

- Use 2 spaces for indentation.
- Use single 'quotes' for strings, double "quotes" for JSX props.
- Always use semicolons.
- Interface names should be descriptive without prefixes (e.g., `User`, `AdminServiceParams`).
- Enum values should use UPPER_SNAKE_CASE for constants.
- Always use strict equality (`===` and `!==`).
- Use JSDoc-style comments for functions and complex logic.
- Organize imports: external packages first, then internal imports with `@/` path mapping.
- Prefer arrow functions for inline callbacks, regular functions for main declarations.
- Use async/await over promises for better readability.
- Always use trailing commas in objects and arrays.
- Use descriptive variable names and avoid abbreviations.
- Group related functionality in service objects (e.g., `adminService`).
- Use TypeScript strict mode with comprehensive type definitions.

---

**Agent Documentation Version**: 1.0.0  
**Last Updated**: June 29, 2025  
**Service**: Mythoria Admin Portal v0.1.0+
