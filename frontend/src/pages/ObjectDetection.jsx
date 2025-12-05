// ObjectDetection.jsx
import React, { useState, useEffect } from 'react';
import { runObjectDetection, getObjectDetectionResults } from '../services/api';
import './ObjectDetection.css';

const ObjectDetection = ({ caseId, evidence }) => {
  const [selectedEvidence, setSelectedEvidence] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Filter only image evidence
  const imageEvidence = evidence.filter(item => {
    const filename = item.filename.toLowerCase();
    return filename.endsWith('.jpg') || 
           filename.endsWith('.jpeg') || 
           filename.endsWith('.png') ||
           filename.endsWith('.gif') ||
           filename.endsWith('.bmp');
  });

  // Load existing results when component mounts
  useEffect(() => {
    loadExistingResults();
  }, [caseId]);

  const loadExistingResults = async () => {
    try {
      const response = await getObjectDetectionResults(caseId);
      setResults(response.detection_results || []);
    } catch (error) {
      console.error('Error loading detection results:', error);
    }
  };

  const handleRunDetection = async (runOnAll = false) => {
    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let evidenceId = null;
      
      if (!runOnAll) {
        if (!selectedEvidence) {
          setMessage({ type: 'error', text: 'Please select an evidence file to analyze' });
          setIsLoading(false);
          return;
        }
        evidenceId = parseInt(selectedEvidence);
      }

      const response = await runObjectDetection(caseId, evidenceId);
      
      setMessage({ 
        type: 'success', 
        text: runOnAll 
          ? `Object detection completed on ${response.results.length} files` 
          : 'Object detection completed successfully' 
      });

      // Reload results
      await loadExistingResults();
      
    } catch (error) {
      console.error('Object detection failed:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Object detection failed. Please try again.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatConfidence = (confidence) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  const getEvidenceFilename = (evidenceId) => {
    const evidenceItem = evidence.find(item => item.id === evidenceId);
    return evidenceItem ? evidenceItem.filename : `Evidence #${evidenceId}`;
  };

  return (
    <div className="object-detection-container">
      <div className="object-detection-header">
        <h3>Object Detection Analysis</h3>
      </div>

      {/* Evidence Selection */}
      <div className="evidence-selector">
        <label htmlFor="evidence-select">Select Evidence to Analyze:</label>
        <select 
          id="evidence-select"
          value={selectedEvidence} 
          onChange={(e) => setSelectedEvidence(e.target.value)}
          disabled={isLoading}
        >
          <option value="">Choose an evidence file...</option>
          {imageEvidence.map(item => (
            <option key={item.id} value={item.id}>
              {item.filename}
            </option>
          ))}
        </select>
      </div>

      {/* Controls */}
      <div className="detection-controls">
        <button 
          className="btn-run-detection"
          onClick={() => handleRunDetection(false)}
          disabled={isLoading || !selectedEvidence}
        >
          {isLoading && <span className="loading-spinner"></span>}
          Run Object Detection
        </button>

        {imageEvidence.length > 1 && (
          <button 
            className="btn-run-all"
            onClick={() => handleRunDetection(true)}
            disabled={isLoading}
          >
            {isLoading && <span className="loading-spinner"></span>}
            Run on All Images ({imageEvidence.length})
          </button>
        )}
      </div>

      {/* Messages */}
      {message.text && (
        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
          {message.text}
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="results-section">
          <h4>Detection Results</h4>
          <div className="results-grid">
            {results.map(result => {
              const detectionData = result.results;
              const detections = detectionData?.detections || [];
              
              return (
                <div key={result.id} className="result-card">
                  <div className="result-header">
                    <h5 className="result-filename">
                      {getEvidenceFilename(result.evidence_id)}
                    </h5>
                    {detectionData?.total_detections > 0 && (
                      <span className="result-confidence">
                        {detectionData.total_detections} objects
                      </span>
                    )}
                  </div>

                  {detectionData?.image_dimensions && (
                    <div className="detection-stats">
                      <div className="stat-card">
                        <p className="stat-value">{detectionData.image_dimensions.width}</p>
                        <p className="stat-label">Width (px)</p>
                      </div>
                      <div className="stat-card">
                        <p className="stat-value">{detectionData.image_dimensions.height}</p>
                        <p className="stat-label">Height (px)</p>
                      </div>
                    </div>
                  )}

                  <div className="detections-list">
                    {detections.length > 0 ? (
                      detections.map((detection, index) => (
                        <div key={index} className="detection-item">
                          <span className="detection-class">{detection.class_name}</span>
                          <span className="detection-confidence">
                            {formatConfidence(detection.confidence)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="no-detections">
                        No objects detected
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#7f8c8d' }}>
                    Analyzed: {new Date(result.created_at).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {results.length === 0 && !isLoading && (
        <div className="no-detections" style={{ marginTop: '30px' }}>
          No object detection results yet. Run analysis to see detected objects.
        </div>
      )}
    </div>
  );
};

export default ObjectDetection;