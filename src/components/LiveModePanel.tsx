import React, { useState, useEffect } from 'react';
import { validateTarget } from '../services/liveScanService';

interface LiveModePanelProps {
  isOpen: boolean;
  onClose: () => void;
  isScanning: boolean;
  onStartScan: (target: string, intervalSeconds: number) => void;
  onStopScan: () => void;
  lastScanTime: string | null;
  defaultTarget: string;
  nmapAvailable: boolean | null;
  nmapError: string | null;
}

const INTERVAL_OPTIONS = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
];

const LiveModePanel: React.FC<LiveModePanelProps> = ({
  isOpen,
  onClose,
  isScanning,
  onStartScan,
  onStopScan,
  lastScanTime,
  defaultTarget,
  nmapAvailable,
  nmapError,
}) => {
  const [target, setTarget] = useState(defaultTarget);
  const [interval, setInterval] = useState(30);
  const [targetError, setTargetError] = useState<string | null>(null);

  useEffect(() => {
    setTarget(defaultTarget);
  }, [defaultTarget]);

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTarget = e.target.value;
    setTarget(newTarget);
    if (newTarget && !validateTarget(newTarget)) {
      setTargetError('Invalid target format. Use IP (192.168.1.1), CIDR (192.168.1.0/24), or hostname.');
    } else {
      setTargetError(null);
    }
  };

  const handleStartClick = () => {
    if (!target) {
      setTargetError('Please enter a target IP range');
      return;
    }
    if (!validateTarget(target)) {
      setTargetError('Invalid target format');
      return;
    }
    onStartScan(target, interval);
  };

  const formatLastScanTime = (isoString: string | null): string => {
    if (!isoString) return 'Never';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString();
    } catch {
      return 'Unknown';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-700/50"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
            <h2 className="text-xl font-bold text-gray-100">Live Mode</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Monitor your network in real-time with periodic ping scans.
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Nmap availability warning */}
          {nmapAvailable === false && (
            <div className="p-4 bg-red-900/30 border border-red-700/50 rounded-md">
              <h3 className="text-sm font-medium text-red-300">Nmap not available</h3>
              <p className="text-xs text-red-400 mt-1">{nmapError || 'nmap is required for live scanning.'}</p>
              <div className="mt-2 text-xs text-gray-400">
                <p className="font-medium">Installation:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li><span className="text-gray-300">Linux:</span> sudo apt install nmap</li>
                  <li><span className="text-gray-300">macOS:</span> brew install nmap</li>
                  <li><span className="text-gray-300">Windows:</span> Download from nmap.org</li>
                </ul>
              </div>
            </div>
          )}

          {/* Electron-only warning for web users */}
          {typeof window !== 'undefined' && !window.electronAPI && (
            <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-md">
              <h3 className="text-sm font-medium text-yellow-300">Desktop App Required</h3>
              <p className="text-xs text-yellow-400 mt-1">
                Live scanning requires the desktop application to run nmap scans.
              </p>
            </div>
          )}

          {/* Target input */}
          <div>
            <label htmlFor="scan-target" className="text-sm font-medium text-gray-300 block mb-2">
              Target IP Range
            </label>
            <input
              type="text"
              id="scan-target"
              value={target}
              onChange={handleTargetChange}
              disabled={isScanning}
              placeholder="192.168.1.0/24"
              className={`w-full bg-gray-700 border text-gray-200 text-sm rounded-md p-2.5 focus:ring-accent focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed ${
                targetError ? 'border-red-500' : 'border-gray-600'
              }`}
            />
            {targetError && (
              <p className="text-xs text-red-400 mt-1">{targetError}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Examples: 192.168.1.0/24, 10.0.0.1-50, 192.168.1.1
            </p>
          </div>

          {/* Interval selector */}
          <div>
            <label htmlFor="scan-interval" className="text-sm font-medium text-gray-300 block mb-2">
              Scan Interval
            </label>
            <select
              id="scan-interval"
              value={interval}
              onChange={e => setInterval(Number(e.target.value))}
              disabled={isScanning}
              className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-md p-2.5 focus:ring-accent focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {INTERVAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status display */}
          <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-md">
            <span className="text-sm text-gray-400">Last scan:</span>
            <span className="text-sm text-gray-200">{formatLastScanTime(lastScanTime)}</span>
          </div>

          {/* Scanning indicator */}
          {isScanning && (
            <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/30 rounded-md">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-300">Scanning in progress...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-700/50 flex justify-between items-center rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-md transition-colors"
          >
            Close
          </button>
          <div className="flex gap-2">
            {isScanning ? (
              <button
                onClick={onStopScan}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors"
              >
                Stop Scan
              </button>
            ) : (
              <button
                onClick={handleStartClick}
                disabled={nmapAvailable === false || !window.electronAPI}
                className="px-4 py-2 bg-btn hover:bg-btn/90 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Scan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveModePanel;
