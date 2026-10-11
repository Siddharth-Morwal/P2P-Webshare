import React, { useState, useEffect } from 'react';

export default function RoomLink({ roomId }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/room/${roomId}`;

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  };

  if (!roomId) return null;

  return (
    <div className="w-full bg-gray-800 rounded-lg p-5 border border-gray-700">
      <h3 className="text-gray-400 text-sm font-medium mb-1">Room ID</h3>
      <div className="text-3xl font-mono text-white mb-4 tracking-wider">{roomId}</div>
      
      <h3 className="text-gray-400 text-sm font-medium mb-1">Share Link</h3>
      <div className="flex items-center bg-gray-900 rounded-md p-1 border border-gray-700">
        <div className="flex-1 overflow-x-auto whitespace-nowrap px-3 py-2 text-sm text-gray-300 font-mono hide-scrollbar">
          {link}
        </div>
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 ml-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            copied 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {copied ? (
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </span>
          ) : (
            'Copy Link'
          )}
        </button>
      </div>
    </div>
  );
}
