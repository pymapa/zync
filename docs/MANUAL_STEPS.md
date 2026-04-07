# Manual Setup Steps

Steps to set up Azure infrastructure and GitHub Actions deployment. Run these once before the automated pipeline works.

## 1. Azure OIDC for GitHub Actions

Create an Azure AD app registration with federated credentials so GitHub Actions can authenticate without stored secrets.

```bash
# Create app registration
az ad app create --display-name "zync-github-actions"
APP_ID=$(az ad app list --display-name "zync-github-actions" --query "[0].appId" -o tsv)

# Create service principal
az ad sp create --id $APP_ID
SP_OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)

# Grant Contributor on subscription (or scope to resource group after first TF apply)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az role assignment create --assignee $SP_OBJECT_ID --role Contributor --scope /subscriptions/$SUBSCRIPTION_ID

# Add federated credential for GitHub Actions (replace with your repo)
az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:YOUR_GITHUB_USER/zync:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'

# Note these values for GitHub secrets:
echo "AZURE_CLIENT_ID: $APP_ID"
echo "AZURE_TENANT_ID: $(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
```

## 2. GitHub Repository Secrets

In GitHub repo → Settings → Secrets and variables → Actions, add:

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | App registration client ID from step 1 |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

Also create a GitHub environment called `production` (Settings → Environments).

## 3. First Terraform Apply

```bash
cd terraform

# Create terraform.tfvars (see terraform.tfvars.example)
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

terraform init
terraform plan
terraform apply
```

Note the outputs — especially `app_url`.

## 4. Set Frontend URL

After first deploy, the Container App has a real FQDN. Update Terraform with it:

```bash
# Get the actual FQDN
terraform output app_url

# Re-apply with the real URL
terraform apply -var='frontend_url=https://zync-app.<hash>.northeurope.azurecontainerapps.io'
```

This fixes CORS and Strava OAuth callbacks.

## 5. Update Strava OAuth Redirect

In Strava API settings (https://www.strava.com/settings/api), update:
- **Authorization Callback Domain**: `zync-app.<hash>.northeurope.azurecontainerapps.io`

## 6. Manual Operations

### Trigger migration manually
```bash
az containerapp job start --name zync-migrate --resource-group zync-rg
```

### Redeploy latest image
```bash
az containerapp update --name zync-app --resource-group zync-rg --image ghcr.io/YOUR_USER/zync:latest
```

### Stop VM to save costs
```bash
az vm deallocate --name zync-db-vm --resource-group zync-rg
# Restart when needed:
az vm start --name zync-db-vm --resource-group zync-rg
```

### SSH into database VM (requires NSG rule)
Add a temporary SSH rule to the NSG, then use Azure Bastion or a jump box. The VM has no public IP.
