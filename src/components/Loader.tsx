
import React, { useState, useEffect } from 'react';

const Loader: React.FC<{ fileName: string | null }> = ({ fileName }) => {
    const [message, setMessage] = useState("Analyzing your file...");
    
    useEffect(() => {
        const messages = [
            "Identifying network devices...",
            "Mapping connections...",
            "Inferring device roles...",
            "Building visualization...",
            "Almost there..."
        ];
        let messageIndex = 0;
        const interval = setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setMessage(messages[messageIndex]);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-800 rounded-lg shadow-lg">
      <div className="w-12 h-12 border-4 border-gray-600 border-t-accent rounded-full animate-spin mb-6"></div>
      <h2 className="text-xl font-bold text-gray-200">Processing...</h2>
      {fileName && <p className="text-sm text-gray-400 mt-2 mb-4 max-w-sm truncate">{fileName}</p>}
      <p className="text-gray-400">{message}</p>
    </div>
  );
};

export default Loader;