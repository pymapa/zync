resource "azurerm_resource_group" "main" {
  name     = "${local.name_prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

# Random suffix for globally unique resource names (Key Vault)
resource "random_id" "suffix" {
  byte_length = 3
}

# Generate database password
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "-_"
}
