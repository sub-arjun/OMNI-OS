import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Empty from 'renderer/components/Empty';
import TooltipIcon from 'renderer/components/TooltipIcon';
import useMCPStore from 'stores/useMCPStore';
import Grid from './Grid';
import {
  Button,
  makeStyles,
  Text,
} from '@fluentui/react-components';
import {
  ArrowSyncCircleRegular,
  BuildingShopFilled,
  BuildingShopRegular,
  bundleIcon,
  ArrowClockwise16Filled,
  Add16Regular,
  ReOrderDotsVertical24Regular,
  Add24Regular,
  ArrowClockwise24Regular,
  Cart24Regular,
  ArrowUpload24Regular,
  MoreHorizontalFilled,
  MoreHorizontalRegular,
  Info16Regular,
  ArrowSync16Regular
} from '@fluentui/react-icons';
import ToolEditDialog from './EditDialog';
import { IMCPServer, IMCPConfig } from 'types/mcp';
import useToast from '../../../hooks/useToast';
import ConfirmDialog from 'renderer/components/ConfirmDialog';
import DetailDialog from './DetailDialog';
import InstallDialog from './InstallDialog';
import MarketDrawer from './MarketDrawer';
import ImportMCPConfigDialog from 'renderer/components/ImportMCPConfigDialog';
import useMCPServerMarketStore from 'stores/useMCPServerMarketStore';

const BuildingShopIcon = bundleIcon(BuildingShopFilled, BuildingShopRegular);

const useStyles = makeStyles({
  pageContainer: {
    padding: '20px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '20px',
  },
  pageTitleSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  pageTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '4px',
  },
  toolsHeading: {
    margin: 0,
    fontSize: '38px',
    fontWeight: '400',
    color: '#5f4325',  // Brown color to match the theme
    lineHeight: '1.2',
  },
  subtitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '4px',
    color: 'var(--colorNeutralForeground2)',
    fontSize: '14px'
  },
  pageActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  pageContent: {
    flex: '1 1 auto',
    overflowY: 'auto',
    marginTop: '12px',
  },
  actionButton: {
    minWidth: '120px'
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  refreshButton: {
    minWidth: '32px',
    height: '32px',
    padding: '0',
    borderRadius: '50%',
  },
  rotateIcon: {
    animation: 'spin 1s linear infinite',
  },
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  }
});

export default function Tools() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { loadConfig, config, isLoading, addServer, updateServer, deleteServer, activateServer, deactivateServer } = useMCPStore();
  const { fetchServers } = useMCPServerMarketStore();
  const { notifySuccess, notifyError } = useToast();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingServer, setEditingServer] = useState<IMCPServer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingServer, setDeletingServer] = useState<IMCPServer | null>(null);
  const [detailServer, setDetailServer] = useState<IMCPServer | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadMCPConfig = async (force: boolean, animate: boolean) => {
    try {
      animate && setLoading(true);
      await loadConfig(force);
    } catch (error) {
      console.error(error);
    } finally {
      animate && setLoading(false);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    loadMCPConfig(true, true);
    // Ensure the loading animation runs for at least a moment
    setTimeout(() => setLoading(false), 1000);
  };

  const editServer = useCallback((server: IMCPServer) => {
    setEditingServer(server);
    setEditing(true);
  }, []);

  const newServer = useCallback(() => {
    setEditingServer(null);
    setEditing(true);
  }, []);

  const installServer = useCallback((server: IMCPServer) => {
    // Force refresh from marketplace to ensure we have the latest version with parameters
    fetchServers(true).then(() => {
      setEditingServer(server);
      setInstalling(true);
    });
  }, [fetchServers]);

  const inspectServer = useCallback((server: IMCPServer) => {
    setDetailServer(server);
    setShowDetail(true);
  }, []);

  const toDeleteServer = useCallback((server: IMCPServer) => {
    setDeletingServer(server);
    setConfirmDelete(true);
  }, []);

  const onDeleteServer = useCallback(async () => {
    if (deletingServer) {
      const ok = await deleteServer(deletingServer.key);
      if (ok) {
        notifySuccess('Server deleted successfully');
      } else {
        notifyError('Failed to delete server');
      }
    }
  }, [deletingServer, deleteServer, notifySuccess, notifyError]);

  const handleImportConfig = useCallback(async (configData: IMCPConfig) => {
    try {
      const success = await window.electron.mcp.putConfig(configData);
      if (success) {
        await loadMCPConfig(true, true);
        notifySuccess(t('Common.ImportSuccess'));
      } else {
        notifyError(t('Common.ImportError'));
      }
    } catch (error) {
      console.error('Error importing config:', error);
      notifyError(t('Common.ImportError'));
    }
  }, [t, notifySuccess, notifyError, loadConfig]);

  useEffect(() => {
    loadMCPConfig(false, true);
  }, []);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleSection}>
          <div className={styles.pageTitle}>
            <h1 className={styles.toolsHeading}>{t('Common.Tools')}</h1>
          </div>
          <div className={styles.subtitle}>
            <Text>{t('Common.MCPServers')}</Text>
            <TooltipIcon tip={t('Tools.PrerequisiteDescription')} />
          </div>
        </div>
        
        <div className={styles.rightSection}>
          <Button
            appearance="subtle"
            icon={<ArrowSyncCircleRegular className={loading ? styles.rotateIcon : undefined} />}
            onClick={handleRefresh}
            disabled={loading}
            title={t('Common.Action.Reload')}
            className={styles.refreshButton}
          />
          
          <div className={styles.pageActions}>
            <Button
              appearance="outline"
              icon={<BuildingShopIcon />}
              onClick={() => setShowMarket(true)}
              className={styles.actionButton}
            >
              {t('Common.Market')}
            </Button>
            <Button
              appearance="outline"
              onClick={() => setImporting(true)}
              className={styles.actionButton}
            >
              {t('Common.Import')}
            </Button>
            <Button
              appearance="primary"
              onClick={() => {
                setEditingServer(null);
                setEditing(true);
              }}
              className={styles.actionButton}
            >
              {t('Common.New')}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.pageContent}>
        {config.servers.length === 0 ? (
          <Empty image="tools" text={t('Tool.Info.Empty')} />
        ) : (
          <Grid
            servers={config.servers}
            onEdit={editServer}
            onDelete={toDeleteServer}
            onInspect={inspectServer}
          />
        )}
      </div>

      <ToolEditDialog
        open={editing}
        setOpen={setEditing}
        server={editingServer}
      />
      
      <ConfirmDialog
        open={confirmDelete}
        setOpen={setConfirmDelete}
        title={t('Tools.DeleteConfirmation')}
        message={t('Tools.DeleteConfirmationInfo')}
        onConfirm={onDeleteServer}
      />
      
      {detailServer && (
        <DetailDialog
          open={showDetail}
          setOpen={setShowDetail}
          server={detailServer}
        />
      )}
      
      {editingServer && (
        <InstallDialog
          server={editingServer}
          open={installing}
          setOpen={setInstalling}
        />
      )}
      
      <MarketDrawer
        open={showMarket}
        setOpen={setShowMarket}
        onInstall={installServer}
      />
      
      <ImportMCPConfigDialog
        open={importing}
        setOpen={setImporting}
        onImport={handleImportConfig}
      />
    </div>
  );
}
