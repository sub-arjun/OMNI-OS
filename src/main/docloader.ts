import fs from 'fs';
import * as logging from './logging';
const pdf = require('pdf-parse');
import officeParser from 'officeparser';

abstract class BaseLoader {
  protected abstract read(filePath: string): Promise<string>;

  async load(filePath: string): Promise<string> {
    return await this.read(filePath);
  }
}

class TextDocumentLoader extends BaseLoader {
  async read(filePath: fs.PathLike): Promise<string> {
    return await fs.promises.readFile(filePath, 'utf-8');
  }
}

class OfficeLoader extends BaseLoader {
  constructor() {
    super();
  }

  async read(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      officeParser.parseOffice(filePath, function (text: string, error: any) {
        if (error) {
          reject(error);
        } else {
          resolve(text);
        }
      });
    });
  }
}

class PdfLoader extends BaseLoader {
  async read(filePath: fs.PathLike): Promise<string> {
    const dataBuffer = await fs.promises.readFile(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }
}

export async function loadDocument(
  filePath: string,
  fileType: string
): Promise<string> {
  logging.info(`load file from  ${filePath} on ${process.platform}`);
  let Loader: new () => BaseLoader;
  switch (fileType) {
    case 'txt':
      Loader = TextDocumentLoader;
      break;
    case 'md':
      Loader = TextDocumentLoader;
      break;
    case 'csv':
      Loader = TextDocumentLoader;
      break;
    case 'pdf':
      Loader = PdfLoader;
      break;
    case 'docx':
      Loader = OfficeLoader;
      break;
    case 'pptx':
      Loader = OfficeLoader;
      break;
    case 'xlsx':
      Loader = OfficeLoader;
      break;
    default:
      throw new Error(`Miss Loader for: ${fileType}`);
  }
  const loader = new Loader();
  let result = await loader.load(filePath);
  result = result.replace(/ +/g, ' ');
  const paragraphs = result
    .split(/\r?\n\r?\n/)
    .map((i) => i.replace(/\s+/g, ' '))
    .filter((i) => i.trim() !== '');
  return paragraphs.join('\r\n\r\n');
}
