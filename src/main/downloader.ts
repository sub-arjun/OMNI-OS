import path from 'path';
import fs from 'fs';
import log from 'electron-log';
import { app } from 'electron';

export default class Downloader {
  private win: any;
  private downloads: { [key: string]: any } = {};
  private onFailed: Function | undefined;
  private willDownloadHandler: (evt: any, item: any) => void;

  constructor(
    win: any,
    { onStart, onCompleted, onFailed, onProgress } = {
      onStart: (fileName: string) => {},
      onCompleted: (fileName: string, savePath: string) => {},
      onFailed: (fileName: string, savePath: string, state: string) => {},
      onProgress: (fileName: string, progress: number) => {},
    }
  ) {
    this.win = win;
    this.onFailed = onFailed;

    this.willDownloadHandler = (evt: any, item: any) => {
      const fileName = item.getFilename();
      const savePath = path.join(
        app.getPath('userData'),
        'downloads',
        item.getFilename()
      );
      item.setSavePath(savePath);

      const download = this.downloads[item.getFilename()];
      if (download?.cancelled) {
        delete this.downloads[item.getFilename()];
        item.cancel();
        try {
          fs.unlinkSync(savePath);
        } catch (e) {
          log.error('error deleting file', savePath, e);
        }
        onFailed && onFailed(fileName, savePath, 'cancelled');
        return;
      }
      this.downloads[fileName] = item;
      onStart && onStart(fileName);

      item.on('updated', (_: any, state: string) => {
        if (state === 'progressing') {
          const progress = item.getReceivedBytes() / item.getTotalBytes();
          onProgress && onProgress(fileName, progress);
        }
      });

      item.once('done', (_: Electron.Event, state: string) => {
        log.debug(`Download ${state}`, fileName);
        if (state === 'completed') {
          onCompleted && onCompleted(fileName, savePath);
        } else {
          fs.unlink(savePath, (err) => {
            if (err) {
              log.warn('error deleting file', savePath, err);
            }
          });
          onFailed && onFailed(fileName, savePath, state);
        }
        delete this.downloads[fileName];
      });
    };

    this.win.webContents.session.on('will-download', this.willDownloadHandler);
  }

  download(fileName: string, url: string) {
    this.downloads[fileName] = { pending: true };
    this.win.webContents.session.downloadURL(url);
  }

  cancel(fileName: string) {
    let item = this.downloads[fileName];
    if (!item) {
      this.downloads[fileName] = item = { pending: true };
    }
    if (!item.pending) {
      log.debug(`Cancelling download ${fileName}`);
      item.cancel();
      delete this.downloads[fileName];
      this.onFailed && this.onFailed(fileName, 'cancelled');
      fs.unlink(item.getSavePath(), (error) => {
        if (error) {
          log.warn('error deleting file', item.getSavePath(), error);
        }
      });
    } else {
      item.cancelled = true;
      log.warn('Download not started yet, set to be cancelled on start');
    }
  }

  destroy(): void {
    if (this.win && this.win.webContents && this.win.webContents.session) {
      this.win.webContents.session.off('will-download', this.willDownloadHandler);
      console.log('Downloader will-download listener removed.');
    }
    Object.keys(this.downloads).forEach(fileName => {
      this.cancel(fileName);
    });
    this.downloads = {};
  }
}
