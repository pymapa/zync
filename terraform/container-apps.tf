# Container Apps Environment (in apps subnet)
resource "azurerm_container_app_environment" "main" {
  name                = "${local.name_prefix}-cae"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags
}

# Container App — main application
resource "azurerm_container_app" "main" {
  name                         = "${local.name_prefix}-app"
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = local.common_tags

  identity {
    type = "SystemAssigned"
  }

  ingress {
    external_enabled = true
    target_port      = 3001
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "zync"
      image  = var.ghcr_image
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "PORT"
        value = "3001"
      }
      env {
        name  = "TRUST_PROXY"
        value = "1"
      }
      env {
        name  = "FRONTEND_URL"
        value = var.frontend_url != "" ? var.frontend_url : "https://${local.name_prefix}-app.placeholder.azurecontainerapps.io"
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
      env {
        name  = "STRAVA_CLIENT_ID"
        value = var.strava_client_id
      }
      env {
        name        = "STRAVA_CLIENT_SECRET"
        secret_name = "strava-client-secret"
      }
      env {
        name        = "COOKIE_SECRET"
        secret_name = "cookie-secret"
      }
    }
  }

  secret {
    name  = "database-url"
    value = var.database_url
  }

  secret {
    name  = "strava-client-secret"
    value = var.strava_client_secret
  }

  secret {
    name  = "cookie-secret"
    value = var.cookie_secret
  }

  # Bootstrap: first `terraform apply` uses a placeholder FRONTEND_URL.
  # After deploy, set frontend_url to the actual FQDN from the app_url output:
  #   terraform apply -var='frontend_url=https://<fqdn>'
}

# Container App Job — migration runner
resource "azurerm_container_app_job" "migration" {
  name                         = "${local.name_prefix}-migrate"
  location                     = azurerm_resource_group.main.location
  resource_group_name          = azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  tags                         = local.common_tags

  replica_timeout_in_seconds = 300
  replica_retry_limit        = 0

  manual_trigger_config {
    parallelism              = 1
    replica_completion_count = 1
  }

  secret {
    name  = "database-url"
    value = var.database_url
  }

  template {
    container {
      name   = "migrate"
      image  = var.ghcr_image
      cpu    = 0.5
      memory = "1Gi"

      command = ["node", "server/dist/scripts/migrate.js"]

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }
    }
  }
}
