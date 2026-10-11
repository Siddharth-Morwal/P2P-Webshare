import React from 'react';
import { formatBytes } from '../utils/chunking';

export default function FileInfo({ file, hashStatus, fileHash }) {
  if (!file) return null;

  const truncateHash = (hash) => {
    if (!hash || hash.length <= 16) return hash;
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 w-full shadow-sm">
      <div className="flex items-center mb-3">
        <span className="text-2xl mr-3" role="img" aria-label="file">📄</span>
        <div className="overflow-hidden">
          <h3 className="text-gray-100 font-medium truncate" title={file.name}>{file.name}</h3>
          <div className="flex items-center text-gray-400 text-sm mt-1">
            <span>{formatBytes(file.size)}</span>
            <span className="mx-2">•</span>
            <span className="truncate">{file.type || 'Unknown type'}</span>
          </div>
        </div>
      </div>
      
      {hashStatus && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex items-center text-sm">
          {hashStatus === 'hashing' && (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-blue-400">Computing hash...</span>
            </>
          )}
          {hashStatus === 'verified' && (
            <>
              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-green-400">Integrity verified {fileHash && `(${truncateHash(fileHash)})`}</span>
            </>
          )}
          {hashStatus === 'failed' && (
            <>
              <svg className="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-red-400">Hash mismatch — file may be corrupted</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
