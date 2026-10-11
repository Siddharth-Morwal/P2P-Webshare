import React, { useState, useRef } from 'react';
import { MAX_FILE_SIZE } from '../utils/chunking';

export default function Dropzone({ onFileSelect, disabled }) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    setError('');
    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Max size is 50 MB.');
      return;
    }
    onFileSelect(file);
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors duration-200 ${disabled ? 'opacity-50 cursor-not-allowed border-gray-600' : ''} ${isDragActive ? 'border-blue-500 bg-blue-50 bg-opacity-10 dropzone-active' : 'border-gray-500 hover:border-gray-400 hover:bg-gray-800'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-gray-300 text-center mb-2">Drop a file here or click to browse</p>
        <p className="text-gray-500 text-sm text-center">Max file size: 50 MB</p>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
      {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}
    </div>
  );
}
