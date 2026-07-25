
import React from 'react';

const PrivacyNoticeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg border border-gray-700/50 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">Privacy & Data Handling</h2>
          <p className="text-sm text-gray-400 mt-1">
            This app is designed with your privacy and control in mind. Here’s how your data is handled.
          </p>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          <div className="space-y-4 text-sm text-gray-300">
            <div>
                <h3 className="font-semibold text-gray-100 mb-1">AI Settings & API Keys</h3>
                <p className="text-gray-400">Your choice of AI provider and your API key are saved in your browser's <code className="bg-gray-700 px-1 py-0.5 rounded text-xs">localStorage</code>. This data stays on your computer and is never sent to our servers. Your API key is only visible to you in your own browser; you are responsible for its security and any associated API usage costs.</p>
            </div>
            <div>
                <h3 className="font-semibold text-gray-100 mb-1">File Upload</h3>
                <p className="text-gray-400">When you upload a file, you grant the app permission to read only that single file. The app cannot access any other files on your system.</p>
            </div>
            <div>
                <h3 className="font-semibold text-gray-100 mb-1">AI Analysis & Data Transmission</h3>
                <p className="text-gray-400">The core analysis feature involves sending the content of your uploaded file to your chosen AI service. <br/>- If you use a <strong className="text-accent">Local LLM</strong>, this data stays on your local network. <br/>- If you use <strong className="text-accent">Google Gemini</strong> or <strong className="text-accent">OpenAI</strong>, the data is sent to their servers for processing according to their respective privacy policies.</p>
            </div>
            <div>
                <h3 className="font-semibold text-gray-100 mb-1">Hardware Permissions</h3>
                <p className="text-gray-400">This app does not request access to your camera, microphone, or location.</p>
            </div>
          </div>
        </div>
        <div className="p-4 bg-gray-700/50 flex justify-end gap-3 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium rounded-md transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyNoticeModal;
