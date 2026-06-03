// Lookup table for well-known Power Platform connectors. Display names follow
// the official Connector Reference (https://learn.microsoft.com/connectors/).
// Keys here are the connector's canonical id slug (no "shared_" prefix); the
// normalizer below strips that prefix so both `shared_sharepointonline` and
// bare `sharepointonline` resolve to the same entry.

export interface ConnectorInfo {
  id: string
  displayName: string
  color: string
  letter: string
}

const CONNECTORS: Record<string, Omit<ConnectorInfo, 'id'>> = {
  // ── Microsoft 365 ────────────────────────────────────────────────────────
  sharepointonline:               { displayName: 'SharePoint',                              color: '#036C70', letter: 'S' },
  office365:                      { displayName: 'Office 365 Outlook',                      color: '#0078D4', letter: 'O' },
  office365users:                 { displayName: 'Office 365 Users',                        color: '#0078D4', letter: 'U' },
  office365groups:                { displayName: 'Office 365 Groups',                       color: '#0078D4', letter: 'G' },
  office365groupsmail:            { displayName: 'Office 365 Groups Mail',                  color: '#0078D4', letter: 'G' },
  office365security:              { displayName: 'Office 365 Security & Compliance',        color: '#0078D4', letter: 'S' },
  office365video:                 { displayName: 'Microsoft Stream',                        color: '#BC1948', letter: 'S' },
  teams:                          { displayName: 'Microsoft Teams',                         color: '#4B53BC', letter: 'T' },
  onedriveforbusiness:            { displayName: 'OneDrive for Business',                   color: '#0078D4', letter: 'O' },
  onedrive:                       { displayName: 'OneDrive',                                color: '#0078D4', letter: 'O' },
  excelonlinebusiness:            { displayName: 'Excel Online (Business)',                 color: '#107C41', letter: 'E' },
  excelonline:                    { displayName: 'Excel Online (OneDrive)',                 color: '#107C41', letter: 'E' },
  onenote:                        { displayName: 'OneNote (Business)',                      color: '#80397B', letter: 'O' },
  planner:                        { displayName: 'Planner',                                 color: '#31752F', letter: 'P' },
  todo:                           { displayName: 'Microsoft To Do (Business)',              color: '#2564CF', letter: 'T' },
  outlook:                        { displayName: 'Outlook.com',                             color: '#0078D4', letter: 'O' },
  outlooktasks:                   { displayName: 'Outlook Tasks',                           color: '#0078D4', letter: 'T' },
  microsoftforms:                 { displayName: 'Microsoft Forms',                         color: '#176A2C', letter: 'F' },
  powerbi:                        { displayName: 'Power BI',                                color: '#F2C811', letter: 'P' },
  yammer:                         { displayName: 'Viva Engage (Yammer)',                    color: '#106EBE', letter: 'V' },
  office365adminapi:              { displayName: 'Office 365 Admin',                        color: '#0078D4', letter: 'A' },

  // ── Power Platform / Dataverse ───────────────────────────────────────────
  commondataservice:              { displayName: 'Common Data Service',                     color: '#742774', letter: 'D' },
  commondataserviceforapps:       { displayName: 'Microsoft Dataverse',                     color: '#742774', letter: 'D' },
  commondataserviceforappsadmin:  { displayName: 'Microsoft Dataverse (Admin)',             color: '#742774', letter: 'D' },
  dynamicscrmonline:              { displayName: 'Dynamics 365',                            color: '#002050', letter: 'D' },
  mscrm:                          { displayName: 'Dynamics CRM Online',                     color: '#002050', letter: 'D' },
  powerappsforappsadmin:          { displayName: 'Power Apps for App Makers',               color: '#742774', letter: 'P' },
  powerappsforadmins:             { displayName: 'Power Apps for Admins',                   color: '#742774', letter: 'P' },
  powerappsnotification:          { displayName: 'Power Apps Notification',                 color: '#742774', letter: 'P' },
  powerautomateformakers:         { displayName: 'Power Automate for Makers',               color: '#0066FF', letter: 'P' },
  powerautomatemanagement:        { displayName: 'Power Automate Management',               color: '#0066FF', letter: 'P' },
  powerappsmanagement:            { displayName: 'Power Apps Management',                   color: '#742774', letter: 'P' },
  powerplatformforadmins:         { displayName: 'Power Platform for Admins',               color: '#0066FF', letter: 'P' },
  powerappsenvironment:           { displayName: 'Power Apps Environment',                  color: '#742774', letter: 'P' },
  approvals:                      { displayName: 'Approvals',                               color: '#0078D4', letter: 'A' },
  shifts:                         { displayName: 'Shifts for Microsoft Teams',              color: '#4B53BC', letter: 'S' },

  // ── Azure ────────────────────────────────────────────────────────────────
  azureblob:                      { displayName: 'Azure Blob Storage',                      color: '#0078D4', letter: 'A' },
  azurequeues:                    { displayName: 'Azure Queues',                            color: '#0078D4', letter: 'A' },
  azuretables:                    { displayName: 'Azure Table Storage',                     color: '#0078D4', letter: 'A' },
  azurefile:                      { displayName: 'Azure File Storage',                      color: '#0078D4', letter: 'A' },
  azureautomation:                { displayName: 'Azure Automation',                        color: '#0078D4', letter: 'A' },
  aadinvitationmanager:           { displayName: 'Azure AD Identity and Access',            color: '#0078D4', letter: 'A' },
  visualstudioteamservices:       { displayName: 'Azure DevOps',                            color: '#0078D4', letter: 'A' },
  azuredevops:                    { displayName: 'Azure DevOps',                            color: '#0078D4', letter: 'A' },
  servicebus:                     { displayName: 'Service Bus',                             color: '#0078D4', letter: 'S' },
  eventhubs:                      { displayName: 'Event Hubs',                              color: '#0078D4', letter: 'E' },
  azureeventgrid:                 { displayName: 'Azure Event Grid',                        color: '#0078D4', letter: 'E' },
  azureeventgridpublish:          { displayName: 'Azure Event Grid Publish',                color: '#0078D4', letter: 'E' },
  documentdb:                     { displayName: 'Azure Cosmos DB',                         color: '#0078D4', letter: 'C' },
  keyvault:                       { displayName: 'Azure Key Vault',                         color: '#0078D4', letter: 'K' },
  azureappservice:                { displayName: 'Azure App Service',                       color: '#0078D4', letter: 'A' },
  azurevm:                        { displayName: 'Azure VM',                                color: '#0078D4', letter: 'V' },
  arm:                            { displayName: 'Azure Resource Manager',                  color: '#0078D4', letter: 'R' },
  azuremysql:                     { displayName: 'Azure Database for MySQL',                color: '#0078D4', letter: 'M' },
  databricks:                     { displayName: 'Azure Databricks',                        color: '#FF3621', letter: 'D' },
  kusto:                          { displayName: 'Azure Data Explorer',                     color: '#0078D4', letter: 'E' },
  azuredatafactory:               { displayName: 'Azure Data Factory',                      color: '#0078D4', letter: 'F' },
  azuredatalake:                  { displayName: 'Azure Data Lake',                         color: '#0078D4', letter: 'L' },
  azuredigitaltwins:              { displayName: 'Azure Digital Twins',                     color: '#0078D4', letter: 'D' },
  azureloganalytics:              { displayName: 'Azure Log Analytics',                     color: '#0078D4', letter: 'L' },
  azureloganalyticsdatacollector: { displayName: 'Azure Log Analytics Data Collector',      color: '#0078D4', letter: 'L' },
  azuremonitorlogs:               { displayName: 'Azure Monitor Logs',                      color: '#0078D4', letter: 'M' },
  applicationinsights:            { displayName: 'Azure Application Insights',              color: '#0078D4', letter: 'A' },
  iotcentral:                     { displayName: 'Azure IoT Central V2',                    color: '#0078D4', letter: 'I' },
  azureiotcentral:                { displayName: 'Azure IoT Central V3',                    color: '#0078D4', letter: 'I' },
  acl:                            { displayName: 'Azure Confidential Ledger',               color: '#0078D4', letter: 'L' },
  aci:                            { displayName: 'Azure Container Instance',                color: '#0078D4', letter: 'C' },
  sqldw:                          { displayName: 'Azure Synapse',                           color: '#0078D4', letter: 'S' },

  // ── Azure Communication / messaging ──────────────────────────────────────
  acschat:                        { displayName: 'Azure Communication Chat',                color: '#0078D4', letter: 'C' },
  acsemail:                       { displayName: 'Azure Communication Email',               color: '#0078D4', letter: 'E' },
  acsidentity:                    { displayName: 'Azure Communication Services Identity',   color: '#0078D4', letter: 'I' },
  azurecommunicationservicessms:  { displayName: 'Azure Communication Services SMS',        color: '#0078D4', letter: 'S' },
  acssmsevents:                   { displayName: 'Azure Communication Services SMS Events', color: '#0078D4', letter: 'S' },

  // ── Azure AI ─────────────────────────────────────────────────────────────
  azureopenai:                    { displayName: 'Azure OpenAI',                            color: '#0078D4', letter: 'A' },
  azureaisearch:                  { displayName: 'Azure AI Search',                         color: '#0078D4', letter: 'A' },
  azureagentservice:              { displayName: 'Azure AI Foundry Agent Service',          color: '#0078D4', letter: 'A' },
  azureaifoundryinference:        { displayName: 'Azure AI Foundry Inference',              color: '#0078D4', letter: 'A' },
  formrecognizer:                 { displayName: 'Azure AI Document Intelligence',          color: '#0078D4', letter: 'D' },
  cognitiveservicestextanalytics: { displayName: 'Azure Cognitive Service for Language',    color: '#0078D4', letter: 'L' },
  cognitiveservicesspe:           { displayName: 'Azure Batch Speech-to-text',              color: '#0078D4', letter: 'S' },
  azurespeechpronuncia:           { displayName: 'Azure Speech Pronunciation Assessment',   color: '#0078D4', letter: 'S' },
  azuretexttospeech:              { displayName: 'Azure Text to speech',                    color: '#0078D4', letter: 'T' },
  openai:                         { displayName: 'OpenAI',                                  color: '#0F6E4B', letter: 'O' },
  aiservice:                      { displayName: 'AI Builder',                              color: '#0078D4', letter: 'A' },
  documentparser:                 { displayName: 'AI Builder Document Parser',              color: '#0078D4', letter: 'D' },
  textanalytics:                  { displayName: 'Text Analytics',                          color: '#0078D4', letter: 'T' },
  cognitiveservicestext:          { displayName: 'Cognitive Services Text Analytics',       color: '#0078D4', letter: 'C' },

  // ── Database / data ──────────────────────────────────────────────────────
  sql:                            { displayName: 'SQL Server',                              color: '#A91D22', letter: 'S' },
  mysql:                          { displayName: 'MySQL',                                   color: '#00758F', letter: 'M' },
  postgresql:                     { displayName: 'PostgreSQL',                              color: '#336791', letter: 'P' },
  oracle:                         { displayName: 'Oracle Database',                         color: '#C74634', letter: 'O' },
  informix:                       { displayName: 'Informix',                                color: '#0F62FE', letter: 'I' },
  teradata:                       { displayName: 'Teradata',                                color: '#F37440', letter: 'T' },
  sqlanywhere:                    { displayName: 'SQL Anywhere',                            color: '#A91D22', letter: 'S' },

  // ── Amazon ───────────────────────────────────────────────────────────────
  amazons3:                       { displayName: 'Amazon S3',                               color: '#FF9900', letter: 'A' },
  amazonsqs:                      { displayName: 'Amazon SQS',                              color: '#FF9900', letter: 'A' },
  amazonredshift:                 { displayName: 'Amazon Redshift',                         color: '#FF9900', letter: 'A' },

  // ── Adobe ────────────────────────────────────────────────────────────────
  adobesign:                      { displayName: 'Adobe Acrobat Sign',                      color: '#FA0F00', letter: 'A' },
  adobeacrobatsignsand:           { displayName: 'Adobe Acrobat Sign Sandbox',              color: '#FA0F00', letter: 'A' },
  adobecreativecloud:             { displayName: 'Adobe Creative Cloud',                    color: '#FA0F00', letter: 'A' },
  adobeexperiencemanag:           { displayName: 'Adobe Experience Manager',                color: '#FA0F00', letter: 'A' },
  adobepdftools:                  { displayName: 'Adobe PDF Services',                      color: '#FA0F00', letter: 'A' },

  // ── Google ───────────────────────────────────────────────────────────────
  googledrive:                    { displayName: 'Google Drive',                            color: '#0F9D58', letter: 'G' },
  googlesheet:                    { displayName: 'Google Sheets',                           color: '#0F9D58', letter: 'G' },
  googlecalendar:                 { displayName: 'Google Calendar',                         color: '#4285F4', letter: 'G' },
  googletasks:                    { displayName: 'Google Tasks',                            color: '#4285F4', letter: 'G' },
  googlecontacts:                 { displayName: 'Google Contacts',                         color: '#4285F4', letter: 'G' },
  gmail:                          { displayName: 'Gmail',                                   color: '#EA4335', letter: 'G' },
  youtube:                        { displayName: 'YouTube',                                 color: '#FF0000', letter: 'Y' },

  // ── Communication / collaboration ────────────────────────────────────────
  slack:                          { displayName: 'Slack',                                   color: '#611f69', letter: 'S' },
  twitter:                        { displayName: 'X (Twitter)',                             color: '#000000', letter: 'X' },
  bitbucket:                      { displayName: 'Bitbucket',                               color: '#0052CC', letter: 'B' },
  github:                         { displayName: 'GitHub',                                  color: '#171515', letter: 'G' },
  basecamp:                       { displayName: 'Basecamp 3',                              color: '#1D2D35', letter: 'B' },
  basecamp2:                      { displayName: 'Basecamp 2',                              color: '#1D2D35', letter: 'B' },
  chatter:                        { displayName: 'Chatter',                                 color: '#00A1E0', letter: 'C' },
  blogger:                        { displayName: 'Blogger',                                 color: '#FF5722', letter: 'B' },

  // ── CRM / business ───────────────────────────────────────────────────────
  salesforce:                     { displayName: 'Salesforce',                              color: '#00A1E0', letter: 'S' },
  servicenow:                     { displayName: 'ServiceNow',                              color: '#293E40', letter: 'S' },
  zendesk:                        { displayName: 'Zendesk',                                 color: '#03363D', letter: 'Z' },
  jira:                           { displayName: 'Jira',                                    color: '#0052CC', letter: 'J' },
  asana:                          { displayName: 'Asana',                                   color: '#F06A6A', letter: 'A' },
  capsulecrm:                     { displayName: 'Capsule CRM',                             color: '#33495F', letter: 'C' },
  act:                            { displayName: 'Act!',                                    color: '#0072CE', letter: 'A' },
  mailchimp:                      { displayName: 'Mailchimp',                               color: '#FFE01B', letter: 'M' },
  docusign:                       { displayName: 'DocuSign',                                color: '#FFCC22', letter: 'D' },
  boldsign:                       { displayName: 'BoldSign',                                color: '#0078D4', letter: 'B' },
  certinalesign:                  { displayName: 'Certinal eSign',                          color: '#0078D4', letter: 'C' },
  blueink:                        { displayName: 'BlueInk',                                 color: '#0078D4', letter: 'B' },

  // ── Storage / file ───────────────────────────────────────────────────────
  dropbox:                        { displayName: 'Dropbox',                                 color: '#0061FF', letter: 'D' },
  box:                            { displayName: 'Box',                                     color: '#0061D5', letter: 'B' },

  // ── GIS / mapping ────────────────────────────────────────────────────────
  arcgis:                         { displayName: 'ArcGIS',                                  color: '#005580', letter: 'A' },
  arcgisenterprise:               { displayName: 'ArcGIS Enterprise',                       color: '#005580', letter: 'A' },
  arcgispaas:                     { displayName: 'ArcGIS PaaS',                             color: '#005580', letter: 'A' },
  bingmaps:                       { displayName: 'Bing Maps',                               color: '#0078D4', letter: 'B' },
  bingsearch:                     { displayName: 'Bing Search',                             color: '#0078D4', letter: 'B' },

  // ── Utility / generic ────────────────────────────────────────────────────
  http:                           { displayName: 'HTTP',                                    color: '#709727', letter: 'H' },
  httpwebhook:                    { displayName: 'HTTP Webhook',                            color: '#709727', letter: 'H' },
  request:                        { displayName: 'Request',                                 color: '#709727', letter: 'R' },
  rss:                            { displayName: 'RSS',                                     color: '#FF6600', letter: 'R' },
  filesystem:                     { displayName: 'File System',                             color: '#605E5C', letter: 'F' },
  ftp:                            { displayName: 'FTP',                                     color: '#605E5C', letter: 'F' },
  sftpwithssh:                    { displayName: 'SFTP - SSH',                              color: '#605E5C', letter: 'S' },
  smtp:                           { displayName: 'SMTP',                                    color: '#605E5C', letter: 'S' },
  as2:                            { displayName: 'AS2',                                     color: '#605E5C', letter: 'A' },
  biztalk:                        { displayName: 'BizTalk Server',                          color: '#0078D4', letter: 'B' },
  schedule:                       { displayName: 'Schedule',                                color: '#0078D4', letter: 'S' },
  recurrence:                     { displayName: 'Recurrence',                              color: '#0078D4', letter: 'R' },
  variable:                       { displayName: 'Variables',                               color: '#605E5C', letter: 'V' },
  control:                        { displayName: 'Control',                                 color: '#605E5C', letter: 'C' },
  compose:                        { displayName: 'Data Operation',                          color: '#605E5C', letter: 'D' },
  logicflows:                     { displayName: 'Workflows',                               color: '#0066FF', letter: 'W' },

  // ── Dynamics 365 family ──────────────────────────────────────────────────
  dynamicssmbsaas:                { displayName: 'Dynamics 365 Business Central',           color: '#002050', letter: 'D' },
  customerinsights:               { displayName: 'Dynamics 365 Customer Insights',          color: '#002050', letter: 'D' },
  microsoftformspro:              { displayName: 'Dynamics 365 Customer Voice',             color: '#176A2C', letter: 'C' },
  uiflow:                         { displayName: 'Desktop flows',                           color: '#0066FF', letter: 'D' },

  // ── Other common third-party connectors ──────────────────────────────────
  trello:                         { displayName: 'Trello',                                  color: '#0079BF', letter: 'T' },
  notion:                         { displayName: 'Notion',                                  color: '#000000', letter: 'N' },
  confluence:                     { displayName: 'Confluence',                              color: '#172B4D', letter: 'C' },
  twilio:                         { displayName: 'Twilio',                                  color: '#F22F46', letter: 'T' },
  sendgrid:                       { displayName: 'SendGrid',                                color: '#1A82E2', letter: 'S' },
  surveymonkey:                   { displayName: 'SurveyMonkey',                            color: '#00BF6F', letter: 'S' },
  cloudconvert:                   { displayName: 'CloudConvert',                            color: '#1A82E2', letter: 'C' },

  // ── Other widely used ────────────────────────────────────────────────────
  buffer:                         { displayName: 'Buffer',                                  color: '#000000', letter: 'B' },
  bulksms:                        { displayName: 'BulkSMS',                                 color: '#0078D4', letter: 'B' },
  bitly:                          { displayName: 'Bitly',                                   color: '#EE6123', letter: 'B' },
  aweber:                         { displayName: 'AWeber',                                  color: '#1D7DBE', letter: 'A' },
  airslate:                       { displayName: 'airSlate',                                color: '#FF6E14', letter: 'A' },
  agilepointnx:                   { displayName: 'AgilePoint NX',                           color: '#0078D4', letter: 'A' },
  alembaitsm:                     { displayName: 'Alemba ITSM',                             color: '#0078D4', letter: 'A' },
  appfigures:                     { displayName: 'Appfigures',                              color: '#0078D4', letter: 'A' },
  acumatica:                      { displayName: 'Acumatica',                               color: '#5BA4DA', letter: 'A' },
  blueoceanbrain:                 { displayName: 'Blue Ocean Brain',                        color: '#0078D4', letter: 'B' },
  calendlyv2:                     { displayName: 'Calendly',                                color: '#006BFF', letter: 'C' },
  calendly:                       { displayName: 'Calendly (legacy)',                       color: '#006BFF', letter: 'C' },
}

// Normalize various connector-ID shapes:
//   "/providers/Microsoft.PowerApps/apis/shared_sharepointonline" → "sharepointonline"
//   "shared_SharePointOnline" → "sharepointonline"
//   "sharepointonline" → "sharepointonline"
export function normalizeConnectorId(raw: string): string {
  if (!raw) return ''
  const tail = raw.split('/').pop() ?? raw
  return tail.toLowerCase().trim().replace(/^shared_/, '')
}

// Reverse-lookup: tool/source names like "SharePoint Online" → "sharepointonline".
// Handles "Online" / "for Business" / hyphens / underscores variants.
export function findConnectorIdByDisplayName(name: string): string | undefined {
  if (!name) return undefined
  const norm = name.toLowerCase().trim()
  const compact = norm.replace(/[\s\-_()]+/g, '')

  // Direct id check (e.g. "sharepointonline" matches the canonical key)
  if (compact in CONNECTORS) return compact

  // Exact display-name match
  for (const [id, info] of Object.entries(CONNECTORS)) {
    if (info.displayName.toLowerCase() === norm) return id
  }
  // Display-name prefix (e.g. "SharePoint" matches the tool name "SharePoint Online")
  for (const [id, info] of Object.entries(CONNECTORS)) {
    const d = info.displayName.toLowerCase()
    if (norm.startsWith(d + ' ') || norm.startsWith(d + '-')) return id
  }
  return undefined
}

export function getConnectorInfo(raw: string): ConnectorInfo {
  const id = normalizeConnectorId(raw)
  const entry = CONNECTORS[id]
  if (entry) return { id, ...entry }
  // Fallback: humanize the bare id ("my_custom_api" → "My custom api")
  const friendly = id
    .replace(/^shared[-_]/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
  const display = friendly
    ? friendly.charAt(0).toUpperCase() + friendly.slice(1)
    : raw
  const letter = (friendly[0] ?? raw[0] ?? '?').toUpperCase()
  return { id, displayName: display, color: '#605E5C', letter }
}
