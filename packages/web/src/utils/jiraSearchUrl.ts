export const jiraSearchUrl = (host: string, jql: string) => `https://${host}/issues/?jql=${encodeURIComponent(jql)}`
