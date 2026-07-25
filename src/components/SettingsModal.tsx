import React, { useState, useEffect } from 'react';
import type { AIConfig } from '../types';

interface SettingsModalProps {
  config: AIConfig;
  onConfigChange: (newConfig: AIConfig) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ config, onConfigChange, onClose }) => {
  const [currentConfig, setCurrentConfig] = useState<AIConfig>(config);

  useEffect(() => {
    setCurrentConfig(config);
  }, [config]);

  const handleSave = () => {
    onConfigChange(currentConfig);
    onClose();
  };

  const handleUseAIChange = (useAI: boolean) => {
    setCurrentConfig(prev => ({ ...prev, useAI }));
  };

  const handleProviderChange = (provider: 'deepseek' | 'local') => {
    setCurrentConfig(prev => ({ ...prev, provider }));
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentConfig(prev => ({ ...prev, url: e.target.value }));
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentConfig(prev => ({ ...prev, apiKey: e.target.value }));
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentConfig(prev => ({ ...prev, model: e.target.value }));
  };

  const useAI = currentConfig.useAI !== false; // Default to true for backwards compatibility

  return (
    <div 
        className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
        onClick={onClose}
    >
        <div 
            className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-md border border-gray-700/50"
            onClick={e => e.stopPropagation()}
        >
            <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-gray-100">Analysis Settings</h2>
                <p className="text-sm text-gray-400 mt-1">Configure how network data is analyzed.</p>
            </div>
            <div className="p-6 space-y-6">
                {/* Analysis Mode Toggle */}
                <div className="p-4 bg-gray-700/50 rounded-md border border-gray-600">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-gray-200">Use AI for network analysis</h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {useAI
                                    ? 'AI will analyze and intelligently connect devices'
                                    : 'Devices connect to detected gateway automatically'}
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={useAI}
                            onClick={() => handleUseAIChange(!useAI)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-gray-800 ${useAI ? 'bg-accent' : 'bg-gray-600'}`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${useAI ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>

                {/* AI Provider Options - Only show when AI is enabled */}
                {useAI && (
                <fieldset className="space-y-4">
                    <legend className="text-sm font-medium text-gray-300 mb-2">AI Provider</legend>

                    {/* DeepSeek AI Option */}
                    <div>
                        <label
                            htmlFor="deepseek-api"
                            className={`flex items-center p-4 rounded-md border cursor-pointer transition-colors ${currentConfig.provider === 'deepseek' ? 'bg-accent/10 border-accent' : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'}`}
                        >
                            <input
                                type="radio"
                                id="deepseek-api"
                                name="ai-provider"
                                value="deepseek"
                                checked={currentConfig.provider === 'deepseek'}
                                onChange={() => handleProviderChange('deepseek')}
                                className="h-4 w-4 text-accent bg-gray-600 border-gray-500 focus:ring-accent"
                            />
                            <span className="ml-3 text-sm font-medium text-gray-200">DeepSeek API</span>
                        </label>
                        {currentConfig.provider === 'deepseek' && (
                            <div className="mt-4 pl-8 space-y-3 animate-fade-in">
                                <div>
                                    <label htmlFor="deepseek-api-key" className="text-xs font-medium text-gray-400 block mb-1">Your API Key</label>
                                    <input
                                        type="password"
                                        id="deepseek-api-key"
                                        value={currentConfig.apiKey || ''}
                                        onChange={handleApiKeyChange}
                                        className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-md p-2 focus:ring-accent focus:border-accent"
                                        placeholder="Enter your DeepSeek API Key"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="deepseek-model" className="text-xs font-medium text-gray-400 block mb-1">Model Name</label>
                                    <select
                                        id="deepseek-model"
                                        value={currentConfig.model || 'deepseek-v4-flash'}
                                        onChange={handleModelChange}
                                        className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-md p-2 focus:ring-accent focus:border-accent"
                                    >
                                        <option value="deepseek-v4-flash">deepseek-v4-flash</option>
                                        <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                                    </select>
                                </div>
                                 <div className="text-xs text-gray-500">
                                    <p>Your API key is stored only in your browser and is never shared.</p>
                                    <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-accent/80 hover:text-accent underline">
                                        Get your key from DeepSeek.
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Local LLM Option */}
                    <div>
                        <label 
                            htmlFor="local-llm" 
                            className={`flex items-center p-4 rounded-md border cursor-pointer transition-colors ${currentConfig.provider === 'local' ? 'bg-accent/10 border-accent' : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'}`}
                        >
                            <input
                                type="radio"
                                id="local-llm"
                                name="ai-provider"
                                value="local"
                                checked={currentConfig.provider === 'local'}
                                onChange={() => handleProviderChange('local')}
                                className="h-4 w-4 text-accent bg-gray-600 border-gray-500 focus:ring-accent"
                            />
                            <span className="ml-3 text-sm font-medium text-gray-200">Local LLM (OpenAI Compatible)</span>
                        </label>
                        {currentConfig.provider === 'local' && (
                            <div className="mt-4 pl-8 space-y-3 animate-fade-in">
                                <div>
                                    <label htmlFor="local-url" className="text-xs font-medium text-gray-400 block mb-1">Server URL</label>
                                    <input
                                        type="url"
                                        id="local-url"
                                        value={currentConfig.url || 'http://localhost:1234/v1/chat/completions'}
                                        onChange={handleUrlChange}
                                        className="w-full bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded-md p-2 focus:ring-accent focus:border-accent"
                                        placeholder="http://localhost:1234/v1/chat/completions"
                                    />
                                </div>
                                <div className="text-xs text-gray-500 p-3 bg-gray-900/50 rounded-md">
                                    <p className="font-semibold">Note for LM Studio users:</p>
                                    <p className="mt-1">To allow this web app to connect, start your server with CORS enabled. Go to the "Server" tab, find the "CORS" option, and set it to "Allow all origins".</p>
                                </div>
                            </div>
                        )}
                    </div>
                </fieldset>
                )}
            </div>
            <div className="p-4 bg-gray-700/50 flex justify-end gap-3 rounded-b-lg">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-md transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-btn hover:bg-btn/90 text-white text-sm font-medium rounded-md transition-colors"
                >
                    Save Settings
                </button>
            </div>
        </div>
    </div>
  );
};

export default SettingsModal;