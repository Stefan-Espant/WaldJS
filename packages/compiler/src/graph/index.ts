import { statSync } from 'node:fs'

export type GraphNode = {
  file: string
  mtime: number
  imports: string[]
  output: string | null
}

export type DependencyGraph = {
  nodes: Map<string, GraphNode>
}

export function createGraph(): DependencyGraph {
  return { nodes: new Map() }
}

export function addNode(graph: DependencyGraph, file: string): GraphNode {
  const stat = statSync(file)
  const node: GraphNode = {
    file,
    mtime: stat.mtimeMs,
    imports: [],
    output: null,
  }
  graph.nodes.set(file, node)
  return node
}

export function needsRecompile(node: GraphNode): boolean {
  const stat = statSync(node.file)
  return stat.mtimeMs !== node.mtime
}
