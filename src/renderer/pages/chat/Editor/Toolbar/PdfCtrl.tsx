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
      const files = JSON.parse(result as string) as Array<{ path: string; name: string; size: number; type: string }>;
      if (files.length > 0) {
        const { path: filePath, name } = files[0];
        const response = await fetch(`file://${filePath}`);
        const blob = await response.blob();
        const file = new File([blob], name, { type: 'application/pdf' });
        console.log('PDF selected via native dialog:', name);
        onFileSelect(file);
      }
    } catch (err) {
      console.error('Error selecting PDF file:', err);
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