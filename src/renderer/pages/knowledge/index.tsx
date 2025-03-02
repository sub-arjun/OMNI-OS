import { Button } from '@fluentui/react-components';
import useNav from 'hooks/useNav';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Empty from 'renderer/components/Empty';
import Grid from './Grid';
import { ICollection } from 'types/knowledge';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import { debounce } from 'lodash';

export default function Knowledge() {
  const { t } = useTranslation();
  const navigate = useNav();
  const { listCollections, collectionChangedAt } = useKnowledgeStore();
  const [collections, setCollections] = useState<ICollection[]>([]);

  const debouncedLoad= useRef(
    debounce(() => {
      listCollections().then((collections: ICollection[]) => {
        setCollections(collections);
      });
    }, 1000, { leading: true })
  ).current;

  useEffect(() => {
    debouncedLoad();
  }, [collectionChangedAt]);

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Knowledge')}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button
              appearance="primary"
              onClick={() => navigate('/knowledge/collection-form')}
            >
              {t('Common.New')}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-2.5 pb-12 h-full -mr-5 overflow-y-auto">
        {collections.length ? (
          <div className="mr-5 flex justify-start gap-2 flex-wrap">
            <Grid collections={collections} />
          </div>
        ) : (
          <Empty image="knowledge" text={t('\"You know nothing Jon Snow!\" ~ Redhead lady from spiky chair gameshow.')} />
        )}
      </div>
    </div>
  );
}
