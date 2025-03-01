import { captureException } from '../../logging';
import { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RadioGroup,
  Radio,
  RadioGroupOnChangeData,
} from '@fluentui/react-components';
import { LanguageType } from '../../../types/settings.d';
import useSettingsStore from '../../../stores/useSettingsStore';

export default function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);

  const onLanguageChange = (
    ev: FormEvent<HTMLDivElement>,
    data: RadioGroupOnChangeData
  ) => {
    setLanguage(data.value as LanguageType);
    if (data.value === 'system') {
      window.electron
        .getSystemLanguage()
        .then((_lang) => {
          i18n.changeLanguage(_lang as LanguageType);
          return;
        })
        .catch(captureException);
    } else {
      i18n.changeLanguage(data.value as LanguageType);
    }
    setLanguage(data.value as LanguageType);
  };
  return (
    <div className="settings-section">
      <div className="settings-section--header">{t('Common.Language')}</div>
      <div className="py-4 flex-grow">
        <RadioGroup
          aria-labelledby={t('Common.Language')}
          value={language}
          onChange={onLanguageChange}
        >
          <Radio name="language" value="en" label={t('Common.English')} />
          <Radio name="language" value="system" label={t('Appearance.System')} />
        </RadioGroup>
      </div>
    </div>
  );
}
