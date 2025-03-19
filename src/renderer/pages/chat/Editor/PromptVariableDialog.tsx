import {
  Dialog,
  DialogTrigger,
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  Field,
  Input,
  DialogActions,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function PromptVariableDialog(args: {
  open: boolean;
  systemVariables: string[];
  userVariables: string[];
  onCancel: () => void;
  onConfirm: (
    systemVars: { [key: string]: string },
    userVars: { [key: string]: string }
  ) => void;
}) {
  const { t } = useTranslation();
  const { open, systemVariables, userVariables, onCancel, onConfirm } = args;

  const [systemVars, setSystemVars] = useState<{ [key: string]: string }>({});
  const [userVars, setUserVars] = useState<{ [key: string]: string }>({});

  // Reset state when dialog is opened
  useEffect(() => {
    if (open) {
      setSystemVars({});
      setUserVars({});
    }
  }, [open]);

  const onSystemVariesChange = (key: string, value: string) => {
    setSystemVars({ ...systemVars, [key]: value });
  };

  const onUserVariesChange = (key: string, value: string) => {
    setUserVars({ ...userVars, [key]: value });
  };

  const handleConfirm = () => {
    onConfirm(systemVars, userVars);
    setSystemVars({});
    setUserVars({});
  };

  return (
    <Dialog open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={<Dismiss24Regular />}
                  onClick={onCancel}
                />
              </DialogTrigger>
            }
          >
            {t('Fill Variables')}
          </DialogTitle>
          <DialogContent>
            <div>
              {systemVariables.length ? (
                <div className="mb-4">
                  <div className="text-base font-medium">
                    {t('Common.SystemMessage')}
                    {' '}
                    {t('Common.Variables')}
                  </div>
                  {systemVariables.map((variable) => {
                    return (
                      <Field
                        label={variable}
                        key={`system-var-${variable}`}
                        className="my-2"
                      >
                        <Input
                          className="w-full"
                          value={systemVars[variable] || ''}
                          onChange={(e) =>
                            onSystemVariesChange(variable, e.target.value || '')
                          }
                        />
                      </Field>
                    );
                  })}
                </div>
              ) : null}
              {userVariables.length ? (
                <div>
                  <div className="text-base font-medium">
                    {t('User Message')}
                    {' '}
                    {t('Common.Variables')}
                  </div>
                  {userVariables.map((variable) => {
                    return (
                      <Field
                        label={variable}
                        key={`user-var-${variable}`}
                        className="my-2"
                      >
                        <Input
                          className="w-full"
                          value={userVars[variable] || ''}
                          onChange={(e) =>
                            onUserVariesChange(variable, e.target.value || '')
                          }
                        />
                      </Field>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle" onClick={onCancel}>
                {t('Common.Cancel')}
              </Button>
            </DialogTrigger>
            <Button appearance="primary" onClick={handleConfirm}>
              {t('OK')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
