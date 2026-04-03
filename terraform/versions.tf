terraform {
  required_version = ">= 1.5"

  # TODO: Configure remote backend before first apply
  # backend "azurerm" {
  #   resource_group_name  = "zync-tfstate-rg"
  #   storage_account_name = "zynctfstate"
  #   container_name       = "tfstate"
  #   key                  = "zync.tfstate"
  # }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}
