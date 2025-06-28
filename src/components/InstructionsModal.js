import React, { useEffect, useState } from 'react';
import { instructionsContent } from '../utils/instructions';

function InstructionsModal({ show, onClose }) {
  const [parsedContent, setParsedContent] = useState('');

  useEffect(() => {
    if (show) {
      // Check if marked is available
      if (typeof window !== 'undefined' && window.marked) {
        try {
          setParsedContent(window.marked.parse(instructionsContent));
        } catch (error) {
          console.error('Error parsing instructions content:', error);
          setParsedContent('<p>Error loading instructions. Please try again later.</p>');
        }
      } else {
        // Fallback to plain text with basic markdown parsing
        setParsedContent(instructionsContent.replace(/\n/g, '<br>'));
      }
    }
  }, [show]);

  const handleModalClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!show) return null;

  return (
    <div 
      id="instructions-modal" 
      style={{
        display: 'block',
        position: 'fixed',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        overflowY: 'auto'
      }}
      onClick={handleModalClick}
    >
      <div 
        id="instructions-content"
        style={{
          backgroundColor: '#fefefe',
          margin: '5% auto',
          padding: '20px',
          border: '1px solid #888',
          width: '80%',
          borderRadius: '8px',
          boxShadow: '0 4px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19)',
          position: 'relative'
        }}
      >
        <span 
          onClick={onClose}
          style={{
            color: '#aaa',
            float: 'right',
            fontSize: '28px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          &times;
        </span>
        <h2>Instructions</h2>
        <div 
          id="instructions-text-area"
          dangerouslySetInnerHTML={{ __html: parsedContent }}
        />
      </div>
    </div>
  );
}

export default InstructionsModal;