import {
  Button,
  List,
  ListItem,
  SearchBox,
  SearchBoxChangeEvent,
  InputOnChangeData,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Drawer,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import { useTranslation } from 'react-i18next';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import usePromptMarketStore from 'stores/usePromptMarketStore';
import Spinner from 'renderer/components/Spinner';
import { IPromptDef } from 'intellichat/types';
import usePromptStore from 'stores/usePromptStore';
import { debounce } from 'lodash';
import { highlight } from 'utils/util';
import Empty from 'renderer/components/Empty';

export default function PromptMarketDrawer({
  open,
  setOpen,
  onInstall,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onInstall: (prompt: IPromptDef) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { fetchPrompts, prompts: allPrompts } = usePromptMarketStore();
  const { prompts: installedPrompts } = usePromptStore();
  const [filter, setFilter] = useState<string[]>([]);

  const debouncedSearch = useRef(
    debounce((_: SearchBoxChangeEvent, data: InputOnChangeData) => {
      const value = data.value || '';
      const terms = value.split(/\s+/g).filter(Boolean);
      setFilter(terms);
    }, 500),
  ).current;

  const prompts = useMemo(() => {
    let filteredPrompts = allPrompts;
    if (filter.length > 0) {
      filteredPrompts = allPrompts.filter((p: IPromptDef) => {
        return filter.every((f) => {
          return (
            p.name.toLowerCase().includes(f.toLowerCase()) ||
            (p.description || '').toLowerCase().includes(f.toLowerCase()) ||
            (p.systemMessage || '').toLowerCase().includes(f.toLowerCase()) ||
            (p.userMessage || '').toLowerCase().includes(f.toLowerCase())
          );
        });
      });
    }
    return filteredPrompts.sort((a, b) => a.name.localeCompare(b.name));
  }, [filter, allPrompts]);

  const installedPromptNames = useMemo(
    () => new Set(installedPrompts.map((p: IPromptDef) => p.name)),
    [installedPrompts],
  );

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      await fetchPrompts();
    } finally {
      setLoading(false);
    }
  }, [fetchPrompts]);

  useEffect(() => {
    if (open) {
      Mousetrap.bind('esc', () => setOpen(false));
      loadPrompts();
    }
    return () => {
      Mousetrap.unbind('esc');
    };
  }, [open, loadPrompts]);

  return (
    <Drawer open={open} position="end" separator size="medium">
      <DrawerHeader className="border-none">
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={() => setOpen(false)}
            />
          }
        >
          <div className="flex justify-start gap-2">
            <SearchBox 
              placeholder={t('Prompt.Market.SearchPlaceholder')}
              onChange={debouncedSearch} 
            />
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>
      <DrawerBody>
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Spinner size={48} />
            <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">
              {t('Common.Loading')}
            </p>
          </div>
        ) : prompts.length > 0 ? (
          <div className="overflow-y-auto -mr-5 pr-5 pb-5">
            <List navigationMode="items">
              {prompts.map((prompt) => (
                <ListItem key={prompt.name}>
                  <div className="p-3 my-2 w-full rounded-md bg-gray-50 hover:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-start items-center flex-grow">
                        <div
                          className="text-base font-bold"
                          dangerouslySetInnerHTML={{
                            __html: highlight(prompt.name, filter),
                          }}
                        />
                      </div>
                      {installedPromptNames.has(prompt.name) ? (
                        <Button 
                          appearance="primary" 
                          size="small" 
                          onClick={() => onInstall(prompt)}
                        >
                          {t('Prompt.Market.Reinstall')}
                        </Button>
                      ) : (
                        <Button
                          appearance="primary"
                          size="small"
                          onClick={() => onInstall(prompt)}
                        >
                          {t('Prompt.Market.Install')}
                        </Button>
                      )}
                    </div>
                    <p
                      className="text-gray-800 dark:text-gray-200 text-sm mt-2"
                      dangerouslySetInnerHTML={{
                        __html: highlight(prompt.description || prompt.systemMessage || '', filter),
                      }}
                    />
                  </div>
                </ListItem>
              ))}
            </List>
          </div>
        ) : (
          <Empty image="prompts" text={t('Prompt.Market.NoPrompts')} />
        )}
      </DrawerBody>
    </Drawer>
  );
} 