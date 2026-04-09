output "app_url" {
  description = "Container App public URL"
  value       = "https://${azurerm_container_app.main.ingress[0].fqdn}"
}

output "container_app_name" {
  description = "Container App name (for GHA deployments)"
  value       = azurerm_container_app.main.name
}

output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

