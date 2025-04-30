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
import { MCP_SERVER_STATE_CHANGED } from '../../../consts';

const BuildingShopIcon = bundleIcon(BuildingShopFilled, BuildingShopRegular);

const useStyles = makeStyles({
  pageContainer: {
    padding: '20px',
    paddingTop: '60px',
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
    '-webkit-app-region': 'no-drag',
  },
  refreshButton: {
    minWidth: '32px',
    height: '32px',
    padding: '0',
    borderRadius: '50%',
  },
});

// Define the event type to match what's being dispatched
interface MCPStateChangeEvent extends CustomEvent {
  detail: {
    serverKey: string;
    isActive: boolean;
    source: string;
    timestamp: number;
  };
}

export default function Tools() {
  const styles = useStyles();
  const { t } = useTranslation();
  const { loadConfig, config, isLoading, addServer, updateServer, deleteServer, activateServer, deactivateServer } = useMCPStore();
  const { fetchServers } = useMCPServerMarketStore();
  const { notifySuccess, notifyError } = useToast();
  
  // Separate loading states: one for overall UI loading, one for individual servers
  const [loadingUI, setLoadingUI] = useState(false);
  const [loadingServers, setLoadingServers] = useState<Record<string, boolean>>({});
  
  const [updateCounter, setUpdateCounter] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editingServer, setEditingServer] = useState<IMCPServer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingServer, setDeletingServer] = useState<IMCPServer | null>(null);
  const [detailServer, setDetailServer] = useState<IMCPServer | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [importing, setImporting] = useState(false);

  const forceUpdate = useCallback(() => {
    setUpdateCounter(prev => prev + 1);
  }, []);

  const loadMCPConfig = async (force: boolean, animate: boolean) => {
    try {
      animate && setLoadingUI(true);
      await loadConfig(force);
      forceUpdate();
    } catch (error) {
      console.error(error);
    } finally {
      animate && setLoadingUI(false);
    }
  };

  const handleRefresh = () => {
    setLoadingUI(true);
    loadMCPConfig(true, true);
    setTimeout(() => setLoadingUI(false), 1000);
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
    
    // Use the constant instead of recreating the string
    const handleMCPStateChange = async (event: MCPStateChangeEvent) => {
      const { serverKey, isActive, source, timestamp } = event.detail;
      
      // Immediately set the loading state to true
      setLoadingServers(prev => ({ ...prev, [serverKey]: true }));
      
      try {
        // Force reload the config to get the latest data
        await loadConfig(true);
        
        // Immediately update the UI
        forceUpdate();
        
        // For any event source, ensure we refresh again after a short delay to catch any race conditions
        setTimeout(async () => {
          try {
            await loadConfig(true);
            forceUpdate();
          } catch (error) {
            console.error('Error in delayed MCP state refresh:', error);
          } finally {
            // Clear the loading state for this server
            setLoadingServers(prev => ({ ...prev, [serverKey]: false }));
          }
        }, 250);
      } catch (error) {
        console.error('Error handling MCP state change in tools page:', error);
        // Clear the loading state for this server even if there's an error
        setLoadingServers(prev => ({ ...prev, [serverKey]: false }));
      }
    };
    
    // Cast the event handler to EventListener
    window.addEventListener(MCP_SERVER_STATE_CHANGED, handleMCPStateChange as unknown as EventListener);
    
    return () => {
      window.removeEventListener(MCP_SERVER_STATE_CHANGED, handleMCPStateChange as unknown as EventListener);
    };
  }, [forceUpdate, loadConfig]);

  useEffect(() => {
    if (updateCounter > 0) {
      loadMCPConfig(true, false);
    }
  }, [updateCounter]);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleSection}>
          <div className={styles.pageTitle}>
            <h1 className="text-2xl">{t('Common.Tools')}</h1>
          </div>
          <div className={styles.subtitle}>
            <Text>{t('Common.MCPServers')}</Text>
            <TooltipIcon tip={t('Tools.PrerequisiteDescription')} />
          </div>
        </div>
        
        <div className={styles.rightSection}>
          <Button
            appearance="subtle"
            icon={<ArrowSyncCircleRegular className={loadingUI ? "refresh-spin-animation" : undefined} />}
            onClick={handleRefresh}
            disabled={loadingUI}
            title={t('Common.Action.Reload')}
            className={styles.refreshButton}
          />
          
          <div className={`${styles.pageActions} ${styles.rightSection}`}>
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
            loadingServers={loadingServers}
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
