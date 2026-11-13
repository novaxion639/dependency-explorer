export const kebab = (camel: string): string => camel.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export const stepService = (label: string): string => label.replace(/ \([^)]*\)$/, '')
