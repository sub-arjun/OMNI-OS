// @ts-ignore
import { Axiom } from '@axiomhq/js';
import { captureException } from '../main/logging';

let axiom:any = null;

function getAxiom(){
  if (!axiom) {
    try {
      axiom = new Axiom({
        token: process.env.AXIOM_TOKEN as string,
        orgId: process.env.AXIOM_ORG_ID as string,
      });
    } catch (err: any) {
      captureException(err);
    }
  }
  return axiom;
}

export default {
  ingest(data: { [key: string]: any }[]) {
    try {
      const axiom = getAxiom();
      axiom && axiom.ingest('omnios', data);
    } catch (err: any) {
      captureException(err);
    }
  },
  async flush() {
    try {
      const axiom = getAxiom();
      axiom && (await axiom.flush());
    } catch (err: any) {
      captureException(err);
    }
  },
};
