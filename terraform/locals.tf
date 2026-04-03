locals {
  name_prefix = var.project
  common_tags = {
    project    = var.project
    managed_by = "terraform"
  }
}
