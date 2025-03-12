import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogContent,
  DialogTrigger,
  DialogBody,
  Button,
  Field,
  Input,
  DialogActions,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import { useTranslation } from 'react-i18next';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as mcpUtils from 'utils/mcp';
import { captureException } from '../../logging';
import { IMCPServer, IMCPServerParameter, MCPArgParameter } from 'types/mcp';
import ListInput from 'renderer/components/ListInput';
import useMCPStore from 'stores/useMCPStore';
import { isNumeric } from 'utils/validators';

export default function ToolInstallDialog(options: {
  server: IMCPServer;
  open: boolean;
  setOpen: Function;
}) {
  const { server, open, setOpen } = options;
  const { t } = useTranslation();
  const { addServer } = useMCPStore();
  const args = useMemo(() => {
    const extractedArgs = mcpUtils.getParameters(server.args);
    console.log('Extracted arguments parameters:', extractedArgs, 'from:', server.args);
    return extractedArgs;
  }, [server.args]);
  const env = useMemo(() => {
    const extractedEnv = mcpUtils.getParameters(Object.values(server.env || {}));
    console.log('Extracted environment parameters:', extractedEnv, 'from:', server.env);
    return extractedEnv;
  }, [server.env]);
  const hasParams = useMemo(
    () => args.length > 0 || env.length > 0,
    [args, env],
  );
  const [argParams, setArgParams] = useState<{
    [key: string]: string | string[];
  }>({});
  const [envParams, setEnvParams] = useState<{ [key: string]: string }>({});
  const [errorMessages, setErrorMessages] = useState<{ [key: string]: string }>(
    {},
  );

  const setValue = (
    type: 'args' | 'env',
    key: string,
    value: string | string[],
  ) => {
    if (type === 'args') {
      setArgParams((state) => ({ ...state, [key]: value }));
    } else if (type === 'env') {
      setEnvParams((state) => ({ ...state, [key]: value as string }));
    } else {
      captureException(`Invalid MCP parameter type:${type}`);
    }
  };

  const isParamValid = useCallback(
    (
      paramDefs: IMCPServerParameter[],
      paramVals: { [key: string]: string | string[] },
    ) => {
      let isAllValid = true;
      paramDefs.forEach((param: IMCPServerParameter) => {
        const paramValue = paramVals[param.name];
        let isValid = true;
        if (param.type === 'number') {
          if (!isNumeric(paramValue as string)) {
            setErrorMessages((state) => ({
              ...state,
              [param.name]: t('Common.Validation.MustBeNumber'),
            }));
            isValid = false;
          }
        } else if (param.type === 'list') {
          if (paramValue?.length === 0) {
            setErrorMessages((state) => ({
              ...state,
              [param.name]: t('Common.Required'),
            }));
            isValid = false;
          }
        } else {
          if (((paramValue as string) || '').trim() === '') {
            setErrorMessages((state) => ({
              ...state,
              [param.name]: t('Common.Required'),
            }));
            isValid = false;
          }
        }
        if (isValid) {
          setErrorMessages((state) => {
            delete state[param.name];
            return state;
          });
        }
        isAllValid = isAllValid && isValid;
      });
      return isAllValid;
    },
    [],
  );

  const install = async () => {
    const isArgValid = isParamValid(args, argParams);
    const isEnvValid = isParamValid(env, envParams);
    if (isArgValid && isEnvValid) {
      const payload = {
        ...server,
        args: mcpUtils.fillArgs(server.args, argParams as MCPArgParameter),
      };
      if (Object.keys(envParams).length > 0) {
        payload.env = mcpUtils.FillEnv(server.env, envParams);
      }
      addServer(payload);
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open) {
      Mousetrap.bind('esc', () => setOpen(false));
    }
    return () => {
      Mousetrap.unbind('esc');
      setArgParams({});
      setEnvParams({});
      setErrorMessages({});
    };
  }, [open]);

  const Form = (type: 'args' | 'env', params: IMCPServerParameter[]) => {
    if (params.length === 0) return null;
    return (
      <div className="mb-5">
        <div className="text-base font-bold mb-2 text-gray-800 dark:text-gray-200">
          {type === 'args' ? t('Common.Arguments') : t('Common.Environment')}
        </div>
        <div className="flex flex-col gap-3">
          {params.map((param: IMCPServerParameter) => {
            return (
              <div key={param.name}>
                {param.type === 'list' ? (
                  <Field
                    label={param.name}
                    validationMessage={errorMessages[param.name]}
                    validationState={
                      errorMessages[param.name] ? 'error' : 'none'
                    }
                  >
                    <ListInput
                      label={param.name}
                      placeholder={param.description}
                      onChange={(value: string[]) => {
                        setValue(type, param.name, value);
                      }}
                    />
                  </Field>
                ) : (
                  <Field
                    label={param.name}
                    validationMessage={errorMessages[param.name]}
                    validationState={
                      errorMessages[param.name] ? 'error' : 'none'
                    }
                  >
                    <Input
                      className="w-full"
                      placeholder={param.description}
                      onChange={(_, data) => {
                        setValue(type, param.name, data.value);
                      }}
                    />
                  </Field>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open}>
      <DialogSurface
        mountNode={document.body.querySelector('#portal')}
        className="shadow-lg"
      >
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
            <span className="text-gray-900 dark:text-white font-semibold">{server.name || server.key}</span>
          </DialogTitle>
          <DialogContent>
            {hasParams ? (
              <>
                {Form('args', args)}
                {Form('env', env)}
              </>
            ) : (
              <div className="flex flex-col gap-2 py-3">
                <span className="text-gray-800 dark:text-gray-200">
                  {server.description || t('Tools.InstallConfirmation')}
                </span>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="subtle" onClick={() => setOpen(false)}>
                {t('Common.Cancel')}
              </Button>
            </DialogTrigger>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" onClick={install}>
                {t('Common.Action.Install')}
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
