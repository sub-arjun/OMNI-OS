import React from 'react';
import CannyFeedback from 'renderer/components/CannyFeedback';
import useAppearanceStore from 'stores/useAppearanceStore';

export default function FeedbackPage() {
  const theme = useAppearanceStore((state) => state.theme);
  
  return (
    <div className="flex flex-col w-full h-full">
      <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
        <h1 className={`text-xl font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          Feedback & Feature Requests
        </h1>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
          Share your ideas, report bugs, or vote on existing features to help us improve OMNI.
        </p>
      </div>
      <div className="flex-1 overflow-hidden pt-6">
        <CannyFeedback className="h-full" />
      </div>
    </div>
  );
} 