import {
  Avatar,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  SelectTabEvent,
  Tab,
  TabList,
  Text,
} from '@fluentui/react-components';
import {
  CheckmarkStarburst16Filled,
  ShieldKeyhole24Regular,
} from '@fluentui/react-icons';
import { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import Empty from 'renderer/components/Empty';
import useAppearanceStore from 'stores/useAppearanceStore';
import useAuthStore from 'stores/useAuthStore';
import TabPassword from './TabPassword';

const MemorizedTabPassword = memo(TabPassword);

export default function Account() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const getPalette = useAppearanceStore((state) => state.getPalette);

  const [tab, setTab] = useState('password');

  const onTabSelect = (_: SelectTabEvent, tabItem: any) => {
    setTab(tabItem.value);
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Account')}</h1>
        </div>
      </div>
      {user?.confirmed_at ? null : (
        <div className="page-msg">
          <MessageBar key="warning" intent="warning">
            <MessageBarBody>
              <MessageBarTitle>
                {t('Account.Notification.InactiveAccountTitle')}
              </MessageBarTitle>
              <Text>{t('Account.Notification.InactiveAccountInfo')}</Text>
            </MessageBarBody>
          </MessageBar>
        </div>
      )}
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {user ? (
          <div>
            <div className="flex justify-start flex-nowrap items-center">
              <Avatar
                aria-label={t('Common.User')}
                name={user.user_metadata.name}
                color="colorful"
                className="mr-2"
                size={56}
              />
              <div>
                <div>
                  <Text truncate size={500}>
                    <b>{user.user_metadata.name}</b>
                  </Text>
                </div>
                <div>
                  <Text truncate>{user.email}</Text>
                  {user.confirmed_at ? (
                    <CheckmarkStarburst16Filled
                      primaryFill={getPalette('success')}
                    />
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-10 flex justify-start items-start h-5/6">
              <div className="flex-shrink-0 h-full">
                <TabList selectedValue={tab} vertical onTabSelect={onTabSelect}>
                  <Tab
                    value="password"
                    icon={<ShieldKeyhole24Regular className="tips" />}
                  >
                    {t('Common.Password')}
                  </Tab>
                </TabList>
              </div>
              <div className="border-l border-base w-full px-5">
                {tab == 'password' && <MemorizedTabPassword />}
              </div>
            </div>
          </div>
        ) : (
          <Empty image="door" text={t('Notification.SignOutSuccess')} />
        )}
      </div>
    </div>
  );
}
