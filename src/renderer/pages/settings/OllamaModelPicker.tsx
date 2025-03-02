import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { isValidHttpHRL } from 'utils/validators';
import {
  MenuTrigger,
  MenuButton,
  MenuPopover,
  MenuList,
  Menu,
  MenuItem,
} from '@fluentui/react-components';
import ToolStatusIndicator from 'renderer/components/ToolStatusIndicator';
import OnlineStatusIndicator from 'renderer/components/OnlineStatusIndicator';
import ReasoningStatusIndicator from 'renderer/components/ReasoningStatusIndicator';
import FastResponseStatusIndicator from 'renderer/components/FastResponseStatusIndicator';
import UncensoredStatusIndicator from 'renderer/components/UncensoredStatusIndicator';
import MuricaStatusIndicator from 'renderer/components/MuricaStatusIndicator';
import ArjunsFavoriteStatusIndicator from 'renderer/components/ArjunsFavoriteStatusIndicator';

type Item = {
  name: string;
  isEnabled: boolean;
};

export default function OllamaModelPicker({
  baseUrl,
  onConfirm,
}: {
  baseUrl: string;
  onConfirm: (modeName: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    if (!isValidHttpHRL(baseUrl)) {
      setItems([
        {
          name: t('Common.Error.InvalidAPIBase'),
          isEnabled: false,
        },
      ]);
    } else {
      setItems([
        {
          name: t('Common.Loading'),
          isEnabled: false,
        },
      ]);
      const url = new URL('/api/tags', baseUrl);
      fetch(url.toString())
        .then((res) => {
          if (res.ok) {
            res
              .json()
              .then((data) => {
                setItems(
                  data.models.map((model: any) => {
                    return {
                      name: model.name,
                      isEnabled: model.name.indexOf('embed') < 0, // filter out embedding models
                    };
                  }),
                );
              })
              .catch(() => {
                setItems([
                  {
                    name: t('Common.Error.FetchFailed'),
                    isEnabled: false,
                  },
                ]);
              });
          } else {
            setItems([
              {
                name: t('Common.Error.FetchFailed'),
                isEnabled: false,
              },
            ]);
          }
        })
        .catch(() => {
          setItems([
            {
              name: t('Common.Error.FetchFailed'),
              isEnabled: false,
            },
          ]);
        });
    }
    return () => setItems([]);
  }, [baseUrl]);

  return (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <MenuButton size="small" appearance="primary">
          {t('Common.Action.Choose')}
        </MenuButton>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {items.map((item: Item) => (
            <MenuItem
              key={item.name}
              disabled={!item.isEnabled}
              onClick={() => onConfirm(item.name)}
            >
              <div className="flex justify-start items-center gap-1">
                <div style={{ display: 'flex', width: '68px', justifyContent: 'flex-start' }}>
                  <OnlineStatusIndicator model={item.name} provider="Ollama" withTooltip={true} />
                  <ReasoningStatusIndicator model={item.name} provider="Ollama" withTooltip={true} />
                  <FastResponseStatusIndicator model={item.name} provider="Ollama" withTooltip={true} />
                  <ToolStatusIndicator model={item.name} provider="Ollama" withTooltip={true} />
                  <UncensoredStatusIndicator model={item.name} provider="Ollama" withTooltip={true} />
                  <MuricaStatusIndicator model={item.name} provider="Ollama" withTooltip={true} />
                  <ArjunsFavoriteStatusIndicator model={item.name} provider="Ollama" withTooltip={true} />
                </div>
                <span>{item.name}</span>
              </div>
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
