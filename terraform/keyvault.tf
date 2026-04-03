data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                       = "${local.name_prefix}-kv-${random_id.suffix.hex}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = false
  rbac_authorization_enabled = true
  tags                       = local.common_tags
}

# Store database password
resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-password"
  value        = random_password.db_password.result
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.deployer_kv_admin]
}

# Store Strava secrets
resource "azurerm_key_vault_secret" "strava_client_secret" {
  name         = "strava-client-secret"
  value        = var.strava_client_secret
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.deployer_kv_admin]
}

resource "azurerm_key_vault_secret" "cookie_secret" {
  name         = "cookie-secret"
  value        = var.cookie_secret
  key_vault_id = azurerm_key_vault.main.id

  depends_on = [azurerm_role_assignment.deployer_kv_admin]
}

# RBAC: Deployer (current user/SP) can manage secrets
resource "azurerm_role_assignment" "deployer_kv_admin" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# RBAC: VM managed identity can read secrets
resource "azurerm_role_assignment" "vm_kv_reader" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_virtual_machine.db.identity[0].principal_id
}

# RBAC: Container App managed identity can read secrets
resource "azurerm_role_assignment" "app_kv_reader" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_container_app.main.identity[0].principal_id
}
