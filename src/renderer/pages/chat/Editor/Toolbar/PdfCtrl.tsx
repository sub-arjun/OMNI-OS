import React, { useRef, useState } from 'react';
import { 
  Button, 
  Tooltip, 
  Popover, 
  PopoverTrigger, 
  PopoverSurface 
} from '@fluentui/react-components';
import { 
  DocumentPdfRegular, 
  DocumentPdfFilled, 
  Dismiss16Regular 
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import useChatStore from 'stores/useChatStore';

interface PdfCtrlProps {
  onFileSelect: (file: File) => void; // Callback to pass the selected file up
  selectedPdfName: string | null;      // Name of the selected PDF, or null
  onClearPdf: () => void;             // Callback to clear the selected PDF
}

export default function PdfCtrl({
  onFileSelect,
  selectedPdfName,
  onClearPdf,
}: PdfCtrlProps) {
  const { t } = useTranslation();
  const isLoading = useChatStore((state) => state.getCurState().loading);
  const [isOpen, setIsOpen] = useState(false);

  // Function to open native file dialog and select a PDF
  const pickPdfFile = async () => {
    try {
      const result = await window.electron.knowledge.selectFiles();
      
      // Validate result
      if (!result) {
        console.warn('No result from file selection');
        return;
      }
      
      let files;
      try {
        files = JSON.parse(result as string) as Array<{ path: string; name: string; size: number; type: string }>;
      } catch (parseError) {
        console.error('Error parsing file selection result:', parseError);
        return;
      }
      
      if (!files || files.length === 0) {
        console.log('No files selected');
        return;
      }
      
      const { path: filePath, name, type } = files[0];
      
      // Validate that it's a PDF file
      if (type !== 'pdf' && !name.toLowerCase().endsWith('.pdf')) {
        console.error('Selected file is not a PDF:', name);
        return;
      }
      
      console.log('Reading PDF file:', name);
      
      // Use the IPC handler to read the PDF file
      const pdfData = await window.electron.knowledge.readPdfAsBase64(filePath);
      
      // Validate the response
      if (!pdfData || !pdfData.base64) {
        console.error('Invalid response from readPdfAsBase64');
        return;
      }
      
      // Extract the base64 content from the data URL
      const base64String = pdfData.base64.split(',')[1];
      
      if (!base64String) {
        console.error('Invalid base64 data URL format');
        return;
      }
      
      // Convert base64 to binary data
      const binaryString = atob(base64String);
      
      // Create an array buffer from the binary string
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create a blob from the array buffer
      const blob = new Blob([bytes], { type: 'application/pdf' });
      
      // Validate blob size
      if (blob.size === 0) {
        console.error('Created blob has zero size');
        return;
      }
      
      // Create a File object from the blob
      const file = new File([blob], name, { type: 'application/pdf' });
      console.log('PDF successfully processed:', name, 'Size:', blob.size);
      onFileSelect(file);
    } catch (err) {
      console.error('Error selecting PDF file:', err);
      // You might want to show a user-friendly error message here
    }
  };

  const handleButtonClick = () => {
    if (selectedPdfName) {
      setIsOpen(!isOpen);
    } else {
      pickPdfFile();
    }
  };

  const Icon = selectedPdfName ? DocumentPdfFilled : DocumentPdfRegular;

  const bounceAnimation = `
    @keyframes smolBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
    }
    .pdf-upload-bounce {
      animation: smolBounce 1.5s ease-in-out infinite alternate;
    }
  `;

  const TriggerButton = (
    <Button
      icon={<Icon />}
      appearance="subtle"
      aria-label={selectedPdfName ? `Attached: ${selectedPdfName}` : t('Upload PDF')}
      disabled={isLoading}
      style={{ marginTop: '8px' }}
      title={selectedPdfName ? `Attached: ${selectedPdfName}` : t('Upload PDF')}
      className={selectedPdfName ? 'pdf-upload-bounce' : ''}
      onClick={handleButtonClick}
    />
  );

  return (
    <>
      <style>{bounceAnimation}</style>
      <Popover 
        positioning="above" 
        withArrow
        open={isOpen}
        onOpenChange={(e, data) => {
          if (data.open && !selectedPdfName) {
            return;
          }
          setIsOpen(data.open);
        }}
      >
        <PopoverTrigger 
          disableButtonEnhancement 
        >
          <Tooltip
            content={
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>{t('Common.PDF')}</div>
                <div>Attach a PDF file to the chat (Ctrl+Shift+8)</div>
              </div>
            }
            relationship="description"
            positioning="before"
          >
            {TriggerButton}
          </Tooltip>
        </PopoverTrigger>
        
        <PopoverSurface>
           <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '4px 8px' 
          }}>
            <span 
              style={{ 
                fontSize: '12px', 
                maxWidth: '180px',
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}
              title={selectedPdfName || ''} 
            >
              {selectedPdfName}
            </span>
            <Tooltip content={t('Remove PDF')} relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Dismiss16Regular />}
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onClearPdf(); 
                  setIsOpen(false);
                }}
                aria-label={t('Remove PDF')}
                style={{ minWidth: 'auto', padding: '0 2px', height: 'auto' }}
              />
            </Tooltip>
          </div>
        </PopoverSurface>
      </Popover>
    </>
  );
} 