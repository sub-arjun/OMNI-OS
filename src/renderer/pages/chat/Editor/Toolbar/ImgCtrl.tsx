import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  InputOnChangeData,
  Radio,
  RadioGroup,
  makeStyles,
  Text
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import {
  bundleIcon,
  ImageAdd20Regular,
  ImageAdd20Filled,
  Dismiss24Regular,
  LinkSquare20Regular,
  ArrowUpload24Regular,
} from '@fluentui/react-icons';

import { IChat, IChatContext } from 'intellichat/types';
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isBlank } from 'utils/validators';
import { isWebUri } from 'valid-url';
import { insertAtCursor } from 'utils/util';
import { IChatModelVision } from 'providers/types';
import useChatStore from 'stores/useChatStore';

const ImageAddIcon = bundleIcon(ImageAdd20Filled, ImageAdd20Regular);

const useStyles = makeStyles({
  uploadArea: {
    border: '2px dashed #ccc',
    borderRadius: '4px',
    padding: '20px',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: '10px',
    minHeight: '150px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorMessage: {
    color: 'var(--colorStatusDangerForeground1)',
    marginTop: '8px'
  },
});

export default function ImgCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const editStage = useChatStore((state) => state.editStage);
  const { t } = useTranslation();
  const styles = useStyles();

  const [imgType, setImgType] = useState<'url' | 'file'>('file');
  const [imgURL, setImgURL] = useState<string>('');
  const [imgName, setImgName] = useState<string>('');
  const [imgBase64, setImgBase64] = useState<string>('');
  const [errMsg, setErrMsg] = useState<string>('');
  const [open, setOpen] = useState<boolean>(false);
  const model = ctx.getModel();

  const openDialog = () => {
    setOpen(true);
    setTimeout(
      () =>
        document
          .querySelector<HTMLInputElement>(
            imgType === 'url' ? '#image-url-input' : '#upload-area'
          )
          ?.focus(),
      500
    );
    Mousetrap.bind('esc', closeDialog);
  };

  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  const vision = useMemo<IChatModelVision>(() => {
    return model?.vision || { enabled: false };
  }, [model]);

  useEffect(() => {
    Mousetrap.bind('mod+shift+7', openDialog);
    if (vision.enabled) {
      setImgType(vision.allowUrl && !vision.allowBase64 ? 'url' : 'file');
    }
    return () => {
      Mousetrap.unbind('mod+shift+7');
    };
  }, [vision]);

  const isAddBtnDisabled = useMemo(() => {
    return isBlank(imgURL) && isBlank(imgBase64);
  }, [imgURL, imgBase64]);

  const onImageUrlChange = (
    ev: ChangeEvent<HTMLInputElement>,
    data: InputOnChangeData
  ) => {
    setImgURL(data.value);
  };

  const handleSelectImage = async () => {
    try {
      const dataString = await window.electron.selectImageWithBase64();
      if (dataString) {
        const file = JSON.parse(dataString);
        if (file.name && file.base64) {
          setImgName(file.name);
          setImgBase64(file.base64);
          setErrMsg('');
        }
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      setErrMsg(t('Please input a valid image.'));
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    // Note: For security reasons, Electron doesn't allow direct file access from dropped files
    // We'll prompt the user to use the file selector instead
    setErrMsg(t('Please click to select an image file.'));
  };

  const Add = () => {
    let url = null;
    if (imgURL) {
      if (!isWebUri(imgURL) && !imgURL.startsWith('data:')) {
        setErrMsg(t('Please input a valid image URL or base64 string.'));
        return;
      }
      url = imgURL;
    } else if (imgBase64) {
      url = imgBase64;
    }
    setErrMsg('');
    const editor = document.querySelector('#editor') as HTMLDivElement;
    editStage(chat.id, {
      input: insertAtCursor(
        editor,
        `<img src="${url}" style="width:260px; display:block;" />`
      ),
    });
    setOpen(false);
    setImgURL('');
    setImgBase64('');
    setImgName('');
    editor.focus();
  };

  const renderImgUrlInput = () => {
    return (
      <Input
        value={imgURL}
        type="url"
        contentBefore={<LinkSquare20Regular />}
        id="image-url-input"
        className="w-full"
        onChange={onImageUrlChange}
      />
    );
  };

  const renderImgFileInput = () => {
    return (
      <div>
        <div 
          id="upload-area"
          className={styles.uploadArea} 
          onClick={handleSelectImage}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          tabIndex={0}
        >
          <ArrowUpload24Regular />
          <Text>
            {imgName 
              ? imgName 
              : t('Common.SelectImage') + " - " + t('Common.Image') + " (jpg, png, jpeg)"}
          </Text>
        </div>
        {errMsg && <Text className={styles.errorMessage}>{errMsg}</Text>}
      </div>
    );
  };

  return vision.enabled ? (
    <Dialog open={open}>
      <DialogTrigger disableButtonEnhancement>
        <Button
          aria-label={t('Common.Image')}
          title="Mod+Shift+6"
          size="small"
          appearance="subtle"
          iconPosition="before"
          style={{ boxShadow: 'none', borderColor: 'transparent' }}
          className="justify-start text-color-secondary"
          onClick={openDialog}
          icon={<ImageAddIcon />}
        ></Button>
      </DialogTrigger>
      <DialogSurface aria-labelledby="add image">
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  onClick={closeDialog}
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            {t('Editor.Toolbar.AddImage')}
          </DialogTitle>
          <DialogContent>
            <div className="w-full mb-5">
              <Field>
                <RadioGroup
                  layout="horizontal"
                  value={imgType}
                  onChange={(_, data: any) => {
                    setImgType(data.value);
                    setErrMsg('');
                  }}
                >
                  <Radio value="file" label="File" />
                  <Radio value="url" label="URL" />
                </RadioGroup>
              </Field>

              <div className="mt-2">
                <Field>
                  {imgType === 'url'
                    ? renderImgUrlInput()
                    : renderImgFileInput()}
                </Field>
              </div>
            </div>
          </DialogContent>
          <DialogActions>
            <DialogTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                onClick={() => {
                  setOpen(false);
                  setImgURL('');
                  setImgBase64('');
                  setImgName('');
                  setErrMsg('');
                }}
              >
                {t('Common.Cancel')}
              </Button>
            </DialogTrigger>
            <Button
              appearance="primary"
              disabled={isAddBtnDisabled}
              onClick={Add}
            >
              {t('Add')}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  ) : null;
}
