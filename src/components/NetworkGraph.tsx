import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import type { GraphData, NodeData, LinkData } from '../types';

interface NetworkGraphProps {
  data: GraphData;
  hoveredNodeId: string | null;
  // FIX: Updated the type to allow functional state updates.
  setHoveredNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  isLiveModeActive?: boolean;
}

const roleColors: { [key: string]: string } = {
    'Router': '#55B6C2',
    'Access Point': '#55B6C2',
    'Switch': '#a0a0a0',
    'ONT': '#98C379',
    'Firewall': '#E06B74',
    'Scanner': '#E5C07A',
    'Server': '#E0B8FF',
    'Client': '#a0a0a0',
    'Smartphone': '#a0a0a0',
    'Tablet': '#a0a0a0',
    'Laptop': '#a0a0a0',
    'PC': '#a0a0a0',
    'Printer': '#a0a0a0',
    'Webcam': '#a0a0a0',
    'NAS': '#a0a0a0',
    'Other': '#a0a0a0',
    'default': '#a0a0a0',
};

const roleIcons: { [key: string]: { class: string; fallback: string } } = {
  'Server': { class: 'nf-fa-server', fallback: '' },
  'Router': { class: 'nf-md-access_point', fallback: '󰀃' },
  'Access Point': { class: 'nf-md-access_point', fallback: '󰀃' },
  'ONT': { class: 'nf-md-web', fallback: '󰖟' },
  'Firewall': { class: 'nf-md-wall_fire', fallback: '󱨑' },
  'Printer': { class: 'nf-md-printer', fallback: '󰐪' },
  'Smartphone': { class: 'nf-fa-mobile_phone', fallback: '' },
  'Tablet': { class: 'nf-fa-tablet_screen_button', fallback: '' },
  'Laptop': { class: 'nf-fa-laptop', fallback: '' },
  'PC': { class: 'nf-fa-desktop', fallback: '' },
  'Switch': { class: 'nf-md-switch', fallback: '󰓤' },
  'Webcam': { class: 'nf-md-webcam', fallback: '󰖠' },
  'NAS': { class: 'nf-md-nas', fallback: '󰣳' },
  'Scanner': { class: 'nf-md-line_scan', fallback: '󰘤' },
  'Client': { class: 'nf-weather-na', fallback: '' },
  'Other': { class: 'nf-weather-na', fallback: '' },
  'default': { class: 'nf-weather-na', fallback: '' }
};

// Priority order for role selection when a device has multiple roles
// ONT is highest priority as requested, then infrastructure devices, then others
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

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, hoveredNodeId, setHoveredNodeId, isLiveModeActive = false }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, NodeData, SVGGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);
  const nodesDataRef = useRef<NodeData[]>([]);
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  // Compute a structure signature that only changes when nodes/links are added or removed
  const structureSignature = useMemo(() => {
    const nodeIds = data.nodes.map(n => n.id).sort().join(',');
    const linkIds = data.links.map(l => {
      const sourceId = typeof l.source === 'string' ? l.source : (l.source as NodeData).id;
      const targetId = typeof l.target === 'string' ? l.target : (l.target as NodeData).id;
      return `${sourceId}-${targetId}`;
    }).sort().join(',');
    return `${nodeIds}|${linkIds}`;
  }, [data.nodes, data.links]);

  useEffect(() => {
    const updateDimensions = () => {
        if (svgRef.current) {
            const { width, height } = svgRef.current.parentElement!.getBoundingClientRect();
            setDimensions({ width, height });
        }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Main effect: rebuild graph only when structure changes
  useEffect(() => {
    if (!svgRef.current || !data || dimensions.width === 0) return;

    const { width, height } = dimensions;

    const svg = d3.select(svgRef.current)
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [-width / 2, -height / 2, width, height].join(' '));

    // Clear previous graph
    svg.selectAll("*").remove();

    // Add click handler to background to clear selection
    svg.on('click', () => {
      setHoveredNodeId(null);
    });

    const container = svg.append("g");

    const links = data.links.map(d => ({...d}));
    // Deduplicate nodes by ID to prevent duplicate rendering
    const seenIds = new Set<string>();
    const nodes = data.nodes.filter(d => {
      if (seenIds.has(d.id)) {
        console.warn(`Duplicate node ID detected and filtered: ${d.id}`);
        return false;
      }
      seenIds.add(d.id);
      return true;
    }).map(d => ({...d}));
    nodesDataRef.current = nodes;

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('x', d3.forceX())
      .force('y', d3.forceY());

    simulationRef.current = simulation;

    const link = container.append("g")
        .attr("stroke", "#4b5563") // gray-600
        .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
        .attr("stroke-width", 1); // Thinner lines

    const node = container.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .on('mouseenter', (event, d) => setHoveredNodeId(d.id))
      .on('mouseleave', () => setHoveredNodeId(null))
      .on('click', (event, d) => {
        event.stopPropagation(); // Prevents the svg click handler from firing
        // Toggle selection on tap/click using a functional update
        setHoveredNodeId(prevId => (d.id === prevId ? null : d.id));
      })
      // FIX: Correctly type the d3 drag behavior and remove `as any` to fix type inference issues.
      .call(drag(simulation));

    // Live status ring (shown when in live mode)
    node.append("circle")
        .attr("class", "status-ring")
        .attr("r", 14)
        .attr("fill", "none")
        .attr("stroke", d => {
          if (!isLiveModeActive) return "transparent";
          const status = d.liveStatus;
          if (status === 'online') return "#22c55e"; // green-500
          if (status === 'offline') return "#ef4444"; // red-500
          return "transparent";
        })
        .attr("stroke-width", 2)
        .attr("stroke-opacity", d => {
          if (!isLiveModeActive || !d.liveStatus || d.liveStatus === 'unknown') return 0;
          return 0.8;
        })
        .style("pointer-events", "none");

    // Hover ring
    node.append("circle")
        .attr("class", "hover-ring")
        .attr("r", 12)
        .attr("fill", "none")
        .attr("stroke", "#55B6C2") // accent color
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0)
        .style("pointer-events", "none")
        .style("transition", "stroke-opacity 0.2s ease-in-out");

    // Icon with CSS class and fallback
    node.append("text")
        .attr("class", d => {
          const bestRole = getBestRole(d.role);
          const icon = roleIcons[bestRole] || roleIcons['default'];
          return `node-icon ${icon.class}`;
        })
        .style("font-family", "'Symbols Nerd Font', 'FiraCode Nerd Font', monospace")
        .style("font-size", "16px")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", d => {
          const bestRole = getBestRole(d.role);
          return roleColors[bestRole] || roleColors['default'];
        })
        .text(d => {
          const bestRole = getBestRole(d.role);
          const icon = roleIcons[bestRole] || roleIcons['default'];
          return icon.fallback;
        });

    // Label
    node.append("text")
        .attr("class", "node-label")
        .attr('x', 12)
        .attr('y', 4)
        .attr('fill', '#e0e0e0') // gray-200
        .style('font-size', '10px')
        .style('pointer-events', 'none')
        .text(d => d.name);

    // Tooltip
    node.append("title")
        .attr("class", "node-title")
        .text(d => `${d.name} (${d.role})\nID: ${d.id}${d.ipAddress ? `\nIP: ${d.ipAddress}` : ''}`);

    nodeSelectionRef.current = node;

    simulation.on("tick", () => {
      link
          .attr("x1", d => (d.source as NodeData).x!)
          .attr("y1", d => (d.source as NodeData).y!)
          .attr("x2", d => (d.target as NodeData).x!)
          .attr("y2", d => (d.target as NodeData).y!);

      node
          .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on("zoom", (event) => {
            container.attr("transform", event.transform);
            zoomTransformRef.current = event.transform;
        });

    svg.call(zoom);

    // Restore previous zoom transform
    if (zoomTransformRef.current !== d3.zoomIdentity) {
      svg.call(zoom.transform, zoomTransformRef.current);
    }

    // Cleanup simulation on unmount
    return () => {
      simulation.stop();
    };

  }, [structureSignature, dimensions, setHoveredNodeId, isLiveModeActive]);

  // Separate effect: update visual properties without rebuilding the graph
  useEffect(() => {
    if (!nodeSelectionRef.current || !data) return;

    // Create a map for quick lookup
    const nodeDataMap = new Map(data.nodes.map(n => [n.id, n]));

    nodeSelectionRef.current.each(function(d) {
      const nodeData = nodeDataMap.get(d.id);
      if (!nodeData) return;

      const nodeGroup = d3.select(this);

      // Update icon
      const bestRole = getBestRole(nodeData.role);
      const icon = roleIcons[bestRole] || roleIcons['default'];
      nodeGroup.select(".node-icon")
        .attr("class", `node-icon ${icon.class}`)
        .attr("fill", roleColors[bestRole] || roleColors['default'])
        .text(icon.fallback);

      // Update label
      nodeGroup.select(".node-label")
        .text(nodeData.name);

      // Update tooltip
      const statusText = nodeData.liveStatus ? `\nStatus: ${nodeData.liveStatus}` : '';
      nodeGroup.select(".node-title")
        .text(`${nodeData.name} (${nodeData.role})\nID: ${nodeData.id}${nodeData.ipAddress ? `\nIP: ${nodeData.ipAddress}` : ''}${statusText}`);

      // Update live status ring
      const status = nodeData.liveStatus;
      nodeGroup.select(".status-ring")
        .attr("stroke", () => {
          if (!isLiveModeActive) return "transparent";
          if (status === 'online') return "#22c55e";
          if (status === 'offline') return "#ef4444";
          return "transparent";
        })
        .attr("stroke-opacity", () => {
          if (!isLiveModeActive || !status || status === 'unknown') return 0;
          return 0.8;
        });
    });

  }, [data, isLiveModeActive]);

  useEffect(() => {
    if (!nodeSelectionRef.current) return;
    
    nodeSelectionRef.current.select(".hover-ring")
        .attr("stroke-opacity", d => d.id === hoveredNodeId ? 1 : 0);

  }, [hoveredNodeId]);
  
  const drag = (simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) => {
    function dragstarted(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event: d3.D3DragEvent<SVGGElement, NodeData, NodeData>, d: NodeData) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    return d3.drag<SVGGElement, NodeData>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
  }

  return <svg ref={svgRef} className="w-full h-full" style={{ touchAction: 'none' }}></svg>;
};

export default NetworkGraph;