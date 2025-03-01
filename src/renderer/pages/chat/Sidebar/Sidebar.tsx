import {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
} from '@fluentui/react-components';
import { PlayCircleHint16Regular, Info24Regular } from '@fluentui/react-icons';
import useMarkdown from 'hooks/useMarkdown';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useAppearanceStore from 'stores/useAppearanceStore';
import useInspectorStore, { ITraceMessage } from 'stores/useInspectorStore';

export default function Sidebar({ chatId }: { chatId: string }) {
  const { t } = useTranslation();
  const theme = useAppearanceStore((state) => state.theme);
  const { render } = useMarkdown();
  const chatSidebar = useAppearanceStore((state) => state.chatSidebar);
  const messages = useInspectorStore((state) => state.messages);
  const trace = useMemo(() => messages[chatId] || [], [messages, chatId]);

  const labelClasses: { [key: string]: string } = useMemo(() => {
    if (theme === 'dark') {
      return {
        error: 'text-red-500 bg-red-900',
        run: 'text-gray-500 bg-gray-900',
        arguments: 'text-blue-400 bg-blue-900 ',
        response: 'text-green-500 bg-green-900',
      };
    }
    return {
      error: 'text-red-500 bg-red-100',
      run: 'text-gray-500 bg-gray-100',
      arguments: 'text-blue-500 bg-blue-100',
      response: 'text-green-500 bg-green-100',
    };
  }, [theme]);

  // Glass morphism styles are mostly defined in Chat.scss
  // but we add some additional styles here for visual polish
  const glassStyles = {
    borderLeft: `1px solid rgba(var(--color-border), 0.4)`,
  };

  return (
    <aside
      className={`right-sidebar ml-5 -mr-5 z-20 pt-2.5 flex-shrink-0 border-l w-72 ${
        chatSidebar.show ? 'hidden sm:flex' : 'hidden'
      }  inset-y-0 top-0 flex-col duration-300 md:relative pl-2`}
      style={glassStyles}
    >
      {/* Glass reflection effect */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-white opacity-20"></div>
      
      <div className="flex text-gray-300 dark:text-gray-600 font-bold text-lg mb-2 items-center">
        <Info24Regular className="mr-2 text-color-tertiary" />
        {t('Common.Inspector')}
      </div>
      
      <div className="h-full overflow-x-hidden overflow-y-auto break-all -ml-2.5 relative z-10">
        <Accordion multiple collapsible>
          {trace?.map((item: ITraceMessage, idx: number) => {
            return item.message === '' ? (
              <div className="pl-4 mt-2" key={`${chatId}-trace-${idx}`}>
                <span className="-ml-1 inline-block pt-0 py-0.5 rounded truncate text-ellipsis overflow-hidden w-52 font-bold text-gray-400 dark:text-gray-400">
                  <PlayCircleHint16Regular />
                  &nbsp;{item.label}
                </span>
              </div>
            ) : (
              <AccordionItem value={idx} key={`${chatId}-trace-${idx}`}>
                <AccordionHeader size="small">
                  <span
                    className={`-ml-1 px-1 inline-block pt-0 py-0.5 rounded ${labelClasses[item.label] || ''}`}
                  >
                    {item.label}
                  </span>
                </AccordionHeader>
                <AccordionPanel>
                  <div
                    className="inspector-message"
                    style={{ marginLeft: 8 }}
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html: render(
                          `\`\`\`json\n${item.message}\n\`\`\``,
                        ),
                      }}
                    />
                  </div>
                </AccordionPanel>
              </AccordionItem>
            );
          })}
        </Accordion>
        
        {/* Show message when no trace is available */}
        {(!trace || trace.length === 0) && (
          <div className="text-center pt-6 px-4 text-sm text-gray-400">
            <div className="mb-2 opacity-50">
              <Info24Regular className="mx-auto" />
            </div>
            {t('Common.NoInspectorData')}
          </div>
        )}
      </div>
    </aside>
  );
}
