import type { McpToolContext } from '../types'
import { z } from 'zod'
import { RepositoryIndexer } from '../core/indexer'
import { safeLog } from '../utils'
import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

// Global instances
let repositoryIndexer: RepositoryIndexer | null = null
let visualizationServer: any = null
let serverPort = 3001
let currentPort = 3001

// Initialize components
async function initializeComponents() {
  try {
    repositoryIndexer = new RepositoryIndexer()
    await repositoryIndexer.initialize()
    safeLog('✅ Visualization components initialized successfully')
  } catch (error) {
    safeLog(`❌ Failed to initialize visualization components: ${error}`, 'error')
  }
}

// Start initialization
initializeComponents()

// Code parsing utilities
interface CodeEntity {
  id: string
  name: string
  type: 'function' | 'class' | 'module' | 'file'
  file?: string
  line?: number
  dependencies: string[]
}

interface GraphData {
  nodes: Array<{
    id: string
    label: string
    type: 'function' | 'class' | 'module' | 'file'
    file?: string
    line?: number
  }>
  edges: Array<{
    source: string
    target: string
    type: 'import' | 'call' | 'inherit' | 'contain'
  }>
}

// Enhanced code parser for multiple languages
function parseCodeFile(content: string, filename: string): CodeEntity[] {
  const entities: CodeEntity[] = []
  const lines = content.split('\n')
  
  // Add file as entity
  entities.push({
    id: `file:${filename}`,
    name: filename.split('/').pop() || filename,
    type: 'file',
    file: filename,
    dependencies: []
  })

  const fileExt = filename.split('.').pop()?.toLowerCase()
  
  if (fileExt === 'py') {
    // Python parsing
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Class definition (including inheritance)
      const classMatch = line.match(/^class\s+(\w+)(?:\s*\(([^)]+)\))?/)
      if (classMatch) {
        const className = classMatch[1]
        const parentClass = classMatch[2]
        
        entities.push({
          id: `class:${filename}:${className}`,
          name: className,
          type: 'class',
          file: filename,
          line: i + 1,
          dependencies: parentClass ? [parentClass.trim()] : []
        })
      }
      
      // Function definition (including async, static, etc.)
      const funcMatch = line.match(/^(?:async\s+)?def\s+(\w+)/)
      if (funcMatch) {
        entities.push({
          id: `function:${filename}:${funcMatch[1]}`,
          name: funcMatch[1],
          type: 'function',
          file: filename,
          line: i + 1,
          dependencies: []
        })
      }
      
      // Import statements (various formats)
      const importMatch = line.match(/^import\s+([\w\s,]+)(?:\s+as\s+(\w+))?/)
      if (importMatch) {
        const imports = importMatch[1].split(',').map(imp => imp.trim())
        const fileEntity = entities.find(e => e.id === `file:${filename}`)
        if (fileEntity) {
          imports.forEach(imp => {
            const moduleName = imp.split('.')[0] // Get first part of dotted import
            fileEntity.dependencies.push(`module:${moduleName}`)
          })
        }
      }
      
      // From import statements
      const fromImportMatch = line.match(/^from\s+([\w.]+)\s+import\s+([\w\s,]+)/)
      if (fromImportMatch) {
        const moduleName = fromImportMatch[1]
        const fileEntity = entities.find(e => e.id === `file:${filename}`)
        if (fileEntity) {
          fileEntity.dependencies.push(`module:${moduleName}`)
        }
      }
    }
  } else if (fileExt === 'js' || fileExt === 'ts') {
    // JavaScript/TypeScript parsing
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Class definition (including extends)
      const classMatch = line.match(/^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/)
      if (classMatch) {
        const className = classMatch[1]
        const parentClass = classMatch[2]
        
        entities.push({
          id: `class:${filename}:${className}`,
          name: className,
          type: 'class',
          file: filename,
          line: i + 1,
          dependencies: parentClass ? [parentClass] : []
        })
      }
      
      // Function definition (various formats)
      const funcMatch = line.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/)
      if (funcMatch) {
        entities.push({
          id: `function:${filename}:${funcMatch[1]}`,
          name: funcMatch[1],
          type: 'function',
          file: filename,
          line: i + 1,
          dependencies: []
        })
      }
      
      // Arrow function assignments
      const arrowFuncMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/)
      if (arrowFuncMatch) {
        entities.push({
          id: `function:${filename}:${arrowFuncMatch[1]}`,
          name: arrowFuncMatch[1],
          type: 'function',
          file: filename,
          line: i + 1,
          dependencies: []
        })
      }
      
      // Import statements (ES6 modules)
      const importMatch = line.match(/^import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/)
      if (importMatch) {
        const fileEntity = entities.find(e => e.id === `file:${filename}`)
        if (fileEntity) {
          fileEntity.dependencies.push(`module:${importMatch[1]}`)
        }
      }
      
      // Default imports
      const defaultImportMatch = line.match(/^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/)
      if (defaultImportMatch) {
        const fileEntity = entities.find(e => e.id === `file:${filename}`)
        if (fileEntity) {
          fileEntity.dependencies.push(`module:${defaultImportMatch[2]}`)
        }
      }
    }
  } else if (fileExt === 'java') {
    // Java parsing
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Class definition
      const classMatch = line.match(/^(?:public\s+)?class\s+(\w+)/)
      if (classMatch) {
        entities.push({
          id: `class:${filename}:${classMatch[1]}`,
          name: classMatch[1],
          type: 'class',
          file: filename,
          line: i + 1,
          dependencies: []
        })
      }
      
      // Method definition
      const methodMatch = line.match(/^(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:[\w<>[\]]+\s+)?(\w+)\s*\([^)]*\)/)
      if (methodMatch) {
        entities.push({
          id: `function:${filename}:${methodMatch[1]}`,
          name: methodMatch[1],
          type: 'function',
          file: filename,
          line: i + 1,
          dependencies: []
        })
      }
      
      // Import statements
      const importMatch = line.match(/^import\s+([\w.]+)/)
      if (importMatch) {
        const fileEntity = entities.find(e => e.id === `file:${filename}`)
        if (fileEntity) {
          fileEntity.dependencies.push(`module:${importMatch[1]}`)
        }
      }
    }
  } else if (fileExt === 'cpp' || fileExt === 'cc' || fileExt === 'cxx') {
    // C++ parsing
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Class definition
      const classMatch = line.match(/^class\s+(\w+)/)
      if (classMatch) {
        entities.push({
          id: `class:${filename}:${classMatch[1]}`,
          name: classMatch[1],
          type: 'class',
          file: filename,
          line: i + 1,
          dependencies: []
        })
      }
      
      // Function definition
      const funcMatch = line.match(/^(?:[\w<>[\]]+\s+)?(\w+)\s*\([^)]*\)/)
      if (funcMatch) {
        entities.push({
          id: `function:${filename}:${funcMatch[1]}`,
          name: funcMatch[1],
          type: 'function',
          file: filename,
          line: i + 1,
          dependencies: []
        })
      }
      
      // Include statements
      const includeMatch = line.match(/^#include\s+[<"]([^>"]+)[>"]/)
      if (includeMatch) {
        const fileEntity = entities.find(e => e.id === `file:${filename}`)
        if (fileEntity) {
          fileEntity.dependencies.push(`module:${includeMatch[1]}`)
        }
      }
    }
  }
  
  return entities
}

// Build graph from parsed entities with enhanced relationship detection
function buildGraph(entities: CodeEntity[]): GraphData {
  const nodes = entities.map(entity => ({
    id: entity.id,
    label: entity.name,
    type: entity.type,
    file: entity.file,
    line: entity.line
  }))
  
  const edges: GraphData['edges'] = []
  const nodeMap = new Map(entities.map(entity => [entity.id, entity]))
  
  // Process dependencies and create edges
  for (const entity of entities) {
    for (const dep of entity.dependencies) {
      // Check if the dependency target exists as a node
      const targetExists = nodeMap.has(dep) || entities.some(e => e.id === dep)
      
      if (targetExists) {
        edges.push({
          source: entity.id,
          target: dep,
          type: 'import'
        })
      } else {
        // Create a module node for external dependencies
        const moduleName = dep.replace('module:', '')
        const moduleId = `module:${moduleName}`
        
        // Add module node if it doesn't exist
        if (!nodes.find(n => n.id === moduleId)) {
          nodes.push({
            id: moduleId,
            label: moduleName,
            type: 'module',
            file: undefined,
            line: undefined
          })
        }
        
        edges.push({
          source: entity.id,
          target: moduleId,
          type: 'import'
        })
      }
    }
  }
  
  // Add containment relationships (functions/classes in files)
  for (const entity of entities) {
    if (entity.type === 'function' || entity.type === 'class') {
      const fileEntity = entities.find(e => e.id === `file:${entity.file}`)
      if (fileEntity) {
        edges.push({
          source: fileEntity.id,
          target: entity.id,
          type: 'contain'
        })
      }
    }
  }
  
  // Add inheritance relationships
  for (const entity of entities) {
    if (entity.type === 'class' && entity.dependencies.length > 0) {
      for (const dep of entity.dependencies) {
        if (!dep.startsWith('module:')) {
          // This is likely an inheritance relationship
          const targetExists = nodeMap.has(dep) || entities.some(e => e.id === dep)
          if (targetExists) {
            edges.push({
              source: entity.id,
              target: dep,
              type: 'inherit'
            })
          }
        }
      }
    }
  }
  
  return { nodes, edges }
}

// Create HTML visualization interface
function createVisualizationHTML(graphData: GraphData, repoName: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Codebase Visualization - ${repoName}</title>
    <script src="https://unpkg.com/cytoscape@3.28.1/dist/cytoscape.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
            color: #ffffff;
            overflow: hidden;
        }
        
        .container {
            display: flex;
            height: 100vh;
        }
        
        .graph-container {
            flex: 1;
            position: relative;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
        }
        
        #cy {
            width: 100%;
            height: 100%;
            background: transparent;
        }
        
        .sidebar {
            width: 200px;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            border-left: 1px solid rgba(255, 255, 255, 0.05);
            padding: 15px;
            overflow-y: auto;
            box-shadow: -2px 0 10px rgba(0, 0, 0, 0.2);
        }
        
        .search-container {
            margin-bottom: 15px;
            position: relative;
        }
        
        .search-container input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.03);
            color: #fff;
            font-size: 12px;
            transition: all 0.2s ease;
            box-sizing: border-box;
        }
        
        .search-container input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.3);
            background: rgba(255, 255, 255, 0.05);
        }
        
        .search-container input::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }
        
        .filter-container {
            margin-bottom: 15px;
        }
        
        .filter-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-bottom: 10px;
        }
        
        .filter-btn {
            padding: 4px 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.02);
            color: rgba(255, 255, 255, 0.7);
            font-size: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            user-select: none;
        }
        
        .filter-btn:hover {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.2);
        }
        
        .filter-btn.active {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.3);
            color: white;
        }
        
        .stats {
            margin-bottom: 15px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .stats h3 {
            margin: 0 0 8px 0;
            font-size: 12px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.8);
        }
        
        .stats p {
            margin: 4px 0;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
        }
        
        .node-types {
            margin-bottom: 15px;
        }
        
        .node-types h3 {
            margin: 0 0 8px 0;
            font-size: 12px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.8);
        }
        
        .node-type {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
            font-size: 10px;
            padding: 4px 6px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.02);
            transition: background 0.2s ease;
        }
        
        .node-type:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .node-type .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        
        .node-type.function .dot { background: linear-gradient(135deg, #E91E63, #C2185B); }
        .node-type.class .dot { background: linear-gradient(135deg, #2196F3, #1976D2); }
        .node-type.module .dot { background: linear-gradient(135deg, #4CAF50, #388E3C); }
        .node-type.file .dot { background: linear-gradient(135deg, #9C27B0, #7B1FA2); }
        
        .edge-types {
            margin-bottom: 15px;
        }
        
        .edge-types h3 {
            margin: 0 0 8px 0;
            font-size: 12px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.8);
        }
        
        .edge-type {
            display: flex;
            align-items: center;
            margin-bottom: 6px;
            font-size: 10px;
            padding: 4px 6px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.02);
            transition: background 0.2s ease;
        }
        
        .edge-type:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .edge-type .line {
            width: 16px;
            height: 2px;
            margin-right: 8px;
            border-radius: 1px;
        }
        
        .edge-type .line { background: linear-gradient(90deg, #666, #888); }
        
        .details {
            padding: 10px;
            background: rgba(255, 255, 255, 0.02);
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .details h3 {
            margin: 0 0 8px 0;
            font-size: 12px;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.8);
        }
        
        .details p {
            margin: 4px 0;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.6);
        }
        
        .details .highlight {
            color: rgba(255, 255, 255, 0.9);
            font-weight: 300;
        }
        
        .zoom-controls {
            position: absolute;
            bottom: 25px;
            right: 25px;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            padding: 12px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            gap: 8px;
        }
        
        .zoom-controls button {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        
        .zoom-controls button:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
        }
        
        .zoom-controls button:active {
            transform: scale(0.95);
        }
        
        /* Custom scrollbar */
        .sidebar::-webkit-scrollbar {
            width: 6px;
        }
        
        .sidebar::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 3px;
        }
        
        .sidebar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }
        
        .sidebar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        /* Elastic spring animations */
        @keyframes nodePulse {
            0% { transform: scale(1); }
            25% { transform: scale(1.2); }
            50% { transform: scale(0.9); }
            75% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        @keyframes nodeSpring {
            0% { transform: scale(1) translateY(0); }
            25% { transform: scale(1.1) translateY(-2px); }
            50% { transform: scale(0.95) translateY(1px); }
            75% { transform: scale(1.05) translateY(-1px); }
            100% { transform: scale(1) translateY(0); }
        }
        
        @keyframes edgeSpring {
            0% { width: 1px; opacity: 0.4; }
            50% { width: 2px; opacity: 0.8; }
            100% { width: 1px; opacity: 0.4; }
        }
        
        .node-highlight {
            animation: nodeSpring 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .edge-highlight {
            animation: edgeSpring 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        /* Hover effects with spring */
        .cy-node:hover {
            animation: nodePulse 0.4s ease-in-out;
        }
        
        /* Drag spring animation */
        @keyframes dragSpring {
            0% { transform: scale(1); }
            50% { transform: scale(1.5); }
            100% { transform: scale(1); }
        }
        
        .node-spring {
            animation: dragSpring 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="graph-container">
            <div id="cy"></div>
            <div class="zoom-controls">
                <button onclick="cy.fit()">Fit</button>
                <button onclick="cy.center()">Center</button>
                <button onclick="cy.reset()">Reset</button>
            </div>
        </div>
        
        <div class="sidebar">
            <div class="search-container">
                <input type="text" id="search" placeholder="Search nodes..." onkeyup="filterNodes()">
            </div>
            
            <div class="filter-container">
                <h3>Filters</h3>
                <div class="filter-buttons">
                    <button class="filter-btn function" onclick="toggleFilter('function')">Functions</button>
                    <button class="filter-btn class" onclick="toggleFilter('class')">Classes</button>
                    <button class="filter-btn module" onclick="toggleFilter('module')">Modules</button>
                    <button class="filter-btn file" onclick="toggleFilter('file')">Files</button>
                    <button class="filter-btn" onclick="clearFilters()">Clear All</button>
                </div>
            </div>
            
            <div class="stats">
                <h3>Statistics</h3>
                <p>Total Nodes: <span class="highlight" id="total-nodes">${graphData.nodes.length}</span></p>
                <p>Total Links: <span class="highlight" id="total-links">${graphData.edges.length}</span></p>
                <p>Filtered: <span class="highlight" id="filtered-nodes">${graphData.nodes.length}</span> nodes, <span class="highlight" id="filtered-links">${graphData.edges.length}</span> links</p>
            </div>
            
            <div class="node-types">
                <h3>Node Types</h3>
                <div class="node-type function">
                    <div class="dot"></div>
                    <span>Function (<span id="function-count">0</span>)</span>
                </div>
                <div class="node-type class">
                    <div class="dot"></div>
                    <span>Class (<span id="class-count">0</span>)</span>
                </div>
                <div class="node-type module">
                    <div class="dot"></div>
                    <span>Module (<span id="module-count">0</span>)</span>
                </div>
                <div class="node-type file">
                    <div class="dot"></div>
                    <span>File (<span id="file-count">0</span>)</span>
                </div>
            </div>
            
            <div class="edge-types">
                <h3>Connections</h3>
                <div class="edge-type">
                    <div class="line"></div>
                    <span>Neural Network Style</span>
                </div>
            </div>
            
            <div class="details" id="details">
                <h3>Details</h3>
                <p>Click on a node or link in the graph to view detailed information about it.</p>
            </div>
        </div>
    </div>

    <script>
        const graphData = ${JSON.stringify(graphData)};
        
        // Initialize Cytoscape
        const cy = cytoscape({
            container: document.getElementById('cy'),
            elements: {
                nodes: graphData.nodes.map(node => ({
                    data: {
                        id: node.id,
                        label: node.label,
                        type: node.type,
                        file: node.file,
                        line: node.line
                    }
                })),
                edges: graphData.edges.map(edge => ({
                    data: {
                        id: edge.source + '-' + edge.target,
                        source: edge.source,
                        target: edge.target,
                        type: edge.type
                    }
                }))
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': function(ele) {
                            const type = ele.data('type');
                            switch(type) {
                                case 'function': return '#E91E63'; // Pink
                                case 'class': return '#2196F3'; // Blue
                                case 'module': return '#4CAF50'; // Green
                                case 'file': return '#9C27B0'; // Purple
                                default: return '#666';
                            }
                        },
                        'label': 'data(label)',
                        'color': '#fff',
                        'font-size': '6px',
                        'font-weight': '200',
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'width': 3,
                        'height': 3,
                        'border-width': 0,
                        'border-color': 'transparent',
                        'border-opacity': 0,
                        'text-wrap': 'none',
                        'text-outline-color': 'rgba(0,0,0,0.95)',
                        'text-outline-width': 0.5,
                        'text-outline-opacity': 1,
                        'shadow-blur': 1,
                        'shadow-color': 'rgba(0,0,0,0.2)',
                        'shadow-offset-x': 0,
                        'shadow-offset-y': 0,
                        'text-margin-y': 4
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 1,
                        'line-color': '#666',
                        'target-arrow-color': '#666',
                        'target-arrow-shape': 'none',
                        'curve-style': 'straight',
                        'line-style': 'solid',
                        'opacity': 0.4,
                        'z-index': 0
                    }
                }
            ],
            layout: {
                name: 'cose',
                animate: 'end',
                animationDuration: 2000,
                nodeDimensionsIncludeLabels: false,
                fit: true,
                padding: 20,
                nodeRepulsion: 2000,
                nodeOverlap: 5,
                idealEdgeLength: 25,
                edgeElasticity: 0.6,
                nestingFactor: 0.02,
                gravity: 30,
                numIter: 4000,
                initialTemp: 200,
                coolingFactor: 0.99,
                minTemp: 0.1,
                springLength: 25,
                springCoeff: 0.0008,
                drag: 0.5,
                randomize: true
            }
        });
        
        // Update statistics
        function updateStats() {
            const nodes = cy.nodes();
            const edges = cy.edges();
            
            document.getElementById('total-nodes').textContent = nodes.length;
            document.getElementById('total-links').textContent = edges.length;
            document.getElementById('filtered-nodes').textContent = nodes.length;
            document.getElementById('filtered-links').textContent = edges.length;
            
            // Count by type
            const typeCounts = { function: 0, class: 0, module: 0, file: 0 };
            nodes.forEach(node => {
                const type = node.data('type');
                if (typeCounts.hasOwnProperty(type)) {
                    typeCounts[type]++;
                }
            });
            
            document.getElementById('function-count').textContent = typeCounts.function;
            document.getElementById('class-count').textContent = typeCounts.class;
            document.getElementById('module-count').textContent = typeCounts.module;
            document.getElementById('file-count').textContent = typeCounts.file;
        }
        
        // Enhanced filtering system
        let activeFilters = new Set();
        
        // Filter nodes by search term
        function filterNodes() {
            const searchTerm = document.getElementById('search').value.toLowerCase();
            
            cy.nodes().forEach(node => {
                const label = node.data('label').toLowerCase();
                const type = node.data('type');
                const matchesSearch = label.includes(searchTerm);
                const matchesFilter = activeFilters.size === 0 || activeFilters.has(type);
                const isVisible = matchesSearch && matchesFilter;
                
                node.style('opacity', isVisible ? 1 : 0.2);
                node.style('z-index', isVisible ? 1 : 0);
            });
            
            cy.edges().forEach(edge => {
                const sourceVisible = edge.source().style('opacity') > 0.5;
                const targetVisible = edge.target().style('opacity') > 0.5;
                edge.style('opacity', sourceVisible && targetVisible ? 0.7 : 0.1);
            });
            
            updateFilteredCounts();
        }
        
        // Toggle filter for node types
        function toggleFilter(type) {
            const btn = document.querySelector(\`.filter-btn.\${type}\`);
            if (activeFilters.has(type)) {
                activeFilters.delete(type);
                btn.classList.remove('active');
            } else {
                activeFilters.add(type);
                btn.classList.add('active');
            }
            filterNodes();
        }
        
        // Clear all filters
        function clearFilters() {
            activeFilters.clear();
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            document.getElementById('search').value = '';
            filterNodes();
        }
        
        // Update filtered counts
        function updateFilteredCounts() {
            const visibleNodes = cy.nodes().filter(node => node.style('opacity') > 0.5);
            const visibleEdges = cy.edges().filter(edge => edge.style('opacity') > 0.5);
            
            document.getElementById('filtered-nodes').textContent = visibleNodes.length;
            document.getElementById('filtered-links').textContent = visibleEdges.length;
        }
        
        // Node click handler with spring animation feedback
        cy.on('tap', 'node', function(evt) {
            const node = evt.target;
            const details = document.getElementById('details');
            
            // Add spring animation feedback
            node.addClass('node-highlight');
            setTimeout(() => node.removeClass('node-highlight'), 800);
            
            // Highlight connected edges with spring effect
            const connectedEdges = node.connectedEdges();
            connectedEdges.addClass('edge-highlight');
            setTimeout(() => connectedEdges.removeClass('edge-highlight'), 800);
            
            // Add spring effect to connected nodes
            const connectedNodes = node.neighborhood().nodes();
            connectedNodes.forEach((neighbor, index) => {
                setTimeout(() => {
                    neighbor.addClass('node-highlight');
                    setTimeout(() => neighbor.removeClass('node-highlight'), 600);
                }, index * 50);
            });
            
            details.innerHTML = \`
                <h3>Node Details</h3>
                <p><strong>Name:</strong> <span class="highlight">\${node.data('label')}</span></p>
                <p><strong>Type:</strong> <span class="highlight">\${node.data('type')}</span></p>
                \${node.data('file') ? \`<p><strong>File:</strong> <span class="highlight">\${node.data('file')}</span></p>\` : ''}
                \${node.data('line') ? \`<p><strong>Line:</strong> <span class="highlight">\${node.data('line')}</span></p>\` : ''}
                <p><strong>ID:</strong> <span class="highlight">\${node.id()}</span></p>
                <p><strong>Connections:</strong> <span class="highlight">\${connectedEdges.length}</span> edges</p>
                <p><strong>Neighbors:</strong> <span class="highlight">\${connectedNodes.length}</span> nodes</p>
            \`;
        });
        
        // Edge click handler
        cy.on('tap', 'edge', function(evt) {
            const edge = evt.target;
            const details = document.getElementById('details');
            
            details.innerHTML = \`
                <h3>Edge Details</h3>
                <p><strong>Type:</strong> \${edge.data('type')}</p>
                <p><strong>From:</strong> \${edge.source().data('label')}</p>
                <p><strong>To:</strong> \${edge.target().data('label')}</p>
            \`;
        });
        
        // Initialize with spring animation
        updateStats();
        
        // Add spring animation on graph load
        setTimeout(() => {
            cy.nodes().forEach((node, index) => {
                setTimeout(() => {
                    node.addClass('node-highlight');
                    setTimeout(() => node.removeClass('node-highlight'), 600);
                }, index * 20);
            });
        }, 1000);
        
        // Spring animation for dragging nodes
        cy.on('drag', 'node', function(evt) {
            const node = evt.target;
            node.addClass('node-highlight');
        });
        
        cy.on('dragfree', 'node', function(evt) {
            const node = evt.target;
            setTimeout(() => node.removeClass('node-highlight'), 300);
        });
        
        // Spring effect when nodes are moved
        cy.on('position', 'node', function(evt) {
            const node = evt.target;
            node.addClass('node-spring');
            setTimeout(() => node.removeClass('node-spring'), 500);
        });
    </script>
</body>
</html>
  `
}

// Start visualization server
function startVisualizationServer(graphData: GraphData, repoName: string, port: number = 3001) {
  return new Promise<void>((resolve, reject) => {
    const html = createVisualizationHTML(graphData, repoName)
    
    const server = createServer((req, res) => {
      // Handle CORS
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200)
        res.end()
        return
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    })
    
    server.listen(port, () => {
      currentPort = port
      safeLog(`🌐 Visualization server started at http://localhost:${port}`)
      resolve()
    })
    
    server.on('error', (err) => {
      if ((err as any).code === 'EADDRINUSE') {
        safeLog(`⚠️ Port ${port} is already in use. Trying port ${port + 1}`, 'warn')
        startVisualizationServer(graphData, repoName, port + 1)
          .then(resolve)
          .catch(reject)
      } else {
        reject(err)
      }
    })
    
    // Store server reference for cleanup
    visualizationServer = server
  })
}

// Stop visualization server
function stopVisualizationServer() {
  if (visualizationServer) {
    visualizationServer.close()
    visualizationServer = null
    safeLog('🛑 Visualization server stopped')
  }
}

export function registerVisualizerTools({ mcp }: McpToolContext): void {
  mcp.tool(
    'visualizer',
    'Codebase visualization tool that parses repositories and creates interactive graph visualizations in the browser',
    {
      action: z.enum(['visualize', 'stop']).describe('Action to perform'),
      repository: z.string().optional().describe('Repository name in owner/repo format (e.g., NURJAKS/qqq)'),
      port: z.number().optional().default(3001).describe('Port for the visualization server'),
    },
    async ({ action, repository, port = 3001 }) => {
      try {
        if (!repositoryIndexer) {
          throw new Error('Repository indexer not initialized')
        }

        switch (action) {
          case 'visualize':
            return await handleVisualizeRepository(repository, port)
          
          case 'stop':
            return await handleStopVisualization()
          
          default:
            return {
              content: [{
                type: 'text' as const,
                text: `❌ Invalid action: ${action}\n\nAvailable actions: visualize, stop`,
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ Visualizer error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          }],
        }
      }
    },
  )
}

async function handleVisualizeRepository(repository?: string, port: number = 3001) {
  if (!repository) {
    return {
      content: [{
        type: 'text' as const,
        text: '❌ Repository name is required. Usage: visualize NURJAKS/qqq',
      }],
    }
  }

  try {
    safeLog(`🔍 Starting visualization for repository: ${repository}`)
    
    // Check if repository exists in indexed repositories
    const indexedRepos = await repositoryIndexer?.listRepositories()
    if (!indexedRepos) {
      return {
        content: [{
          type: 'text' as const,
          text: '❌ Failed to list repositories. Repository indexer may not be initialized.',
        }],
      }
    }
    
    const repoExists = indexedRepos.some(repo => `${repo.owner}/${repo.repo}` === repository)
    
    if (!repoExists) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Repository "${repository}" not found in indexed repositories. Please index it first using the repository_tools.\n\nAvailable repositories:\n${indexedRepos.map(repo => `- ${repo.owner}/${repo.repo}`).join('\n')}`,
        }],
      }
    }

    // Get repository data
    const repoData = await repositoryIndexer?.checkRepositoryStatus(repository)
    if (!repoData) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ Failed to get repository data for "${repository}"`,
        }],
      }
    }

    safeLog(`📁 Found repository: ${repoData.owner}/${repoData.repo} (ID: ${repoData.id})`)

    // Get indexed files from database
    const indexedFiles = await repositoryIndexer?.getIndexedFiles(repoData.id)
    if (!indexedFiles || indexedFiles.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `❌ No indexed files found for repository "${repository}". Please ensure the repository has been indexed first.`,
        }],
      }
    }

    safeLog(`📄 Processing ${indexedFiles.length} indexed files`)

    // Parse code files and build graph
    const entities: CodeEntity[] = []
    let processedFiles = 0
    
    // Process indexed files
    for (const file of indexedFiles) {
      if (file.content) {
        try {
          const fileEntities = parseCodeFile(file.content, file.path)
          entities.push(...fileEntities)
          processedFiles++
        } catch (error) {
          safeLog(`⚠️ Failed to parse file ${file.path}: ${error}`, 'warn')
        }
      }
    }

    safeLog(`🔍 Parsed ${entities.length} code entities from ${processedFiles} files`)

    // Build graph
    const graphData = buildGraph(entities)
    
    safeLog(`📊 Built graph with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`)
    
    // Stop existing server if running
    stopVisualizationServer()
    
    // Start new visualization server
    await startVisualizationServer(graphData, repository, port)
    
    return {
      content: [{
        type: 'text' as const,
        text: `✅ Visualization started for repository "${repository}"\n\n🌐 Open your browser and navigate to: http://localhost:${currentPort}\n\n📊 Graph contains ${graphData.nodes.length} nodes and ${graphData.edges.length} edges\n\n📁 Processed ${processedFiles} files with ${entities.length} code entities\n\nUse the "stop" action to stop the visualization server.`,
      }],
    }
  } catch (error) {
    safeLog(`❌ Visualization error: ${error}`, 'error')
    return {
      content: [{
        type: 'text' as const,
        text: `❌ Failed to visualize repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
    }
  }
}

async function handleStopVisualization() {
  stopVisualizationServer()
  
  return {
    content: [{
      type: 'text' as const,
      text: '✅ Visualization server stopped',
    }],
  }
} 