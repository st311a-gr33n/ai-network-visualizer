import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { GraphData, NodeData, LinkData } from '../types';

interface NetworkGraphProps {
  data: GraphData;
  hoveredNodeId: string | null;
  // FIX: Updated the type to allow functional state updates.
  setHoveredNodeId: React.Dispatch<React.SetStateAction<string | null>>;
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

const NetworkGraph: React.FC<NetworkGraphProps> = ({ data, hoveredNodeId, setHoveredNodeId }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, NodeData, SVGGElement, unknown> | null>(null);

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
    const nodes = data.nodes.map(d => ({...d}));

    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('x', d3.forceX())
      .force('y', d3.forceY());

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

    node.append("text")
        .style("font-family", "'FiraCode Nerd Font', monospace")
        .style("font-size", "16px")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", d => roleColors[d.role] || roleColors['default'])
        .text(d => roleIcons[d.role] || roleIcons['default']);


    node.append("text")
        .text(d => d.name)
        .attr('x', 12)
        .attr('y', 4)
        .attr('fill', '#e0e0e0') // gray-200
        .style('font-size', '10px')
        .style('pointer-events', 'none');
        
    node.append("title")
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
        });

    svg.call(zoom);

  }, [data, dimensions, setHoveredNodeId]);

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

  return <svg ref={svgRef} className="w-full h-full"></svg>;
};

export default NetworkGraph;
