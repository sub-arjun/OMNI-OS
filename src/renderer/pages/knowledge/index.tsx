import { Button } from '@fluentui/react-components';
import useNav from 'hooks/useNav';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Empty from 'renderer/components/Empty';
import Grid from './Grid';
import { ICollection } from 'types/knowledge';
import useKnowledgeStore from 'stores/useKnowledgeStore';
import { debounce } from 'lodash';
import OmniBaseConnectionDialog from 'renderer/components/knowledge/OmniBaseConnectionDialog';
import { 
  CloudSync24Regular,
  Add24Regular,
} from '@fluentui/react-icons';

export default function Knowledge() {
  const { t } = useTranslation();
  const navigate = useNav();
  const { listCollections, collectionChangedAt } = useKnowledgeStore();
  const [collections, setCollections] = useState<ICollection[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
  };

  const handleDialogSuccess = () => {
    debouncedLoad();
  };

  return (
    <div className="page h-full">
      <div className="page-top-bar"></div>
      <div className="page-header">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-2xl flex-shrink-0 mr-6">{t('Common.Knowledge')}</h1>
          <div className="flex justify-end w-full items-center gap-2">
            <Button
              appearance="outline"
              onClick={() => setDialogOpen(true)}
              icon={<CloudSync24Regular />}
              title={t('Knowledge.SyncWithOmniBase')}
            >
              {t('Knowledge.Sync')}
            </Button>
            <Button
              appearance="primary"
              onClick={() => navigate('/knowledge/collection-form')}
              icon={<Add24Regular />}
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
      
      <OmniBaseConnectionDialog 
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        onSuccess={handleDialogSuccess}
      />
    </div>
  );
}
