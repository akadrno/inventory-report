// Azure region "name" → "displayName" mapping.
// Source: https://gist.github.com/ausfestivus/04e55c7d80229069bf3bc75870630ec8
// (regenerate with `az account list-locations -o json` if Azure adds regions).
const AZURE_REGION_NAMES: Record<string, string> = {
  // US
  eastus: 'East US',
  eastus2: 'East US 2',
  southcentralus: 'South Central US',
  westus: 'West US',
  westus2: 'West US 2',
  westus3: 'West US 3',
  centralus: 'Central US',
  northcentralus: 'North Central US',
  westcentralus: 'West Central US',

  // Asia Pacific
  australiaeast: 'Australia East',
  australiacentral: 'Australia Central',
  australiacentral2: 'Australia Central 2',
  australiasoutheast: 'Australia Southeast',
  southeastasia: 'Southeast Asia',
  eastasia: 'East Asia',
  centralindia: 'Central India',
  southindia: 'South India',
  westindia: 'West India',
  jioindiawest: 'Jio India West',
  jioindiacentral: 'Jio India Central',
  japaneast: 'Japan East',
  japanwest: 'Japan West',
  koreacentral: 'Korea Central',
  koreasouth: 'Korea South',

  // Europe
  northeurope: 'North Europe',
  westeurope: 'West Europe',
  swedencentral: 'Sweden Central',
  uksouth: 'UK South',
  ukwest: 'UK West',
  francecentral: 'France Central',
  francesouth: 'France South',
  germanywestcentral: 'Germany West Central',
  germanynorth: 'Germany North',
  italynorth: 'Italy North',
  norwayeast: 'Norway East',
  norwaywest: 'Norway West',
  polandcentral: 'Poland Central',
  spaincentral: 'Spain Central',
  switzerlandnorth: 'Switzerland North',
  switzerlandwest: 'Switzerland West',

  // Canada
  canadacentral: 'Canada Central',
  canadaeast: 'Canada East',

  // Mexico
  mexicocentral: 'Mexico Central',

  // Middle East
  uaenorth: 'UAE North',
  uaecentral: 'UAE Central',
  israelcentral: 'Israel Central',
  qatarcentral: 'Qatar Central',

  // Africa
  southafricanorth: 'South Africa North',
  southafricawest: 'South Africa West',

  // South America
  brazilsouth: 'Brazil South',
  brazilsoutheast: 'Brazil Southeast',
}

// Power Platform geo super-region names returned by the inventory API
// (e.g. an environment with `location: "unitedstates"` instead of `eastus`).
const POWER_PLATFORM_GEOS: Record<string, string> = {
  unitedstates: 'United States',
  unitedstatesfirstrelease: 'United States (First Release)',
  usgov: 'US Government',
  usdod: 'US DoD',
  usgovhigh: 'US Gov High',
  europe: 'Europe',
  europefirstrelease: 'Europe (First Release)',
  france: 'France',
  germany: 'Germany',
  norway: 'Norway',
  sweden: 'Sweden',
  switzerland: 'Switzerland',
  unitedkingdom: 'United Kingdom',
  asia: 'Asia',
  australia: 'Australia',
  india: 'India',
  japan: 'Japan',
  korea: 'South Korea',
  southkorea: 'South Korea',
  singapore: 'Singapore',
  canada: 'Canada',
  brazil: 'Brazil',
  southamerica: 'South America',
  southafrica: 'South Africa',
  uae: 'United Arab Emirates',
  china: 'China',
  preview: 'Preview',
}

/**
 * Convert a raw Azure region or Power Platform geo (e.g. "eastus",
 * "unitedstates") into a friendly DisplayName (e.g. "East US",
 * "United States"). Unknown values fall back to the raw string with
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
