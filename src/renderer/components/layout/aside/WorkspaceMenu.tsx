import Debug from 'debug';
import {
  Avatar,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  MenuDivider,
  MenuProps,
  Button,
  Persona,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  DataUsage24Regular,
  Fire24Regular,
  Fire24Filled,
  Wifi124Filled,
  Wifi124Regular,
  DataArea24Regular,
  DataArea24Filled,
  ReceiptSparkles24Regular,
  Settings24Regular,
  Settings24Filled,
  SignOut24Regular,
} from '@fluentui/react-icons';
import { useTranslation } from 'react-i18next';
import useAppearanceStore from 'stores/useAppearanceStore';
import useNav from 'hooks/useNav';
import { useEffect, useState, memo, useCallback } from 'react';
import useToast from 'hooks/useToast';
import useAuthStore from 'stores/useAuthStore';
import { useDrop } from 'react-dnd';
import { DragItemType } from '@/renderer/types/dnd';
import { css, cx } from '@emotion/css';
import { ProviderType } from '@/types/llm';
import { MenuButtonProps } from './MenuButton';
import { useChat } from '@/renderer/hooks/useChat';

const debug = Debug('OMNI:components:layout:aside:WorkspaceMenu');

const FireIcon = bundleIcon(Fire24Filled, Fire24Regular);
const SettingsIcon = bundleIcon(Settings24Filled, Settings24Regular);

export default function WorkspaceMenu({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const navigate = useNav();
  const { notifySuccess, notifyError } = useToast();
  const theme = useAppearanceStore((state) => state.theme);
  const user = useAuthStore((state) => state.user);

  const navToProfile = () => {
    if (!user) {
      navigate('/user/login');
    } else {
      navigate('/user/account');
    }
    setOpen(false);
  };

  const signOut = async () => {
    const { error } = await useAuthStore.getState().signOut();
    if (error) {
      notifyError(error.message);
    } else {
      notifySuccess(t('Notification.SignOutSuccess'));
      navigate('/user/login');
    }
  };

  const onOpenChange: MenuProps['onOpenChange'] = (e, data) => {
    setOpen(data.open);
  };

  useEffect(() => {
    Mousetrap.bind('mod+,', () => navigate('/settings'));
    return () => {
      Mousetrap.unbind('mod+k');
      Mousetrap.unbind('mod+,');
    };
  }, []);

  return (
    <div>
      <Menu open={open} onOpenChange={onOpenChange}>
        <div
          className={`${collapsed ? '' : 'flex items-center justify-between w-full'}`}
        >
          <MenuTrigger disableButtonEnhancement>
            {collapsed ? (
              <Button
                appearance="subtle"
                style={{borderColor: 'transparent', boxShadow: 'none'}}
                className="w-full justify-center outline-none hover:bg-black/10 dark:hover:bg-white/10 relative"
                onClick={() => setOpen(true)}
                icon={<SettingsIcon className="text-gray-500" fontSize={24} />}
              />
            ) : (
              <div className="flex w-full items-center justify-between">
                <span className="text-3xl tracking-wide pl-2" style={{ fontSize: '2.2rem', textShadow: '0 0 3px rgba(255,255,255,0.25)' }}>
                  <span className="font-black"><strong>{t('Common.AppName', 'OMNI')}</strong></span>
                </span>
                <Button
                  appearance="subtle"
                  style={{borderColor: 'transparent', boxShadow: 'none'}}
                  className="min-w-[36px] w-[36px] h-[36px] p-0 justify-center outline-none hover:bg-black/10 dark:hover:bg-white/10 relative"
                  onClick={() => setOpen(true)}
                  icon={<SettingsIcon className="text-gray-500" fontSize={20} />}
                />
              </div>
            )}
          </MenuTrigger>
        </div>
        <MenuPopover
          className="w-full"
          style={{ width: '254px' }}
          data-theme={theme}
        >
          <Button
            onClick={navToProfile}
            appearance="subtle"
            className="w-full justify-start"
          >
            <div className="px-0 py-1.5">
              {user ? (
                <div className="flex justify-start flex-nowrap items-center">
                  <Persona
                    size="large"
                    name={user.user_metadata.name}
                    secondaryText={user.email}
                    avatar={
                      <Avatar
                        aria-label={t('Common.User')}
                        name={user.user_metadata.name}
                        color="colorful"
                        className="mr-2"
                        shape="square"
                        size={40}
                      />
                    }
                  />
                </div>
              ) : (
                <div className="flex justify-start flex-nowrap items-center">
                  <Avatar
                    aria-label={t('Common.Guest')}
                    className="mr-2"
                    shape="square"
                    size={40}
                  />
                  <span>{t('Common.SignIn')}</span>
                </div>
              )}
            </div>
          </Button>
          <MenuList>
            <MenuDivider className="border-base" />
            <MenuItem
              title='mod+k'
              icon={<SettingsIcon />}
              onClick={() => {
                navigate('/settings');
              }}
            >
              {t('Common.Settings')}
            </MenuItem>
            <MenuItem
              icon={<DataUsage24Regular />}
              onClick={(e) => {
                e.preventDefault();
                // Prevent navigation to analytics
              }}
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            >
              {t('Common.Analytics')} <span className="text-xs ml-2">(Coming Soon)</span>
            </MenuItem>
            {user ? (
              <div>
                <MenuDivider />
                <MenuItem icon={<SignOut24Regular />} onClick={signOut}>
                  {t('Common.SignOut')}
                </MenuItem>
              </div>
            ) : null}
          </MenuList>
        </MenuPopover>
      </Menu>
    </div>
  );
}
