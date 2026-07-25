

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { analyzeNetworkLog } from './services/geminiService';
import { parseNmapXml, nmapToStructuredText } from './services/nmapParser';
import { convertNmapToGraphData, mergeNmapWithGraphData } from './services/graphConverter';
import {
  parseLiveScanResult,
  extractHostsFromXml,
  updateGraphWithLiveData,
  resetLiveStatus,
  inferNetworkTarget,
} from './services/liveScanService';
import type { GraphData, LinkData, NodeData, AIConfig } from './types';
import FileUpload from './components/FileUpload';
import NetworkGraph from './components/NetworkGraph';
import AnalysisPanel from './components/AnalysisPanel';
import Loader from './components/Loader';
import SettingsModal from './components/SettingsModal';
import PrivacyNoticeModal from './components/PrivacyNoticeModal';
import LiveModePanel from './components/LiveModePanel';
import DotGridBackground from './components/DotGridBackground';
import { UploadIcon, PlusIcon, DownloadIcon, PencilIcon, GearIcon, PrivacyIcon, SignalIcon } from './components/Icons';
import './nerd-font-icons.css';
import appLogoSvg from './public/trayicon_AI.svg';

const demoData: GraphData = {
  "nodes": [
    {
      "id": "B7:D3:E0:F4:A5:C8",
      "name": "Router-B",
      "role": "Router",
      "ipAddress": "192.168.1.100",
      "macAddress": "B7:D3:E0:F4:A5:C8",
      "vendor": "Netgear",
      "openPorts": [],
      "ping": "1 ms"
    },
    {
      "id": "F1:2B:C9:7E:3D:A8",
      "name": "Printer-2",
      "role": "Printer",
      "ipAddress": "192.168.1.68",
      "macAddress": "F1:2B:C9:7E:3D:A8",
      "vendor": "HP",
      "openPorts": [],
      "ping": "0 ms"
    },
    {
      "id": "67:89:AB:CD:12:54",
      "name": "Switch-C",
      "role": "Switch",
      "ipAddress": "192.168.1.70",
      "macAddress": "67:89:AB:CD:12:54",
      "vendor": "Cisco",
      "openPorts": [],
      "ping": "1 ms"
    },
    {
      "id": "E3:C1:F5:D8:B9:A7",
      "name": "Server-2",
      "role": "Server",
      "ipAddress": "192.168.1.69",
      "macAddress": "E3:C1:F5:D8:B9:A7",
      "vendor": "Dell",
      "openPorts": [],
      "ping": "1 ms"
    },
    {
      "id": "A9:D5:E1:F7:93:B2",
      "name": "ONT-1",
      "role": "ONT",
      "ipAddress": "192.168.1.129",
      "macAddress": "A9:D5:E1:F7:93:B2",
      "vendor": "ZTE",
      "openPorts": [],
      "ping": "0 ms"
    },
    {
      "id": "D4:F1:B8:A3:59:C6",
      "name": "NAS-4",
      "role": "NAS",
      "ipAddress": "192.168.1.66",
      "macAddress": "D4:F1:B8:A3:59:C6",
      "vendor": "Synology",
      "openPorts": [
        "80",
        "443"
      ],
      "ping": "2000 ms"
    },
    {
      "id": "E3:F2:D0:A7:B5:9C",
      "name": "Webcam-3",
      "role": "Webcam",
      "ipAddress": "192.168.1.102",
      "macAddress": "E3:F2:D0:A7:B5:9C",
      "vendor": "Logitech",
      "openPorts": [
        "80",
        "443",
        "8080"
      ],
      "ping": "2000 ms"
    },
    {
      "id": "A4:9B:E6:C3:F1:7D",
      "name": "Firewall-1",
      "role": "Firewall",
      "ipAddress": "192.168.1.104",
      "macAddress": "A4:9B:E6:C3:F1:7D",
      "vendor": "SonicWall",
      "openPorts": [
        "80",
        "443",
        "8080"
      ],
      "ping": "2000 ms"
    },
    {
      "id": "B5:A1:E9:C2:F0:D8",
      "name": "Router-3",
      "role": "Router",
      "ipAddress": "192.168.1.254",
      "macAddress": "B5:A1:E9:C2:F0:D8",
      "vendor": "TP-Link",
      "openPorts": [],
      "ping": "0 ms"
    }
  ],
  "links": [
    {
      "source": "A4:9B:E6:C3:F1:7D",
      "target": "A9:D5:E1:F7:93:B2"
    },
    {
      "source": "B7:D3:E0:F4:A5:C8",
      "target": "A4:9B:E6:C3:F1:7D"
    },
    {
      "source": "67:89:AB:CD:12:54",
      "target": "67:89:AB:CD:12:54"
    },
    {
      "source": "67:89:AB:CD:12:54",
      "target": "F1:2B:C9:7E:3D:A8"
    },
    {
      "source": "67:89:AB:CD:12:54",
      "target": "D4:F1:B8:A3:59:C6"
    },
    {
      "source": "67:89:AB:CD:12:54",
      "target": "E3:C1:F5:D8:B9:A7"
    },
    {
      "source": "67:89:AB:CD:12:54",
      "target": "E3:F2:D0:A7:B5:9C"
    },
    {
      "source": "B5:A1:E9:C2:F0:D8",
      "target": "A4:9B:E6:C3:F1:7D"
    },
    {
      "source": "B5:A1:E9:C2:F0:D8",
      "target": "67:89:AB:CD:12:54"
    }
  ]
};

const App: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isPrivacyNoticeOpen, setIsPrivacyNoticeOpen] = useState<boolean>(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Live Mode State
  const [isLiveModeOpen, setIsLiveModeOpen] = useState<boolean>(false);
  const [isLiveModeActive, setIsLiveModeActive] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [nmapAvailable, setNmapAvailable] = useState<boolean | null>(null);
  const [nmapError, setNmapError] = useState<string | null>(null);
  const [defaultScanTarget, setDefaultScanTarget] = useState<string>('192.168.1.0/24');

  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    try {
      const savedConfig = localStorage.getItem('aiConfig');
      if (savedConfig) {
        return JSON.parse(savedConfig);
      }
    } catch (e) {
      console.error("Failed to parse AI config from localStorage", e);
    }
    return { provider: 'local' };
  });

  const mergeFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
        localStorage.setItem('aiConfig', JSON.stringify(aiConfig));
    } catch (e) {
        console.error("Failed to save AI config to localStorage", e);
    }
  }, [aiConfig]);

  // Check nmap availability on mount (Electron only)
  useEffect(() => {
    const checkNmap = async () => {
      if (window.electronAPI?.nmapCheck) {
        try {
          const result = await window.electronAPI.nmapCheck();
          setNmapAvailable(result.available);
          if (!result.available && result.error) {
            setNmapError(result.error);
          }
        } catch (e) {
          setNmapAvailable(false);
          setNmapError('Failed to check nmap availability');
        }
      }
    };
    checkNmap();
  }, []);

  // Update default scan target when graph data changes
  useEffect(() => {
    if (graphData && graphData.nodes.length > 0) {
      setDefaultScanTarget(inferNetworkTarget(graphData));
    }
  }, [graphData]);

  // Set up live scan event listeners
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubResult = window.electronAPI.onLiveScanResult?.((data) => {
      setLastScanTime(data.timestamp);

      // Parse the scan result
      const liveScanResult = parseLiveScanResult(data.xmlOutput);
      const nmapResult = extractHostsFromXml(data.xmlOutput);

      // Update graph data with live status
      setGraphData(prevData => {
        if (!prevData) return null;
        return updateGraphWithLiveData(prevData, liveScanResult, nmapResult);
      });
    });

    const unsubError = window.electronAPI.onLiveScanError?.((data) => {
      console.error('Live scan error:', data.error);
      // Optionally show error to user
    });

    const unsubStopped = window.electronAPI.onLiveScanStopped?.(() => {
      setIsLiveModeActive(false);
    });

    return () => {
      unsubResult?.();
      unsubError?.();
      unsubStopped?.();
    };
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError("File is too large. Please upload a file smaller than 10MB.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGraphData(null);
    setFileName(file.name);
    setIsEditMode(false);

    try {
      if (file.name.endsWith('.json')) {
        const fileContent = await file.text();
        const data = JSON.parse(fileContent);

        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
          throw new Error("Invalid network map JSON. File must contain 'nodes' and 'links' arrays.");
        }

        setGraphData(data as GraphData);

      } else {
        const fileContent = await file.text();

        // Check if AI is enabled
        const useAI = aiConfig.useAI !== false; // Default to true

        if (file.name.endsWith('.xml')) {
          // Parse XML file
          const nmapResult = parseNmapXml(fileContent);

          if (useAI) {
            // Use AI for analysis
            const contentForAI = nmapToStructuredText(nmapResult);
            const data = await analyzeNetworkLog(contentForAI, null, aiConfig);

            if (!data || !data.nodes || !data.links) {
              throw new Error("AI analysis returned an invalid format.");
            }

            const nodeIds = new Set(data.nodes.map(n => n.id));
            const validLinks = data.links.filter(link => {
              if (!link || !link.source || !link.target) return false;
              const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
              const targetId = typeof link.target === 'string' ? link.target : link.target.id;
              return nodeIds.has(sourceId) && nodeIds.has(targetId);
            });

            setGraphData({ nodes: data.nodes, links: validLinks });
          } else {
            // No-AI mode: Convert directly using deterministic rules
            const data = convertNmapToGraphData(nmapResult);
            setGraphData(data);
          }
        } else {
          // Non-XML files always use AI
          const data = await analyzeNetworkLog(fileContent, null, aiConfig);

          if (!data || !data.nodes || !data.links) {
            throw new Error("AI analysis returned an invalid format.");
          }

          const nodeIds = new Set(data.nodes.map(n => n.id));
          const validLinks = data.links.filter(link => {
            if (!link || !link.source || !link.target) return false;
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
          });

          setGraphData({ nodes: data.nodes, links: validLinks });
        }
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during analysis.');
      setGraphData(null);
    } finally {
      setIsLoading(false);
    }
  }, [aiConfig]);
  
  const handleLoadDemo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGraphData(null);
    setFileName("Demo Network Map");
    setIsEditMode(false);

    try {
        // Simulate network request for better UX, now using embedded data
        await new Promise(resolve => setTimeout(resolve, 300));

        const data = demoData;

        if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
            throw new Error("Invalid network map JSON in demo file.");
        }

        setGraphData(data as GraphData);

    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while loading the demo.');
        setGraphData(null);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleCreateNew = useCallback(() => {
    setError(null);
    setFileName("New Network Map");
    setIsEditMode(true);
    setExpandedNodes(new Set());
    setGraphData({ nodes: [], links: [] });
  }, []);

  const handleMergeFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !graphData) return;

    event.target.value = ''; // Clear the input to allow re-selecting the same file

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Please upload a file smaller than 10MB.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(prev => `${prev}, ${file.name}`);
    setIsEditMode(false);

    try {
      const fileContent = await file.text();

      // Check if AI is enabled
      const useAI = aiConfig.useAI !== false; // Default to true

      if (file.name.endsWith('.xml')) {
        // Parse XML file
        const nmapResult = parseNmapXml(fileContent);

        if (useAI) {
          // Use AI for merge analysis
          const contentForAI = nmapToStructuredText(nmapResult);
          const mergedGraphData = await analyzeNetworkLog(contentForAI, graphData, aiConfig);

          if (!mergedGraphData || !mergedGraphData.nodes || !mergedGraphData.links) {
            throw new Error("AI analysis returned an invalid format for the merge operation.");
          }

          const nodeIds = new Set(mergedGraphData.nodes.map(n => n.id));
          const validLinks = mergedGraphData.links.filter(link => {
            if (!link || !link.source || !link.target) return false;
            const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
            const targetId = typeof link.target === 'string' ? link.target : link.target.id;
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
          });

          setGraphData({ nodes: mergedGraphData.nodes, links: validLinks });
        } else {
          // No-AI mode: Merge using deterministic rules
          const mergedData = mergeNmapWithGraphData(nmapResult, graphData);
          setGraphData(mergedData);
        }
      } else {
        // Non-XML files always use AI
        const mergedGraphData = await analyzeNetworkLog(fileContent, graphData, aiConfig);

        if (!mergedGraphData || !mergedGraphData.nodes || !mergedGraphData.links) {
          throw new Error("AI analysis returned an invalid format for the merge operation.");
        }

        const nodeIds = new Set(mergedGraphData.nodes.map(n => n.id));
        const validLinks = mergedGraphData.links.filter(link => {
          if (!link || !link.source || !link.target) return false;
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return nodeIds.has(sourceId) && nodeIds.has(targetId);
        });

        setGraphData({ nodes: mergedGraphData.nodes, links: validLinks });
      }

    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during merge analysis.');
    } finally {
      setIsLoading(false);
    }
  }, [graphData, aiConfig]);

  const handleNodeUpdate = useCallback((updatedNode: NodeData) => {
    setGraphData(prevData => {
      if (!prevData) return null;
      const newNodes = prevData.nodes.map(node => node.id === updatedNode.id ? updatedNode : node);
      return { ...prevData, nodes: newNodes };
    });
  }, []);

  const handleNodeDelete = useCallback((nodeId: string) => {
    setGraphData(prevData => {
      if (!prevData) return null;
      const newNodes = prevData.nodes.filter(node => node.id !== nodeId);
      const newLinks = prevData.links.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeData).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeData).id;
        return sourceId !== nodeId && targetId !== nodeId;
      });
      return { ...prevData, nodes: newNodes, links: newLinks };
    });
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      newSet.delete(nodeId);
      return newSet;
    });
  }, []);

  const handleNodeAdd = () => {
    const newNodeId = `new-device-${Date.now()}`;
    const newNode: NodeData = {
        id: newNodeId,
        name: 'New Device',
        role: 'Other',
        x: 0,
        y: 0,
    };
    setGraphData(prev => {
        if (!prev) return null;
        return { ...prev, nodes: [...prev.nodes, newNode] };
    });
    setExpandedNodes(prev => new Set(prev).add(newNodeId));
  };

  const handleLinksUpdate = useCallback((sourceNodeId: string, newTargetIds: Set<string>) => {
    setGraphData(prevData => {
      if (!prevData) return null;
      
      const otherLinks = prevData.links.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeData).id;
        const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeData).id;
        return sourceId !== sourceNodeId && targetId !== sourceNodeId;
      });
      
      const newLinks: LinkData[] = Array.from(newTargetIds).map(targetId => ({
        source: sourceNodeId,
        target: targetId,
      }));

      return { ...prevData, links: [...otherLinks, ...newLinks] };
    });
  }, []);

  const handleReset = () => {
    // Stop live scanning if active
    if (isLiveModeActive && window.electronAPI?.liveScanStop) {
      window.electronAPI.liveScanStop();
    }
    setGraphData(null);
    setError(null);
    setIsLoading(false);
    setFileName(null);
    setIsEditMode(false);
    setExpandedNodes(new Set());
    setIsLiveModeActive(false);
    setLastScanTime(null);
  };

  // Live Mode Handlers
  const handleStartLiveScan = useCallback(async (target: string, intervalSeconds: number) => {
    if (!window.electronAPI?.liveScanStart) return;

    try {
      const result = await window.electronAPI.liveScanStart({ target, intervalSeconds });
      if (result.success) {
        setIsLiveModeActive(true);
        setIsLiveModeOpen(false);
      } else {
        console.error('Failed to start live scan:', result.error);
      }
    } catch (e) {
      console.error('Error starting live scan:', e);
    }
  }, []);

  const handleStopLiveScan = useCallback(async () => {
    if (!window.electronAPI?.liveScanStop) return;

    try {
      await window.electronAPI.liveScanStop();
      setIsLiveModeActive(false);
    } catch (e) {
      console.error('Error stopping live scan:', e);
    }
  }, []);

  const handleDownload = () => {
    if (!graphData) return;

    // First, reset live status fields (they shouldn't be saved)
    const dataWithoutLiveStatus = resetLiveStatus(graphData);
    const dataToSave = JSON.parse(JSON.stringify(dataWithoutLiveStatus));

    // Clean d3-injected properties from nodes
    const cleanedNodes = dataToSave.nodes.map((node: NodeData) => {
      const { x, y, vx, vy, fx, fy, index, ...rest } = node as any;
      return rest;
    });

    // Ensure links are just string IDs
    const cleanedLinks = dataToSave.links.map((link: any) => ({
      source: typeof link.source === 'object' ? link.source.id : link.source,
      target: typeof link.target === 'object' ? link.target.id : link.target,
    }));

    const cleanedData = { nodes: cleanedNodes, links: cleanedLinks };

    const jsonString = JSON.stringify(cleanedData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'network-map.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  return (
    <div className="h-screen w-screen bg-gray-900 text-gray-200 flex flex-col relative overflow-hidden">
      <DotGridBackground isActive={isLiveModeActive} />
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between p-4 sm:p-6 z-30">
        <div className="flex items-center gap-3">
          <img
            src={appLogoSvg}
            alt="App Logo"
            className="w-10 h-10"/>
          <h1 className="text-2xl font-bold text-gray-200">Network Map Visualizer</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPrivacyNoticeOpen(true)}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors duration-200"
            aria-label="Open privacy notice"
          >
            <PrivacyIcon className="w-6 h-6 text-gray-300" />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors duration-200"
            aria-label="Open settings"
          >
            <GearIcon className="w-6 h-6 text-gray-300" />
          </button>
        </div>
      </header>
      
      {isSettingsOpen && <SettingsModal config={aiConfig} onConfigChange={setAiConfig} onClose={() => setIsSettingsOpen(false)} />}
      {isPrivacyNoticeOpen && <PrivacyNoticeModal onClose={() => setIsPrivacyNoticeOpen(false)} />}
      <LiveModePanel
        isOpen={isLiveModeOpen}
        onClose={() => setIsLiveModeOpen(false)}
        isScanning={isLiveModeActive}
        onStartScan={handleStartLiveScan}
        onStopScan={handleStopLiveScan}
        lastScanTime={lastScanTime}
        defaultTarget={defaultScanTarget}
        nmapAvailable={nmapAvailable}
        nmapError={nmapError}
      />

      <main className="flex-grow relative">
        {graphData && (
            <div className="absolute inset-0 z-0">
                <NetworkGraph
                    data={graphData}
                    hoveredNodeId={hoveredNodeId}
                    setHoveredNodeId={setHoveredNodeId}
                    isLiveModeActive={isLiveModeActive}
                />
            </div>
        )}
        
        {graphData && <AnalysisPanel
            nodes={graphData.nodes}
            links={graphData.links}
            hoveredNodeId={hoveredNodeId}
            setHoveredNodeId={setHoveredNodeId}
            isEditMode={isEditMode}
            onNodeUpdate={handleNodeUpdate}
            onNodeDelete={handleNodeDelete}
            onLinksUpdate={handleLinksUpdate}
            expandedNodes={expandedNodes}
            onToggleNodeExpansion={toggleNodeExpansion}
            onNodeAdd={handleNodeAdd}
            isLiveModeActive={isLiveModeActive}
          />}

        <div className="absolute inset-0 flex items-center justify-center p-4 z-10 pointer-events-none">
            <div className="pointer-events-auto">
              {!graphData && !isLoading && !error && <FileUpload onFileSelect={handleFileSelect} onLoadDemo={handleLoadDemo} onCreateNew={handleCreateNew} />}
              
              {isLoading && <Loader fileName={fileName} />}

              {error && (
              <div className="text-center p-8 bg-gray-800 rounded-lg shadow-lg">
                  <h2 className="text-2xl font-bold text-red-500 mb-4">Analysis Failed</h2>
                  <p className="text-gray-400 max-w-md">{error}</p>
              </div>
              )}
            </div>
        </div>
      </main>
      
      {(graphData || error || fileName) && (
        <footer className="absolute bottom-0 left-1/2 -translate-x-1/2 p-4 z-20">
            <div className="flex items-center gap-4 bg-gray-800/70 backdrop-blur-md p-2 rounded-lg shadow-lg border border-gray-700/50">
                <button
                    onClick={handleReset}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors duration-200"
                >
                    <UploadIcon className="w-5 h-5" />
                    New File
                </button>
                {graphData && !isLoading && (
                  <>
                    <button
                        onClick={() => mergeFileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-md transition-colors duration-200"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Scan
                    </button>
                    <button
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors duration-200"
                    >
                        <DownloadIcon className="w-5 h-5" />
                        Download
                    </button>
                    <button
                        onClick={() => setIsEditMode(prev => !prev)}
                        className={`flex items-center gap-2 px-4 py-2 text-white rounded-md transition-colors duration-200 ${isEditMode ? 'bg-accent hover:bg-accent/90' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                        <PencilIcon className="w-5 h-5" />
                        Edit
                    </button>
                    {/* Live Mode Button - Only show in Electron */}
                    {window.electronAPI && (
                      <button
                          onClick={() => setIsLiveModeOpen(true)}
                          className={`flex items-center gap-2 px-4 py-2 text-white rounded-md transition-colors duration-200 ${isLiveModeActive ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                      >
                          <SignalIcon className={`w-5 h-5 ${isLiveModeActive ? 'animate-pulse' : ''}`} />
                          Live
                      </button>
                    )}
                  </>
                )}
            </div>
        </footer>
      )}

        <input
            type="file"
            ref={mergeFileInputRef}
            onChange={handleMergeFileSelected}
            className="hidden"
            accept=".txt,.log,.xml"
        />
    </div>
  );
};

export default App;