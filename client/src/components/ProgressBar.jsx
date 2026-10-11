import React from 'react';
import { formatBytes, formatDuration } from '../utils/chunking';

export default function ProgressBar({ progress, speed, bytesTransferred, totalBytes, status }) {
  const isComplete = status === 'complete';
  const isError = status === 'error';
  const isVerifying = status === 'verifying';
  
  const progressPercent = Math.min(Math.max(progress || 0, 0), 100);
  
  const etaSeconds = (speed && speed > 0 && bytesTransferred < totalBytes) 
    ? (totalBytes - bytesTransferred) / speed 
    : 0;

  let barColors = 'from-blue-500 to-blue-400';
  if (isComplete) barColors = 'from-emerald-500 to-green-400';
  if (isError) barColors = 'from-red-500 to-red-400';
  if (isVerifying) barColors = 'from-purple-500 to-purple-400';

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-2">
        <span className="text-sm font-medium text-gray-300">
          {isComplete ? 'Transfer complete ✓' : 
           isVerifying ? <span className="animate-pulse text-purple-400">Verifying integrity...</span> : 
           isError ? <span className="text-red-400">Transfer Error</span> : 
           'Transferring...'}
        </span>
        <span className="text-sm font-medium text-gray-400">{progressPercent.toFixed(1)}%</span>
      </div>
      
      <div className="w-full bg-gray-700 rounded-full h-3 mb-3 overflow-hidden progress-bar">
        <div 
          className={`h-3 rounded-full bg-gradient-to-r ${barColors} transition-all duration-300 ease-out progress-fill`} 
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>
      
      {!isComplete && !isError && totalBytes > 0 && (
        <div className="flex justify-between text-xs text-gray-400">
          <div className="w-1/3 text-left">
            {formatBytes(bytesTransferred)} / {formatBytes(totalBytes)}
          </div>
          <div className="w-1/3 text-center">
            {speed > 0 ? `${formatBytes(speed)}/s` : '---'}
          </div>
          <div className="w-1/3 text-right">
            {speed > 0 && bytesTransferred < totalBytes ? `ETA: ${formatDuration(etaSeconds)}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
