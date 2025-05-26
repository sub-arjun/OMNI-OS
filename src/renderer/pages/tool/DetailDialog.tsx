import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogTrigger,
  DialogBody,
  Button,
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import { useTranslation } from 'react-i18next';
import {
  Dismiss24Regular,
  WrenchScrewdriver24Regular,
} from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import useMarkdown from 'hooks/useMarkdown';

import { IMCPServer } from 'types/mcp';

export default function ToolDetailDialog(options: {
  server: IMCPServer | null;
  open: boolean;
  setOpen: Function;
}) {
  const { server, open, setOpen } = options;
  const { t } = useTranslation();
  const [tools, setTools] = useState<any[]>([]);
  const { render } = useMarkdown();
  useEffect(() => {
    if (open) {
      Mousetrap.bind('esc', () => setOpen(false));
      server &&
        window.electron.mcp.listTools(server.key).then((_tools) => {
          setTools(_tools);
        });
    }
    return () => {
      Mousetrap.unbind('esc');
    };
  }, [open]);

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  onClick={() => setOpen(false)}
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            <div className="flex items-center gap-2 font-bold">
              <WrenchScrewdriver24Regular />
              {server?.key}&nbsp;{t('Common.Tools')}
            </div>
          </DialogTitle>
          <DialogContent>
            <Accordion multiple collapsible className="mt-4">
              {tools.map((tool: any) => (
                <AccordionItem
                  value={tool.name}
                  key={tool.name}
                  className="-my-3"
                >
                  <AccordionHeader>
                    <div className="text-gray-500 dark:text-gray-300 font-bold">
                      {tool.name.split('--')[1]}
                    </div>
                  </AccordionHeader>
                  <AccordionPanel>
                    <div className="border-l border-dotted border-stone-300 dark:border-gray-500 ml-2 pl-2 pb-3 mb-2">
                      <div className="text-sm text-gray-500 dark:text-gray-300 ml-3">
                        {tool.description}
                      </div>
                      <div className="mt-2 ml-2">
                        <fieldset className="border border-stone-300 dark:border-stone-600 rounded bg-stone-50 dark:bg-stone-800">
                          <legend className="text-sm px-1 ml-2 text-gray-500 dark:text-gray-300">
                            inputSchema
                          </legend>
                          <div
                            className="-mt-3 ghost p-2"
                            dangerouslySetInnerHTML={{
                              __html: render(
                                `\`\`\`json\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\``,
                              ),
                            }}
                          />
                        </fieldset>
                      </div>
                    </div>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
