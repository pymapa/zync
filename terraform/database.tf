# NIC for database VM (no public IP)
resource "azurerm_network_interface" "db" {
  name                = "${local.name_prefix}-db-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.common_tags

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.db.id
    private_ip_address_allocation = "Dynamic"
  }
}

# Database VM — B1s with Ubuntu 24.04
resource "azurerm_linux_virtual_machine" "db" {
  name                = "${local.name_prefix}-db-vm"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  size                = "Standard_B1s"
  admin_username      = var.vm_admin_username
  tags                = local.common_tags

  network_interface_ids = [azurerm_network_interface.db.id]

  admin_ssh_key {
    username   = var.vm_admin_username
    public_key = file(var.ssh_public_key_path)
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 30
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }

  identity {
    type = "SystemAssigned"
  }

  lifecycle {
    prevent_destroy = true
  }

  custom_data = base64encode(<<-CLOUD_INIT
    #cloud-config
    package_update: true
    packages:
      - postgresql
      - postgresql-client
      - jq
    runcmd:
      - systemctl enable postgresql
      - systemctl start postgresql
  CLOUD_INIT
  )
}

# VM Extension: configure PostgreSQL after Key Vault is ready
resource "azurerm_virtual_machine_extension" "configure_postgres" {
  name                 = "configure-postgres"
  virtual_machine_id   = azurerm_linux_virtual_machine.db.id
  publisher            = "Microsoft.Azure.Extensions"
  type                 = "CustomScript"
  type_handler_version = "2.1"

  protected_settings = jsonencode({
    script = base64encode(<<-SCRIPT
      #!/bin/bash
      set -e

      # Wait for PostgreSQL to be ready (cloud-init may still be running)
      for i in $(seq 1 30); do
        if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
        sleep 5
      done

      # Fetch DB password from Key Vault using VM's managed identity
      # Retry token fetch — identity propagation can take time after VM creation
      for i in $(seq 1 12); do
        TOKEN=$(curl -s 'http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net' -H 'Metadata: true' | jq -r '.access_token // empty')
        if [ -n "$TOKEN" ]; then break; fi
        sleep 10
      done
      if [ -z "$TOKEN" ]; then echo "Failed to get IMDS token after retries"; exit 1; fi

      DB_PASSWORD=$(curl -s "${azurerm_key_vault.main.vault_uri}secrets/db-password?api-version=7.4" -H "Authorization: Bearer $TOKEN" | jq -r '.value')
      if [ -z "$DB_PASSWORD" ] || [ "$DB_PASSWORD" = "null" ]; then echo "Failed to fetch DB password from Key Vault"; exit 1; fi

      # Create database user and database (idempotent)
      # Use PGPASSWORD env var to avoid shell interpolation issues
      sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='zync'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER zync;"
      sudo -u postgres psql -c "ALTER USER zync PASSWORD '$DB_PASSWORD';"
      sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='zync'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE zync OWNER zync;"

      # Detect PostgreSQL config paths (works regardless of version)
      PG_CONF=$(sudo -u postgres psql -tc "SHOW config_file" | tr -d ' ')
      PG_HBA=$(sudo -u postgres psql -tc "SHOW hba_file" | tr -d ' ')

      # Set listen_addresses (idempotent)
      if ! grep -q "listen_addresses = '\*'" "$PG_CONF"; then
        echo "listen_addresses = '*'" >> "$PG_CONF"
      fi

      # Add HBA entry for apps subnet (idempotent)
      if ! grep -q "10.0.0.0/23" "$PG_HBA"; then
        echo "host zync zync 10.0.0.0/23 scram-sha-256" >> "$PG_HBA"
      fi

      systemctl restart postgresql
    SCRIPT
    )
  })

  depends_on = [
    azurerm_key_vault_secret.db_password,
    azurerm_role_assignment.vm_kv_reader,
  ]
}
