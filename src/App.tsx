/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Settings, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { processPdfInBatches } from './lib/pdfProcessor';
import { processPage, ExtractedRow, ExtractionConfig, DEFAULT_CONFIG, ColumnConfig } from './lib/openaiProcessor';
import { generateExcel } from './lib/excelGenerator';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [config, setConfig] = useState<ExtractionConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);

  const handleAddColumn = () => {
    setConfig({
      ...config,
      columns: [...config.columns, { name: '', type: 'string', description: '' }]
    });
  };

  const handleRemoveColumn = (index: number) => {
    const newColumns = [...config.columns];
    newColumns.splice(index, 1);
    setConfig({ ...config, columns: newColumns });
  };

  const handleColumnChange = (index: number, field: keyof ColumnConfig, value: string) => {
    const newColumns = [...config.columns];
    newColumns[index] = { ...newColumns[index], [field]: value } as ColumnConfig;
    setConfig({ ...config, columns: newColumns });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError(null);
      setExtractedData([]);
    } else {
      setError('Please select a valid PDF file.');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      setError(null);
      setExtractedData([]);
    } else {
      setError('Please drop a valid PDF file.');
    }
  };

  const processFile = async () => {
    if (!file) return;

    // Validate config
    if (config.columns.length === 0) {
      setError('Please define at least one column to extract.');
      setShowConfig(true);
      return;
    }
    if (config.columns.some(c => !c.name.trim())) {
      setError('All columns must have a valid name.');
      setShowConfig(true);
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedData([]);

    try {
      setProgress({ current: 0, total: 0 });

      const allData = await processPdfInBatches<ExtractedRow>(
        file,
        (current, total) => setProgress({ current, total }),
        async (base64Image) => {
          return await processPage(base64Image, config);
        }
      );

      if (allData.length === 0) {
        setError('No data could be extracted from this document. Please check the extraction settings or try a different document.');
      } else {
        setExtractedData(allData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (extractedData.length > 0) {
      generateExcel(extractedData, file?.name.replace('.pdf', '.xlsx') || 'Extracted_Data.xlsx');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Logistics PDF to Excel Converter
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Upload your logistics log PDF to automatically extract and format the data into a clean Excel spreadsheet.
          </p>
        </div>

        <div className="bg-white shadow sm:rounded-lg overflow-hidden mb-6">
          <div 
            className="px-4 py-4 sm:px-6 flex justify-between items-center cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => setShowConfig(!showConfig)}
          >
            <div className="flex items-center">
              <Settings className="h-5 w-5 text-gray-500 mr-2" />
              <h3 className="text-lg leading-6 font-medium text-gray-900">Extraction Settings</h3>
            </div>
            {showConfig ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
          </div>
          
          {showConfig && (
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-md font-medium text-gray-900">Columns to Extract</h4>
                  <button
                    onClick={handleAddColumn}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Column
                  </button>
                </div>
                
                <div className="space-y-3">
                  {config.columns.map((col, index) => (
                    <div key={index} className="flex gap-3 items-start bg-gray-50 p-3 rounded-md border border-gray-200">
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-3">
                          <div className="w-1/2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Column Name (Key)</label>
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md px-3 py-2"
                              placeholder="e.g., invoiceNo"
                            />
                          </div>
                          <div className="w-1/2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Data Type</label>
                            <select
                              value={col.type}
                              onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md px-3 py-2 bg-white"
                            >
                              <option value="string">Text (String)</option>
                              <option value="number">Number</option>
                              <option value="boolean">True/False (Boolean)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Description / Instructions</label>
                          <input
                            type="text"
                            value={col.description}
                            onChange={(e) => handleColumnChange(index, 'description', e.target.value)}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md px-3 py-2"
                            placeholder="e.g., The 10-digit invoice number"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveColumn(index)}
                        className="mt-6 p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"
                        title="Remove column"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                  {config.columns.length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center py-4">No columns defined. Add a column to start extracting data.</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-md font-medium text-gray-900 mb-2">Additional Extraction Rules</label>
                <p className="text-xs text-gray-500 mb-2">Provide any specific instructions for the AI on how to parse complex rows, split data, or format values.</p>
                <textarea
                  rows={6}
                  value={config.additionalInstructions}
                  onChange={(e) => setConfig({ ...config, additionalInstructions: e.target.value })}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Ignore rows that say 'CANCELLED'..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            {!isProcessing && extractedData.length === 0 && (
              <div
                className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md ${file ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="space-y-1 text-center cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-transparent rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
                    >
                      <span>{file ? file.name : 'Upload a PDF file'}</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        ref={fileInputRef}
                        accept="application/pdf"
                        onChange={handleFileChange}
                      />
                    </label>
                    {!file && <p className="pl-1">or drag and drop</p>}
                  </div>
                  <p className="text-xs text-gray-500">Any number of pages supported</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {file && !isProcessing && extractedData.length === 0 && (
              <div className="mt-6">
                <button
                  onClick={processFile}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Process Document
                </button>
              </div>
            )}

            {isProcessing && (
              <div className="mt-6 text-center">
                <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">Processing Document</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Extracting data from page {progress.current} of {progress.total}...
                </p>
                <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            )}

            {extractedData.length > 0 && (
              <div className="mt-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">Processing Complete!</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Successfully extracted {extractedData.length} rows of data.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={handleDownload}
                    className="inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <FileSpreadsheet className="mr-2 h-5 w-5" />
                    Download Excel
                  </button>
                  <button
                    onClick={() => {
                      setFile(null);
                      setExtractedData([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="inline-flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Process Another File
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
