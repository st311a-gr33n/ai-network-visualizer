import React, { useMemo, useRef, useEffect, useState } from 'react';
import type { NodeData, LinkData } from '../types';
import { ChevronDownIcon, PlusIcon, TrashIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from './Icons';

interface AnalysisPanelProps {
  nodes: NodeData[];
  links: LinkData[];
  hoveredNodeId: string | null;
  setHoveredNodeId: (id: string | null) => void;
  isEditMode: boolean;
  onNodeUpdate: (node: NodeData) => void;
  onNodeDelete: (nodeId: string) => void;
  onLinksUpdate: (sourceNodeId: string, targetIds: Set<string>) => void;
  expandedNodes: Set<string>;
  onToggleNodeExpansion: (nodeId: string) => void;
  onNodeAdd: () => void;
  isLiveModeActive?: boolean;
}

const ROLES = ['Router', 'Access Point', 'Switch', 'Server', 'Client', 'Smartphone', 'Tablet', 'Laptop', 'PC', 'Printer', 'Webcam', 'NAS', 'Firewall', 'ONT', 'Scanner', 'Other'];

const roleIcons: { [key: string]: string } = {
  'Server': '',
  'Router': '󰀃',
  'Access Point': '󰀃',
  'ONT': '󰖟',
  'Firewall': '󱨑',
  'Printer': '󰐪',
  'Smartphone': '',
  'Tablet': '',
  'Laptop': '',
  'PC': '',
  'Switch': '󰓤',
  'Webcam': '󰖠',
  'NAS': '󰣳',
  'Scanner': '󰘤',
  'Client': '', // Fallback
  'Other': '',
  'default': ''
};

// Priority order for role selection when a device has multiple roles
// ONT is highest priority, then other infrastructure devices
const rolePriority = [
  'ONT', 'Router', 'Firewall', 'Switch', 'Access Point', 'Server', 'NAS',
  'Printer', 'Scanner', 'Webcam', 'PC', 'Laptop', 'Tablet', 'Smartphone', 'Client', 'Other'
];

/**
 * Extracts the best matching role from a role string that may contain multiple roles.
 * Prioritizes ONT, then other infrastructure roles.
 */
function getBestRole(roleString: string): string {
  if (!roleString) return 'Other';

  // If exact match exists, use it
  if (roleIcons[roleString]) return roleString;

  // Split by common separators and trim
  const roles = roleString.split(/[,\/&]/).map(r => r.trim());

  // Find the highest priority role
  for (const priorityRole of rolePriority) {
    if (roles.some(r => r.toLowerCase() === priorityRole.toLowerCase())) {
      return priorityRole;
    }
  }

  // Fallback: check if any part matches a known role (partial match)
  for (const priorityRole of rolePriority) {
    if (roles.some(r => r.toLowerCase().includes(priorityRole.toLowerCase()))) {
      return priorityRole;
    }
  }

  return 'Other';
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    nodes,
    links,
    hoveredNodeId,
    setHoveredNodeId,
    isEditMode,
    onNodeUpdate,
    onNodeDelete,
    onLinksUpdate,
    expandedNodes,
    onToggleNodeExpansion,
    onNodeAdd,
    isLiveModeActive = false,
}) => {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const prevNodeCount = useRef(nodes.length);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (listContainerRef.current && nodes.length > prevNodeCount.current) {
        // A node was added, scroll to the bottom.
        setTimeout(() => {
            if (listContainerRef.current) {
               listContainerRef.current.scrollTop = listContainerRef.current.scrollHeight;
            }
        }, 100); // Timeout allows the DOM to update before scrolling
    }
    prevNodeCount.current = nodes.length;
  }, [nodes.length]);


  const nodeConnections = useMemo(() => {
    const connections = new Map<string, Set<string>>();
    nodes.forEach(node => connections.set(node.id, new Set()));
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeData).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeData).id;
      connections.get(sourceId)?.add(targetId);
      connections.get(targetId)?.add(sourceId);
    });
    return connections;
  }, [nodes, links]);
  
  const sortedNodes = useMemo(() => {
    if (!nodes || nodes.length === 0 || !links) {
      return [...nodes].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    const nodesMap = new Map(nodes.map(node => [node.id, node]));
    const adj = new Map<string, string[]>();
    nodes.forEach(node => adj.set(node.id, []));

    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeData).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeData).id;
      if (adj.has(sourceId) && adj.has(targetId)) {
        adj.get(sourceId)!.push(targetId);
        adj.get(targetId)!.push(sourceId);
      }
    });

    const sorted: NodeData[] = [];
    const visited = new Set<string>();

    const findRoot = () => {
      // Handle multi-role devices by checking if any role matches
      return nodes.find(n => getBestRole(n.role) === 'ONT') ||
             nodes.find(n => getBestRole(n.role) === 'Router') ||
             nodes.find(n => getBestRole(n.role) === 'Firewall');
    };

    let rootNode = findRoot();
    
    const traverse = (startNodeId: string) => {
      const queue: string[] = [startNodeId];
      visited.add(startNodeId);
      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = nodesMap.get(nodeId);
        if (node) {
          sorted.push(node);
        }
        const neighbors = adj.get(nodeId) || [];
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        }
      }
    };

    if (rootNode) {
      traverse(rootNode.id);
    }
    
    // Traverse any other disconnected components
    for (const node of nodes) {
        if (!visited.has(node.id)) {
            traverse(node.id);
        }
    }
    
    return sorted;
  }, [nodes, links]);

  const getRoleStyle = (role: string) => {
    const bestRole = getBestRole(role);
    switch(bestRole) {
        case 'Router':
        case 'Access Point':
        case 'Switch':
            return 'border-accent';
        case 'ONT':
            return 'border-ont';
        case 'Firewall':
            return 'border-firewall';
        case 'Scanner':
            return 'border-scanner';
        case 'Server':
            return 'border-server';
        default:
            return 'border-other';
    }
  };

  const getRoleIcon = (role: string) => {
    const bestRole = getBestRole(role);
    const iconChar = roleIcons[bestRole] || roleIcons['default'];
    return (
      <span className="font-nerd text-xl text-gray-400 w-5 h-5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
        {iconChar}
      </span>
    );
  };


  return (
    <aside className={`absolute top-4 right-4 bottom-24 flex-shrink-0 backdrop-blur-md bg-gray-900/50 rounded-lg shadow-lg flex flex-col overflow-hidden border border-gray-700/50 z-10 transition-all duration-300 ${isCollapsed ? 'w-14' : 'w-80'}`}>
      {/* Header */}
      <div className={`p-3 border-b border-gray-700/50 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
        {!isCollapsed && (
          <h2 className="text-base font-bold text-gray-200">Devices ({nodes.length})</h2>
        )}
        <div className={`flex items-center ${isCollapsed ? '' : 'gap-2'}`}>
          {!isCollapsed && isEditMode && (
            <button
              onClick={onNodeAdd}
              className="flex items-center gap-1.5 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-md transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-full hover:bg-gray-700/50 transition-colors"
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? (
              <PanelLeftOpenIcon className="w-5 h-5 text-gray-400" />
            ) : (
              <PanelLeftCloseIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Device List */}
      <div ref={listContainerRef} className={`flex-grow overflow-y-auto ${isCollapsed ? 'p-1 space-y-1' : 'p-2 space-y-2'}`}>
        {sortedNodes.map((node) => {
          const isExpanded = expandedNodes.has(node.id);
          const currentConnections = nodeConnections.get(node.id) || new Set();

          const handleConnectionChange = (targetId: string, isChecked: boolean) => {
            const newConnections = new Set(currentConnections);
            if (isChecked) {
              newConnections.add(targetId);
            } else {
              newConnections.delete(targetId);
            }
            onLinksUpdate(node.id, newConnections);
          };

          // Collapsed compact view
          if (isCollapsed) {
            const handleCollapsedCardClick = () => {
              setIsCollapsed(false);
              // Ensure the node card is expanded after panel opens
              if (!expandedNodes.has(node.id)) {
                onToggleNodeExpansion(node.id);
              }
            };

            return (
              <div
                key={node.id}
                className={`p-2 bg-gray-800/60 rounded-md border-l-4 ${getRoleStyle(node.role)} transition-all duration-200 ${node.id === hoveredNodeId ? 'bg-gray-700/80' : ''} flex items-center justify-center cursor-pointer relative`}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={handleCollapsedCardClick}
                title={`${node.name}${node.ipAddress ? ` (${node.ipAddress})` : ''}${isLiveModeActive && node.liveStatus ? ` - ${node.liveStatus}` : ''}`}
              >
                {getRoleIcon(node.role)}
                {/* Live Status Indicator for collapsed view */}
                {isLiveModeActive && node.liveStatus && node.liveStatus !== 'unknown' && (
                  <span
                    className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                      node.liveStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                )}
              </div>
            );
          }

          // Expanded full view
          return (
            <div
              key={node.id}
              className={`p-3 bg-gray-800/60 rounded-md border-l-4 ${getRoleStyle(node.role)} transition-all duration-200 ${node.id === hoveredNodeId ? 'bg-gray-700/80' : ''}`}
              onMouseEnter={() => setHoveredNodeId(node.id)}
              onMouseLeave={() => setHoveredNodeId(null)}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  {getRoleIcon(node.role)}
                  <p className="text-sm font-semibold text-gray-200 truncate" title={node.name}>{node.name}</p>
                  {/* Live Status Indicator */}
                  {isLiveModeActive && node.liveStatus && node.liveStatus !== 'unknown' && (
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        node.liveStatus === 'online' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      title={`Status: ${node.liveStatus}`}
                    />
                  )}
                </div>
                <button
                  onClick={() => onToggleNodeExpansion(node.id)}
                  className="p-1 rounded-full hover:bg-gray-700/50 transition-colors flex-shrink-0"
                  aria-expanded={isExpanded}
                  aria-controls={`details-${node.id}`}
                >
                  <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Default Visible Info */}
              <div className='mt-2 space-y-2'>
                {node.ipAddress && (
                  <p className="text-xs text-gray-500 truncate" title={node.ipAddress}>IP: <span className="text-gray-400">{node.ipAddress}</span></p>
                )}
                {node.openPorts && node.openPorts.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 font-medium mb-1">Open Ports:</p>
                    <div className="flex flex-wrap gap-1">
                      {node.openPorts.slice(0, 10).map(port => (
                        <span key={port} className="px-1.5 py-0.5 text-xs bg-gray-600 text-gray-300 rounded">
                          {port}
                        </span>
                      ))}
                      {node.openPorts.length > 10 && <span className="px-1.5 py-0.5 text-xs bg-gray-600 text-gray-300 rounded">...</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Collapsible Section */}
              {isExpanded && (
                <div id={`details-${node.id}`} className="mt-3 pt-3 border-t border-gray-700/50 space-y-3 animate-fade-in">
                    {isEditMode ? (
                        <>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Name (Hostname)</label>
                                <input
                                    type="text"
                                    value={node.name || ''}
                                    onChange={(e) => onNodeUpdate({ ...node, name: e.target.value })}
                                    className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md p-1.5 focus:ring-accent focus:border-accent"
                                    placeholder="e.g., My-Router"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Role</label>
                                <select value={node.role} onChange={(e) => onNodeUpdate({ ...node, role: e.target.value })} className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md p-1.5 focus:ring-accent focus:border-accent">
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    {!ROLES.includes(node.role) && <option value={node.role}>{node.role}</option>}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Vendor</label>
                                <input type="text" value={node.vendor || ''} onChange={(e) => onNodeUpdate({ ...node, vendor: e.target.value })} className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md p-1.5 focus:ring-accent focus:border-accent" placeholder="e.g., Apple, Cisco"/>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">IP Address</label>
                                <input type="text" value={node.ipAddress || ''} onChange={(e) => onNodeUpdate({ ...node, ipAddress: e.target.value })} className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-md p-1.5 focus:ring-accent focus:border-accent" placeholder="e.g., 192.168.1.1"/>
                            </div>
                            <p className="text-xs text-gray-500 truncate" title={node.id}>ID: <span className="text-gray-400">{node.id}</span></p>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Connections</label>
                                <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-gray-900/50 rounded-md">
                                    {nodes.filter(n => n.id !== node.id).sort((a,b) => (a.name || '').localeCompare(b.name || '')).map(otherNode => (
                                    <div key={otherNode.id} className="flex items-center">
                                        <input type="checkbox" id={`conn-${node.id}-${otherNode.id}`} checked={currentConnections.has(otherNode.id)} onChange={(e) => handleConnectionChange(otherNode.id, e.target.checked)} className="w-4 h-4 text-accent bg-gray-700 border-gray-600 rounded focus:ring-accent"/>
                                        <label htmlFor={`conn-${node.id}-${otherNode.id}`} className="ml-2 text-xs text-gray-300 truncate">{otherNode.name}</label>
                                    </div>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={() => onNodeDelete(node.id)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-900/50 hover:bg-red-800/70 text-red-300 text-xs rounded-md transition-colors border border-red-800/50"
                            >
                                <TrashIcon className="w-4 h-4" />
                                Delete Device
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-xs text-gray-500">Role: <span className="text-accent">{node.role}</span></p>
                            <p className="text-xs text-gray-500 truncate" title={node.id}>ID: <span className="text-gray-400">{node.id}</span></p>
                            {node.vendor && (<p className="text-xs text-gray-500 truncate" title={node.vendor}>Vendor: <span className="text-gray-400">{node.vendor}</span></p>)}
                            {node.ping && (<p className="text-xs text-gray-500">Ping: <span className="text-gray-400">{node.ping}</span></p>)}
                            {/* Live Mode Status */}
                            {isLiveModeActive && node.liveStatus && (
                              <div className="pt-2 mt-2 border-t border-gray-700/50">
                                <p className="text-xs text-gray-500">
                                  Status:{' '}
                                  <span className={node.liveStatus === 'online' ? 'text-green-400' : node.liveStatus === 'offline' ? 'text-red-400' : 'text-gray-400'}>
                                    {node.liveStatus}
                                  </span>
                                </p>
                                {node.lastSeen && (
                                  <p className="text-xs text-gray-500">
                                    Last seen:{' '}
                                    <span className="text-gray-400">
                                      {new Date(node.lastSeen).toLocaleTimeString()}
                                    </span>
                                  </p>
                                )}
                              </div>
                            )}
                        </>
                    )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default AnalysisPanel;