// Azure region "name" → "regionalDisplayName" mapping.
// Source: https://gist.github.com/ausfestivus/04e55c7d80229069bf3bc75870630ec8
// (regenerate with `az account list-locations -o json` if Azure adds regions).
const AZURE_REGION_NAMES: Record<string, string> = {
  // US
  eastus: '(US) East US',
  eastus2: '(US) East US 2',
  southcentralus: '(US) South Central US',
  westus: '(US) West US',
  westus2: '(US) West US 2',
  westus3: '(US) West US 3',
  centralus: '(US) Central US',
  northcentralus: '(US) North Central US',
  westcentralus: '(US) West Central US',

  // Asia Pacific
  australiaeast: '(Asia Pacific) Australia East',
  australiacentral: '(Asia Pacific) Australia Central',
  australiacentral2: '(Asia Pacific) Australia Central 2',
  australiasoutheast: '(Asia Pacific) Australia Southeast',
  southeastasia: '(Asia Pacific) Southeast Asia',
  eastasia: '(Asia Pacific) East Asia',
  centralindia: '(Asia Pacific) Central India',
  southindia: '(Asia Pacific) South India',
  westindia: '(Asia Pacific) West India',
  jioindiawest: '(Asia Pacific) Jio India West',
  jioindiacentral: '(Asia Pacific) Jio India Central',
  japaneast: '(Asia Pacific) Japan East',
  japanwest: '(Asia Pacific) Japan West',
  koreacentral: '(Asia Pacific) Korea Central',
  koreasouth: '(Asia Pacific) Korea South',

  // Europe
  northeurope: '(Europe) North Europe',
  westeurope: '(Europe) West Europe',
  swedencentral: '(Europe) Sweden Central',
  uksouth: '(Europe) UK South',
  ukwest: '(Europe) UK West',
  francecentral: '(Europe) France Central',
  francesouth: '(Europe) France South',
  germanywestcentral: '(Europe) Germany West Central',
  germanynorth: '(Europe) Germany North',
  italynorth: '(Europe) Italy North',
  norwayeast: '(Europe) Norway East',
  norwaywest: '(Europe) Norway West',
  polandcentral: '(Europe) Poland Central',
  spaincentral: '(Europe) Spain Central',
  switzerlandnorth: '(Europe) Switzerland North',
  switzerlandwest: '(Europe) Switzerland West',

  // Canada
  canadacentral: '(Canada) Canada Central',
  canadaeast: '(Canada) Canada East',

  // Mexico
  mexicocentral: '(Mexico) Mexico Central',

  // Middle East
  uaenorth: '(Middle East) UAE North',
  uaecentral: '(Middle East) UAE Central',
  israelcentral: '(Middle East) Israel Central',
  qatarcentral: '(Middle East) Qatar Central',

  // Africa
  southafricanorth: '(Africa) South Africa North',
  southafricawest: '(Africa) South Africa West',

  // South America
  brazilsouth: '(South America) Brazil South',
  brazilsoutheast: '(South America) Brazil Southeast',
}

// Power Platform geo super-region names returned by the inventory API
// (e.g. an environment with `location: "unitedstates"` instead of `eastus`).
// Mapped to the same `(Group) Name` format for visual consistency.
const POWER_PLATFORM_GEOS: Record<string, string> = {
  unitedstates: '(US) United States',
  unitedstatesfirstrelease: '(US) United States (First Release)',
  usgov: '(US Gov) US Government',
  usdod: '(US Gov) US DoD',
  usgovhigh: '(US Gov) US Gov High',
  europe: '(Europe) Europe',
  europefirstrelease: '(Europe) Europe (First Release)',
  france: '(Europe) France',
  germany: '(Europe) Germany',
  norway: '(Europe) Norway',
  sweden: '(Europe) Sweden',
  switzerland: '(Europe) Switzerland',
  unitedkingdom: '(Europe) United Kingdom',
  asia: '(Asia Pacific) Asia',
  australia: '(Asia Pacific) Australia',
  india: '(Asia Pacific) India',
  japan: '(Asia Pacific) Japan',
  korea: '(Asia Pacific) South Korea',
  southkorea: '(Asia Pacific) South Korea',
  singapore: '(Asia Pacific) Singapore',
  canada: '(Canada) Canada',
  brazil: '(South America) Brazil',
  southamerica: '(South America) South America',
  southafrica: '(Africa) South Africa',
  uae: '(Middle East) United Arab Emirates',
  china: '(China) China',
  preview: 'Preview',
}

/**
 * Convert a raw Azure region or Power Platform geo (e.g. "eastus",
 * "unitedstates") into a friendly RegionalDisplayName (e.g. "(US) East US",
 * "(US) United States"). Unknown values fall back to the raw string with
 * basic capitalization so the UI doesn't show a lower-case slug.
 */
export function formatRegion(raw: string | undefined | null): string {
  if (!raw) return ''
  const key = raw.trim().toLowerCase()
  if (!key) return ''
  return AZURE_REGION_NAMES[key]
    ?? POWER_PLATFORM_GEOS[key]
    ?? capitalize(raw)
}

function capitalize(value: string): string {
  // Best-effort fallback: turn "someregion" / "some-region" into "Some Region".
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
