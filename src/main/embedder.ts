import { app } from 'electron';
import { promises as fsPromises } from 'node:fs';
import fs from 'node:fs';
import path from 'path';
import url from 'url'
import * as logging from './logging';

const BASE_DIR = path.join(app.getPath('userData'), 'transformers-models');

const BGE_MODEL_DIR = path.join(BASE_DIR, 'Xenova', 'bge-m3');

const FILES: { [key: string]: string } = {
  'model_quantized.onnx': path.join(
    BGE_MODEL_DIR,
    'onnx',
    'model_quantized.onnx'
  ),
  'config.json': path.join(BGE_MODEL_DIR, 'config.json'),
  'tokenizer_config.json': path.join(BGE_MODEL_DIR, 'tokenizer_config.json'),
  'tokenizer.json': path.join(BGE_MODEL_DIR, 'tokenizer.json'),
};

export class Embedder {
  static task: any = 'feature-extraction';
  static model = 'Xenova/bge-m3';
  static instance: any = null;

  public static async getFileStatus(): Promise<{ [key: string]: boolean }> {
    const status: { [key: string]: boolean } = {};
    for (const key in FILES) {
      try {
        await fsPromises.access(FILES[key], fs.constants.F_OK);
        status[key] = true;
      } catch (error) {
        status[key] = false;
      }
    }
    return status;
  }

  public static async removeModel(): Promise<void> {
    for (const key in FILES) {
      try {
        await fsPromises.unlink(FILES[key]);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          logging.error(`Error removing model file ${FILES[key]}:`, error);
        }
      }
    }
  }

  public static async saveModelFile(fileName: string, filePath: string): Promise<void> {
    const modelPath = FILES[fileName];
    const modelDir = path.dirname(modelPath);

    try {
      await fsPromises.mkdir(modelDir, { recursive: true });

      try {
        await fsPromises.unlink(modelPath);
      } catch (unlinkError: any) {
        if (unlinkError.code !== 'ENOENT') {
          logging.warn(`Could not unlink existing model file ${modelPath} before saving:`, unlinkError);
        }
      }

      await fsPromises.rename(filePath, modelPath);
      logging.debug(`Successfully saved model file ${fileName} to ${modelPath}`);
    } catch (error: any) {
      logging.error(`Error saving model file ${fileName}:`, error);
      throw new Error(`Failed to save model file ${fileName}: ${error.message}`);
    }
  }

  public static async getInstance(): Promise<any> {
    let transformers = null;
    if (this.instance === null) {
      if (process.env.NODE_ENV === 'production') {
        const basePath = path.dirname(path.dirname(path.dirname(__dirname)));
        const modelPath = path.join(
          basePath,
          'app.asar.unpacked',
          'node_modules',
          '@xenova',
          'transformers',
          'src',
          'transformers.js'
        );
        const modelUrl = url.pathToFileURL(modelPath).href.replace(/\\/g, '/');
        logging.debug(`Import transformers.js from ${modelUrl}`)
        const dynamicImport = Function(`return import("${modelUrl}")`);
        transformers = await dynamicImport();
      } else {
        transformers = await import('@xenova/transformers');
      }
      let { pipeline, env } = transformers;
      env.allowRemoteModels = false;
      env.localModelPath = BASE_DIR;
      this.instance = pipeline(this.task, this.model);
    }
    return this.instance;
  }
}

function sleep() {
  return new Promise((resolve) => {
    setImmediate(() => resolve(0));
  });
}

export async function embed(
  texts: string[],
  progressCallback?: (total: number, done: number) => void
): Promise<any> {
  const updateProgress = (done: number) => {
    if (progressCallback) {
      progressCallback(texts.length, done);
    }
  };
  const embedder = await Embedder.getInstance();
  const result = [];
  for (let i = 0; i < texts.length; i++) {
    await sleep();
    const res = await embedder(texts[i], { pooling: 'mean', normalize: true });
    result.push(res.data);
    if (progressCallback) {
      updateProgress(i + 1);
    }
  }
  return result;
}
