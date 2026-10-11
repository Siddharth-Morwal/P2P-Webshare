import React from 'react';

export default function StatusBadge({ status }) {
  const getStatusConfig = () => {
    switch (status) {
      case 'idle':
        return { color: 'bg-gray-500', text: 'Idle', pulse: false };
      case 'creating':
        return { color: 'bg-yellow-500', text: 'Creating room...', pulse: false };
      case 'waiting':
        return { color: 'bg-yellow-500', text: 'Waiting for peer...', pulse: true };
      case 'connecting':
        return { color: 'bg-yellow-500', text: 'Connecting...', pulse: true };
      case 'connected':
        return { color: 'bg-green-500', text: 'Connected', pulse: false };
      case 'transferring':
        return { color: 'bg-blue-500', text: 'Transferring...', pulse: true };
      case 'verifying':
        return { color: 'bg-blue-500', text: 'Verifying...', pulse: false };
      case 'complete':
        return { color: 'bg-emerald-500', text: 'Complete', pulse: false };
      case 'disconnected':
        return { color: 'bg-orange-500', text: 'Peer disconnected', pulse: false };
      case 'error':
        return { color: 'bg-red-500', text: 'Error', pulse: false };
      default:
        return { color: 'bg-gray-500', text: status || 'Unknown', pulse: false };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="inline-flex items-center px-3 py-1 rounded-full bg-gray-800 border border-gray-700 shadow-sm">
      <div className="relative flex h-2 w-2 mr-2">
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.color}`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`}></span>
      </div>
      <span className="text-xs font-medium text-gray-300">{config.text}</span>
    </div>
  );
}
