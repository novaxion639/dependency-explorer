export type RepoType =
  | 'rails-monolith'
  | 'rails-microservice'
  | 'typescript-microservice'
  | 'vue-frontend'
  | 'react-native'
  | 'npm-package'
  | 'monorepo'
  | 'other'

export type PackageCategory = 'auth' | 'infrastructure' | 'sdk' | 'shared-lib' | 'ui' | 'tooling'

export interface Repo {
  name: string
  type: RepoType
  packageJson: { name: string; version: string | null } | null
  gemfile: string | null
  internalDependencies: string[]
  externalDependencies: Record<string, string>
  publishedPackages?: string[]
}

export interface SharedPackage {
  name: string
  sourceRepo: string
  category: PackageCategory
  usedBy: string[]
}

export interface DependencyMap {
  metadata: {
    generatedAt: string
    organization: string
    totalRepos: number
    totalSharedPackages: number
  }
  repos: Repo[]
  sharedPackages: SharedPackage[]
}

// Graph types for visualisation
export interface GraphNode {
  id: string
  label: string
  type: 'repo' | 'package'
  repoType?: RepoType
  packageCategory?: PackageCategory
  connectionCount: number
}

export interface GraphEdge {
  source: string
  target: string
}
