variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "northeurope"
}

variable "project" {
  description = "Project name used in resource naming"
  type        = string
  default     = "zync"
}

variable "vm_admin_username" {
  description = "Admin username for the database VM"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key for VM access"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "ghcr_image" {
  description = "GHCR image reference (e.g. ghcr.io/user/zync:latest)"
  type        = string
}

variable "strava_client_id" {
  description = "Strava OAuth client ID"
  type        = string
}

variable "strava_client_secret" {
  description = "Strava OAuth client secret"
  type        = string
  sensitive   = true
}

variable "cookie_secret" {
  description = "Cookie signing secret (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "frontend_url" {
  description = "Public URL of the app. Set after first deploy to https://<app-fqdn>. Leave empty for initial bootstrap."
  type        = string
  default     = ""
}
