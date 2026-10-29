import { handleHttp, type HttpRequest } from '../server/http.js';
import { runtime } from './runtime.js';

/** The API behind CloudFront's /api/* and /cal/* paths. */
export async function api(event: HttpRequest) {
  const { service, originSecret } = await runtime();
  return handleHttp(service, event, originSecret);
}

/** Run by EventBridge Scheduler: `{"job":"sync"}` every 15 minutes, `{"job":"sweep"}` every 5. */
export async function jobs(event: { job?: string }) {
  const { service } = await runtime();
  if (event.job === 'sync') {
    const summary = await service.syncAll();
    console.log(JSON.stringify({ job: 'sync', summary }));
    return summary;
  }
  if (event.job === 'sweep') {
    const released = await service.sweep();
    console.log(JSON.stringify({ job: 'sweep', released }));
    return { released };
  }
  throw new Error(`Unknown job ${JSON.stringify(event.job)}`);
}
