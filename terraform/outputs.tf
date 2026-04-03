output "app_url" {
  description = "Container App public URL"
  value       = "https://${azurerm_container_app.main.ingress[0].fqdn}"
}

output "container_app_name" {
  description = "Container App name (for GHA deployments)"
  value       = azurerm_container_app.main.name
}

output "migration_job_name" {
  description = "Migration job name (for GHA trigger)"
  value       = azurerm_container_app_job.migration.name
}

output "resource_group_name" {
  description = "Resource group name"
  value       = azurerm_resource_group.main.name
}

output "db_private_ip" {
  description = "Database VM private IP"
  value       = azurerm_network_interface.db.private_ip_address
  sensitive   = true
}
