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

variable "database_url" {
  description = "PostgreSQL connection string (e.g. Neon)"
  type        = string
  sensitive   = true
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
