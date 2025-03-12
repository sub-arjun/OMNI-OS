import React from 'react';
import useAppearanceStore from 'stores/useAppearanceStore';

interface CannyFeedbackProps {
  className?: string;
}

const CANNY_URL = 'https://omni-os.canny.io/omni';

const CannyFeedback: React.FC<CannyFeedbackProps> = ({ className = '' }) => {
  const theme = useAppearanceStore((state) => state.theme);

  return (
    <div className={className} style={{ 
      width: '100%',
      height: '100%',
      backgroundColor: theme === 'dark' ? '#1e1e1e' : '#ffffff',
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme === 'dark' ? '#e0e0e0' : '#333333'
    }}>
      <div style={{ 
        padding: '20px',
        border: `1px solid ${theme === 'dark' ? '#444' : '#ddd'}`,
        borderRadius: '8px',
        maxWidth: '500px',
        textAlign: 'center',
        backgroundColor: theme === 'dark' ? '#2d2d2d' : '#f9f9f9'
      }}>
        <h2 style={{ marginBottom: '16px' }}>OMNI Feedback & Feature Requests</h2>
        <p>Please use the button below to access our feedback board.</p>
        <p style={{ marginTop: '16px' }}>
          You can visit our feedback board at{' '}
          <a 
            href="#" 
            onClick={() => window.electron?.openExternal?.(CANNY_URL)}
            style={{ 
              color: theme === 'dark' ? '#3b82f6' : '#2563eb',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            omni-os.canny.io
          </a>
        </p>
        <button
          onClick={() => window.electron?.openExternal?.(CANNY_URL)}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: theme === 'dark' ? '#3b82f6' : '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Open Feedback Page
        </button>
      </div>
    </div>
  );
};

export default CannyFeedback; 