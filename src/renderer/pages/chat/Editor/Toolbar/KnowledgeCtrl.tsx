import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Combobox,
  Option,
  ComboboxProps,
  Divider,
} from '@fluentui/react-components';
import Mousetrap from 'mousetrap';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Debug from 'debug';

import { IChat, IChatContext } from 'intellichat/types';
import {
  Library20Regular,
  Library20Filled,
  Dismiss24Regular,
  DismissCircle16Regular,
  bundleIcon,
} from '@fluentui/react-icons';
import { ICollection } from 'types/knowledge';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import useChatKnowledgeStore from 'stores/useChatKnowledgeStore';
import React from 'react';

const debug = Debug('OMNI-OS:pages:chat:Editor:Toolbar:KnowledgeCtrl');

const KnowledgeIcon = bundleIcon(Library20Filled, Library20Regular);

export default function KnowledgeCtrl({
  ctx,
  chat,
}: {
  ctx: IChatContext;
  chat: IChat;
}) {
  const { t } = useTranslation();
  const { listCollections } = useKnowledgeStore();
  const { listChatCollections, setChatCollections, removeChatCollection } =
    useChatKnowledgeStore();
  const [open, setOpen] = useState<boolean>(false);
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    []
  );
  const [selectedCollections, setSelectedCollections] = useState<ICollection[]>(
    []
  );

  const openDialog = () => {
    listCollections().then(async (collections) => {
      setCollections(collections);
      const chatCollections = await listChatCollections(chat.id);
      if (!chatCollections) return;
      setSelectedCollections(chatCollections);
      setSelectedCollectionIds(chatCollections.map((c) => c.id));
      document
        .querySelector<HTMLInputElement>('input[role="combobox"]')
        ?.focus();
    });
    setOpen(true);
    Mousetrap.bind('esc', closeDialog);
  };

  const closeDialog = () => {
    setOpen(false);
    Mousetrap.unbind('esc');
  };

  useEffect(() => {
    Mousetrap.bind('mod+shift+3', openDialog);
    listChatCollections(chat.id)
      .then((chatCollections) => {
        setSelectedCollections(chatCollections);
        setSelectedCollectionIds(chatCollections.map((c) => c.id));
      })
      .catch((err: any) => {
        setSelectedCollectionIds([]);
        setSelectedCollections([]);
        debug(err);
      });
    return () => {
      Mousetrap.unbind('mod+shift+3');
    };
  }, [chat.id]);

  const onCollectionSelect: ComboboxProps['onOptionSelect'] = async (
    _,
    data
  ) => {
    setSelectedCollectionIds(data.selectedOptions);
    let selectedCollections = collections.filter((collection: ICollection) =>
      data.selectedOptions.includes(collection.id)
    );
    const ok = await setChatCollections(chat.id, selectedCollections);
    ok && setSelectedCollections(selectedCollections);
  };

  const onCollectionRemove = async (collection: ICollection) => {
    setSelectedCollectionIds(
      selectedCollectionIds.filter(
        (collectionId: string) => collectionId !== collection.id
      )
    );
    const ok = await removeChatCollection(chat.id, collection.id);
    ok &&
      setSelectedCollections(
        selectedCollections.filter((c: ICollection) => c.id !== collection.id)
      );
  };

  return (
    <div>
      <Dialog open={open}>
        <DialogTrigger disableButtonEnhancement>
          <Button
            size="small"
            title="Mod+Shift+3"
            aria-label={t('Common.Knowledge')}
            className="justify-start text-color-secondary"
            style={{ padding: 1, minWidth: 20,borderColor: 'transparent', boxShadow: 'none' }}
            appearance="subtle"
            onClick={openDialog}
            icon={<KnowledgeIcon />}
          >
            {selectedCollections.length > 0 && selectedCollections.length}
          </Button>
        </DialogTrigger>
        <DialogSurface>
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
              {t('Knowledge.Collection')}
            </DialogTitle>
            <DialogContent>
              <div>
                <Combobox
                  className="w-full"
                  multiselect={true}
                  placeholder="Select one or more knowledge collections"
                  onOptionSelect={onCollectionSelect}
                  selectedOptions={selectedCollectionIds}
                >
                  {collections.map((collection: ICollection) => (
                    <Option
                      key={collection.id}
                      value={collection.id}
                      text={collection.name}
                      disabled={collection.numOfFiles === 0}
                    >
                      <div className="flex justify-between items-center w-full">
                        <div>{collection.name}</div>
                        <div>{collection.numOfFiles} files</div>
                      </div>
                    </Option>
                  ))}
                </Combobox>
              </div>
              <div className="py-2 mt-2">
                <Divider>
                  {t('Editor.Toolbar.KnowledgeCtrl.SelectedCollections')}
                </Divider>
              </div>
              <div className="min-h-28">
                {selectedCollections.map((collection: ICollection) => (
                  <div
                    className="my-1 py-1 px-2 rounded flex justify-between items-center"
                    key={collection.id}
                  >
                    <div className="flex justify-start gap-1">
                      <span className="font-semibold">{collection.name}</span>
                      <span className="inline-block ml-2">
                        ({collection.numOfFiles} files)
                      </span>
                    </div>
                    <Button
                      icon={<DismissCircle16Regular />}
                      appearance="subtle"
                      onClick={() => onCollectionRemove(collection)}
                    />
                  </div>
                ))}
              </div>
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
