// Script to fix speech button styling
(function() {
  // Create a style element
  const style = document.createElement('style');
  style.textContent = `
    /* CSS to make speech buttons seamless */
    .speech-button-container {
      border-radius: 6px !important;
      overflow: hidden !important;
      height: 36px !important;
    }
    
    .speech-button-wrapper button,
    .speech-button-main button {
      border-top-right-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
      border-right: none !important;
      height: 36px !important;
    }
    
    .speech-button-chevron {
      border-top-left-radius: 0 !important;
      border-bottom-left-radius: 0 !important;
      height: 36px !important;
      border-left: none !important;
      margin-left: -1px !important;
    }
    
    /* Force the row to be seamless */
    .ask-omni-container .btn-row,
    .speech-control-wrapper,
    .speech-button-container {
      display: flex !important;
      align-items: stretch !important;
    }
  `;
  
  // Append to the head
  document.head.appendChild(style);

  // Apply additional adjustments through JavaScript if needed
  function adjustSpeechButtons() {
    const speechButtons = document.querySelectorAll('.speech-button-chevron');
    speechButtons.forEach(button => {
      if (button) {
        button.style.borderTopLeftRadius = '0';
        button.style.borderBottomLeftRadius = '0';
        button.style.height = '36px';
        button.style.borderLeft = 'none';
        button.style.marginLeft = '-1px';
      }
    });
  }

  // Run once when loaded
  adjustSpeechButtons();
  
  // Set up an observer to watch for future changes
  const observer = new MutationObserver(function() {
    adjustSpeechButtons();
  });
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
})(); 