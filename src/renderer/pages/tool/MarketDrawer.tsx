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
import useMCPServerMarketStore from 'stores/useMCPServerMarketStore';
import Spinner from 'renderer/components/Spinner';
import { IMCPServer } from 'types/mcp';
import useMCPStore from 'stores/useMCPStore';
import { debounce } from 'lodash';
import { highlight } from 'utils/util';
import Empty from 'renderer/components/Empty';

export default function ToolMarketDrawer({
  open,
  setOpen,
  onInstall,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onInstall: (server: IMCPServer) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { fetchServers, servers: allServers } = useMCPServerMarketStore();
  const { config } = useMCPStore();
  const [filter, setFilter] = useState<string[]>([]);

  const debouncedSearch = useRef(
    debounce((_: SearchBoxChangeEvent, data: InputOnChangeData) => {
      const value = data.value || '';
      const terms = value.split(/\s+/g).filter(Boolean);
      setFilter(terms);
    }, 500),
  ).current;

  const servers = useMemo(() => {
    let filteredServers = allServers;
    if (filter.length > 0) {
      filteredServers = allServers.filter((s: any) => {
        return filter.every((f) => {
          return (
            (s.name || s.key).toLowerCase().includes(f.toLowerCase()) ||
            (s.description || '').toLowerCase().includes(f.toLowerCase())
          );
        });
      });
    }
    return filteredServers.sort((a, b) => {
      const nameA = a.name || a.key;
      const nameB = b.name || b.key;
      return nameA.localeCompare(nameB);
    });
  }, [filter, allServers]);

  const installedServer = useMemo(
    () => new Set(config.servers.map((svr: IMCPServer) => svr.key)),
    [config.servers],
  );

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      await fetchServers();
    } finally {
      setLoading(false);
    }
  }, [fetchServers]);

  useEffect(() => {
    if (open) {
      Mousetrap.bind('esc', () => setOpen(false));
      loadServers();
    }
    return () => {
      Mousetrap.unbind('esc');
    };
  }, [open, loadServers]);

  // Function to check if a card has a white background and add the white-bg class
  const checkCardBackgrounds = () => {
    const cards = document.querySelectorAll('.market-card');
    cards.forEach(card => {
      // Get the computed background color
      const bgColor = window.getComputedStyle(card).backgroundColor;
      // Check if it's white or very light
      if (bgColor === 'rgb(255, 255, 255)' || 
          bgColor === 'rgba(255, 255, 255, 1)' ||
          bgColor.includes('255, 255, 255')) {
        card.classList.add('white-bg');
      } else {
        card.classList.remove('white-bg');
      }
    });
  };

  useEffect(() => {
    if (open) {
      // Check immediately after render
      setTimeout(checkCardBackgrounds, 50);
      
      // Check periodically while drawer is open
      const interval = setInterval(checkCardBackgrounds, 500);
      
      return () => clearInterval(interval);
    }
  }, [open, servers, filter]);
  
  // Additional check when server list changes
  useEffect(() => {
    if (open && servers.length > 0) {
      setTimeout(checkCardBackgrounds, 100);
    }
  }, [servers, filter]);

  return (
    <Drawer
      type="overlay"
      separator
      open={open}
      onOpenChange={(_, { open }) => setOpen(open)}
      position="end"
      style={{ width: '400px' }}
    >
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
            <SearchBox onChange={debouncedSearch} />
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
        ) : servers.length > 0 ? (
          <div className="overflow-y-auto -mr-5 pr-5 pb-5">
            <List navigationMode="items">
              {servers.map((server) => (
                <ListItem key={server.key}>
                  <div className="p-3 my-2 w-full rounded-md bg-gray-50 hover:bg-gray-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 shadow-sm market-card">
                    <div className="flex justify-between items-center">
                      <div className="flex flex-start items-center flex-grow">
                        <div
                          className="text-base font-bold text-gray-900 dark:text-white market-card-title"
                          dangerouslySetInnerHTML={{
                            __html: highlight(
                              server.name || server.key,
                              filter,
                            ),
                          }}
                        />
                      </div>
                      {installedServer.has(server.key) ? (
                        <Button 
                          appearance="primary" 
                          size="small" 
                          onClick={() => onInstall(server)}
                        >
                          {t('Common.Action.Reinstall')}
                        </Button>
                      ) : (
                        <Button
                          appearance="primary"
                          size="small"
                          onClick={() => onInstall(server)}
                        >
                          {t('Common.Action.Install')}
                        </Button>
                      )}
                    </div>
                    <p
                      className="text-gray-800 dark:text-gray-200 text-sm mt-2 market-card-description"
                      dangerouslySetInnerHTML={{
                        __html: highlight(server.description || '', filter),
                      }}
                    />
                  </div>
                </ListItem>
              ))}
            </List>
          </div>
        ) : (
          <Empty image="tools" text={t('Tool.Info.Empty')} />
        )}
      </DrawerBody>
    </Drawer>
  );
}
